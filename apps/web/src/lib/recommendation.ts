import type {
  CharacterFact,
  Dataset,
  EquipmentCandidate,
  EquipmentFact,
  EquipmentLoadout,
  EquipmentSlot,
  EquipmentSlotRecommendation,
  RecommendationReport,
  RotationChoice,
  RotationPreset,
  RotationStep,
  SkillFact,
  SkillType,
  StoryChapter,
  TeamMatch,
  TeamPreset,
  UnlockState,
} from '@/types/domain'
import { displayElement, displayRoleOrTag } from '@/lib/displayLabels'
import { MAX_TEAM_SIZE } from '@/lib/validation'

export interface PlannerProgress {
  playerLevel: number
  chapterId: string | null
}

const normalizeToken = (value: string): string =>
  value.toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')

const unique = <T>(values: T[]): T[] => [...new Set(values)]

const EQUIPMENT_SLOTS: EquipmentSlot[] = ['body', 'hand', 'edc']

// A same-source fragment needs at least two verified character hits. A single
// hit is not enough evidence and must fall through to the explicit
// "尚無可核驗隊伍循環" placeholder instead of a fragment.
const MIN_FRAGMENT_MATCHES = 2

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  body: '身體防具',
  hand: '手部裝備',
  edc: 'EDC 配件',
}

const selectSkill = (character: CharacterFact, type: SkillType): SkillFact | undefined =>
  character.skills.find((skill) => skill.type === type)

const normalizedTags = (character: CharacterFact): string[] =>
  unique([...character.roles, ...character.tags].map(normalizeToken))

const hasAnyTag = (tags: string[], candidates: string[]): boolean => {
  const accepted = new Set(candidates.map(normalizeToken))
  return tags.some((tag) => accepted.has(normalizeToken(tag)))
}

const matchingRoleTags = (character: CharacterFact, equipment: EquipmentFact): string[] => {
  const characterRoles = new Set(normalizedTags(character))
  return equipment.roleTags.filter((tag) => characterRoles.has(normalizeToken(tag)))
}

const matchesEquipmentElement = (
  character: CharacterFact,
  equipment: EquipmentFact,
): boolean =>
  Boolean(
    character.element &&
      equipment.elementTags.some(
        (tag) => normalizeToken(tag) === normalizeToken(character.element ?? ''),
      ),
  )

const isEquipmentRelevant = (character: CharacterFact, equipment: EquipmentFact): boolean => {
  if (equipment.recommendedFor.includes(character.id)) return true
  if (matchingRoleTags(character, equipment).length > 0) return true
  if (matchesEquipmentElement(character, equipment)) return true

  return (
    equipment.recommendedFor.length === 0 &&
    equipment.roleTags.length === 0 &&
    equipment.elementTags.length === 0
  )
}

const scoreTeamPreset = (preset: TeamPreset, selectedCharacterIds: string[]): TeamMatch => {
  const selectedIds = unique(selectedCharacterIds)
  const presetCharacterIds = unique(preset.characterIds)
  const selected = new Set(selectedIds)
  const presetIds = new Set(presetCharacterIds)
  const matchedCharacterIds = presetCharacterIds.filter((id) => selected.has(id))
  const missingCharacterIds = presetCharacterIds.filter((id) => !selected.has(id))
  const extraCharacterIds = selectedIds.filter((id) => !presetIds.has(id))
  const exact =
    selected.size > 0 &&
    selected.size <= MAX_TEAM_SIZE &&
    presetIds.size <= MAX_TEAM_SIZE &&
    selected.size === presetIds.size &&
    matchedCharacterIds.length === selected.size &&
    extraCharacterIds.length === 0

  const unionSize = new Set([...selected, ...presetIds]).size
  const selectedCoverage = selected.size ? matchedCharacterIds.length / selected.size : 0
  const presetCoverage = presetIds.size ? matchedCharacterIds.length / presetIds.size : 0
  const setCoverage = unionSize ? matchedCharacterIds.length / unionSize : 0
  let score = Math.round(
    setCoverage * 60 + selectedCoverage * 20 + presetCoverage * 20,
  )
  if (preset.sourceIds.length > 0) score += 2
  if (exact) score = 100
  score = Math.max(0, Math.min(100, score))

  return {
    preset,
    score,
    exact,
    matchedCharacterIds,
    missingCharacterIds,
    extraCharacterIds,
    sourceBacked: preset.sourceIds.length > 0,
  }
}

export const matchTeamPresets = (
  selectedCharacterIds: string[],
  presets: TeamPreset[],
): TeamMatch[] =>
  presets
    .map((preset) => scoreTeamPreset(preset, selectedCharacterIds))
    .filter((match) => match.matchedCharacterIds.length > 0)
    .sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) ||
        b.score - a.score ||
        a.preset.id.localeCompare(b.preset.id),
    )

type RotationMatch = 'exact' | 'fragment' | null

const matchRotation = (
  rotation: RotationPreset,
  selectedCharacterIds: string[],
  exactTeam: TeamMatch | null,
): RotationMatch => {
  const selected = unique(selectedCharacterIds).sort()
  const authoredIds = unique(rotation.characterIds)
  const teamIds = authoredIds.length
    ? authoredIds.sort()
    : unique(exactTeam?.preset.characterIds ?? []).sort()
  if (!selected.length) return null
  if (!teamIds.length) return null

  // Compare as sets so the selection order can never decide the rotation kind.
  const isSameTeam =
    teamIds.length === selected.length &&
    teamIds.every((id, index) => id === selected[index])
  if (isSameTeam) return rotation.matchType === 'fragment' ? 'fragment' : 'exact'

  const matched = selected.filter((id) => teamIds.includes(id))
  const isPartialSubset =
    matched.length < selected.length || matched.length < teamIds.length
  const hasEnoughFragmentEvidence = matched.length >= MIN_FRAGMENT_MATCHES
  return isPartialSubset && hasEnoughFragmentEvidence ? 'fragment' : null
}

const rotationToChoice = (
  rotation: RotationPreset,
  kind: 'source-backed' | 'source-fragment',
  selectedCharacterIds: string[],
): RotationChoice => {
  const selected = new Set(selectedCharacterIds)
  const steps = kind === 'source-fragment'
    ? rotation.steps
        .filter((step) => selected.has(step.characterId))
        .sort((a, b) => a.order - b.order)
        .map((step, index) => ({ ...step, order: index + 1 }))
    : [...rotation.steps].sort((a, b) => a.order - b.order)

  return {
    id: rotation.id,
    name: rotation.name,
    kind,
    matchType: rotation.matchType,
    dependencies: rotation.dependencies,
    description: kind === 'source-fragment'
      ? `來源循環片段 · ${rotation.scenario ?? '條件式順序'}。僅保留所選角色步驟，不代表完整隊伍循環。`
      : `完整攻略循環 · ${rotation.scenario ?? '條件式順序'}${rotation.description ? `。${rotation.description}` : ''}`,
    steps,
    warnings: unique([
      ...(rotation.sourceIds.length ? [] : ['此循環沒有來源 ID，請人工核對。']),
      ...(kind === 'source-fragment' ? ['這是來源循環片段，不能視為完整隊伍攻略。'] : []),
      '攻略提供的是條件式順序，並非幀級最佳。',
      ...rotation.limitations,
      ...steps.flatMap((step) => step.warnings),
    ]),
    sourceIds: rotation.sourceIds,
    confidence: rotation.confidence,
    presetId: rotation.teamPresetId,
    author: rotation.author,
    videoTimestamp: rotation.videoTimestamp,
    publishedAt: rotation.publishedAt,
    triggerConditions: rotation.triggerConditions,
    waitConditions: rotation.waitConditions,
    limitations: rotation.limitations,
    matchedCharacterIds: unique(steps.map((step) => step.characterId)).sort(),
  }
}

const unavailableRotation = (): RotationChoice => ({
  id: 'rotation-unavailable',
  name: '尚無可核驗隊伍循環',
  kind: 'unavailable',
  matchType: null,
  dependencies: [],
  description: '目前沒有找到能完整重現此隊伍的可核驗循環。',
  steps: [],
  warnings: ['目前隊伍尚無可核驗的完整攻略循環。'],
  sourceIds: [],
  confidence: null,
  presetId: null,
  author: null,
  videoTimestamp: null,
  publishedAt: null,
  triggerConditions: [],
  waitConditions: [],
  limitations: [],
  matchedCharacterIds: [],
})

export const buildRotationChoices = (
  dataset: Dataset,
  selectedCharacterIds: string[],
  exactTeam: TeamMatch | null,
): RotationChoice[] => {
  const matches: Array<{
    rotation: RotationPreset
    match: 'exact' | 'fragment'
  }> = []
  for (const rotation of dataset.rotationPresets) {
    const match = matchRotation(rotation, selectedCharacterIds, exactTeam)
    if (match) matches.push({ rotation, match })
  }
  matches.sort(
    (a, b) =>
      Number(b.match === 'exact') - Number(a.match === 'exact') ||
      b.rotation.sourceIds.length - a.rotation.sourceIds.length ||
      b.rotation.steps.length - a.rotation.steps.length ||
      a.rotation.id.localeCompare(b.rotation.id),
  )
  const exact = matches.filter((item) => item.match === 'exact')
  const chosen = exact.length ? exact : matches
  return chosen.length
    ? chosen.map(({ rotation, match }) =>
        rotationToChoice(
          rotation,
          match === 'exact' ? 'source-backed' : 'source-fragment',
          selectedCharacterIds,
        ),
      )
    : [unavailableRotation()]
}

const equipmentMatchScore = (character: CharacterFact, equipment: EquipmentFact): number => {
  let score = (equipment.rarity ?? 0) * 2
  if (equipment.recommendedFor.includes(character.id)) score += 100

  score += matchingRoleTags(character, equipment).length * 12
  if (matchesEquipmentElement(character, equipment)) score += 10
  score += Math.min(equipment.sourceIds.length, 2)
  return score
}

const chapterIndex = (dataset: Dataset): Map<string, StoryChapter> =>
  new Map(dataset.chapters.map((chapter) => [chapter.id, chapter]))

const unlockForEquipment = (
  equipment: EquipmentFact,
  progress: PlannerProgress,
  chaptersById: Map<string, StoryChapter>,
): { state: UnlockState; labels: string[] } => {
  if (equipment.craftable === false) {
    return { state: 'not-craftable', labels: ['來源標記為不可製造'] }
  }

  const labels: string[] = []
  let unknown = false
  let locked = false

  if (equipment.unlock.playerLevel !== null) {
    const levelKind = equipment.unlock.playerLevelKind
    labels.push(
      !levelKind || levelKind === 'equipment_wear_level'
        ? `裝備穿戴等級 Lv.${equipment.unlock.playerLevel}`
        : `等級門檻 ${levelKind} Lv.${equipment.unlock.playerLevel}`,
    )
    if (progress.playerLevel < equipment.unlock.playerLevel) locked = true
  }

  if (equipment.formulaAuthorityRank !== null) {
    labels.push(`配方權限要求 Rank ${equipment.formulaAuthorityRank}`)
  }
  if (equipment.recipeTier) labels.push(`配方階級 ${equipment.recipeTier}`)

  const requiredChapterOrder =
    equipment.unlock.chapterOrder ??
    (equipment.unlock.chapterId ? chaptersById.get(equipment.unlock.chapterId)?.order ?? null : null)
  if (equipment.unlock.chapterId) {
    const chapter = chaptersById.get(equipment.unlock.chapterId)
    labels.push(`劇情 ${chapter?.name ?? equipment.unlock.chapterId}`)
  }
  if (requiredChapterOrder !== null) {
    const currentOrder = progress.chapterId
      ? chaptersById.get(progress.chapterId)?.order
      : undefined
    if (!equipment.unlock.chapterId) labels.push(`章節序 ${requiredChapterOrder}`)
    if (currentOrder === undefined) unknown = true
    else if (currentOrder < requiredChapterOrder) locked = true
  } else if (equipment.unlock.chapterId) {
    unknown = true
  }

  if (equipment.unlock.playerLevel === null && !equipment.unlock.chapterId) unknown = true
  if (equipment.craftable === null) unknown = true
  if (locked) return { state: 'locked', labels }
  if (unknown) return { state: 'unknown', labels }
  return { state: 'unlocked', labels }
}

const toCandidate = (
  character: CharacterFact,
  equipment: EquipmentFact,
  progress: PlannerProgress,
  chaptersById: Map<string, StoryChapter>,
): EquipmentCandidate => {
  const unlock = unlockForEquipment(equipment, progress, chaptersById)
  const matchNotes: string[] = []
  const roles = matchingRoleTags(character, equipment)
  const elementMatches = matchesEquipmentElement(character, equipment)

  if (equipment.recommendedFor.includes(character.id)) matchNotes.push('角色專屬推薦')
  const roleNote = roles.map((role) => displayRoleOrTag(role)).join(' / ')
  if (roles.length) matchNotes.push(`定位匹配 · ${roleNote}`)
  if (elementMatches) matchNotes.push(`元素匹配 · ${displayElement(character.element)}`)
  if (!equipment.recommendedFor.length && !equipment.roleTags.length) {
    matchNotes.push('僅按通用屬性排序')
  }
  return {
    equipment,
    score: equipmentMatchScore(character, equipment),
    unlockState: unlock.state,
    gateLabels: unlock.labels,
    matchNotes,
  }
}

const recommendEquipmentForSlot = (
  equipment: EquipmentFact[],
  character: CharacterFact,
  progress: PlannerProgress,
  slot: EquipmentSlot,
  chaptersById: Map<string, StoryChapter>,
): EquipmentSlotRecommendation => {
  const relevant = equipment
    .filter((item) => item.slot === slot)
    .filter((item) => item.craftable !== false)
    .filter((item) => isEquipmentRelevant(character, item))
    .map((item) => toCandidate(character, item, progress, chaptersById))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.unlockState === 'unlocked') - Number(a.unlockState === 'unlocked') ||
        (a.equipment.setName ?? '~').localeCompare(b.equipment.setName ?? '~') ||
        a.equipment.id.localeCompare(b.equipment.id),
    )

  const target = relevant[0] ?? null
  const available =
    target?.unlockState === 'unlocked'
      ? null
      : relevant.find(
          (item) =>
            item.unlockState === 'unlocked' &&
            item.equipment.id !== target?.equipment.id,
        ) ?? null
  const excludedIds = new Set(
    [target?.equipment.id, available?.equipment.id].filter(
      (id): id is string => Boolean(id),
    ),
  )
  const alternatives = relevant
    .filter((item) => !excludedIds.has(item.equipment.id))
    .slice(0, 2)

  const warnings: string[] = []
  if (!relevant.length) warnings.push('此部位沒有符合角色標籤或通用屬性的裝備資料')
  if (target?.unlockState === 'locked') warnings.push('此部位最高分裝備尚未達到已知穿戴門檻')
  if (target?.unlockState === 'unknown') warnings.push('此部位最高分裝備缺少完整解鎖資料')
  if (target?.unlockState !== 'unlocked' && !available) {
    warnings.push('此部位目前沒有可確認通過已知穿戴門檻的裝備')
  }
  if (relevant.some((item) => item.unlockState === 'unknown')) {
    warnings.push('部分裝備缺少等級、章節或製造狀態，未計入可確認的穿戴結果')
  }
  if (relevant.some((item) => item.equipment.formulaAuthorityRank !== null)) {
    warnings.push('配方權限要求尚未由劇情或權限進度自動判定，請進入遊戲核對')
  }

  return {
    slot,
    target,
    available,
    alternatives,
    warnings,
  }
}

export const recommendEquipmentForCharacter = (
  dataset: Dataset,
  character: CharacterFact,
  progress: PlannerProgress,
): EquipmentLoadout => {
  const chaptersById = chapterIndex(dataset)
  const slots = Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [
      slot,
      recommendEquipmentForSlot(
        dataset.equipment,
        character,
        progress,
        slot,
        chaptersById,
      ),
    ]),
  ) as Record<EquipmentSlot, EquipmentSlotRecommendation>

  const warnings = unique([
    ...(dataset.chapters.length
      ? []
      : ['章節與權限解鎖資料尚未核驗；本次僅確認已知裝備穿戴等級']),
    ...EQUIPMENT_SLOTS.flatMap((slot) => slots[slot].warnings),
  ])

  return {
    characterId: character.id,
    slots,
    warnings,
  }
}

export const buildRecommendationReport = (
  dataset: Dataset,
  selectedCharacterIds: string[],
  progress: PlannerProgress,
): RecommendationReport => {
  const byId = new Map(dataset.characters.map((character) => [character.id, character]))
  const characters = selectedCharacterIds
    .map((id) => byId.get(id))
    .filter((character): character is CharacterFact => Boolean(character))
  const teamMatches = matchTeamPresets(selectedCharacterIds, dataset.teamPresets)
  const exactTeam = teamMatches.find((match) => match.exact) ?? null
  const rotations = buildRotationChoices(dataset, selectedCharacterIds, exactTeam)
  const equipment = characters.map((character) =>
    recommendEquipmentForCharacter(dataset, character, progress),
  )
  const teamTags = unique(characters.flatMap((character) => normalizedTags(character))).slice(0, 12)
  const warnings: string[] = []

  if (!exactTeam) {
    warnings.push(
      teamMatches.length
        ? `目前選擇的 ${characters.length} 名角色未與任何攻略隊伍完全一致；隊伍摘要來自部分匹配，不代表攻略隊伍已完整重現。`
        : `目前選擇的 ${characters.length} 名角色沒有可用的攻略隊伍匹配；隊伍摘要僅依角色標籤整理。`,
    )
  }
  if (rotations.every((rotation) => rotation.kind === 'unavailable')) {
    warnings.push('目前隊伍尚無可核驗的完整攻略循環。')
  }
  if (!dataset.teamPresets.length) warnings.push('team-presets.json 沒有可用記錄。')
  if (!dataset.rotationPresets.length) warnings.push('rotation-presets.json 沒有可用記錄。')
  if (!dataset.equipment.length) warnings.push('equipment.json 沒有可用記錄。')
  if (!dataset.chapters.length) {
    warnings.push('章節與權限解鎖資料尚未核驗；裝備結果僅按已知裝備穿戴等級生成。')
  }

  return { teamMatches, exactTeam, rotations, equipment, teamTags, warnings }
}

export const describeUnlockGate = (candidate: EquipmentCandidate): string =>
  candidate.gateLabels.length ? candidate.gateLabels.join(' · ') : '解鎖門檻未標註'
