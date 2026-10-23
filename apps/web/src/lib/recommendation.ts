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

export interface PlannerProgress {
  playerLevel: number
  chapterId: string | null
}

const normalizeToken = (value: string): string =>
  value.toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')

const unique = <T>(values: T[]): T[] => [...new Set(values)]

const EQUIPMENT_SLOTS: EquipmentSlot[] = ['body', 'hand', 'edc']

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
  const selected = new Set(selectedCharacterIds)
  const presetIds = new Set(preset.characterIds)
  const matchedCharacterIds = preset.characterIds.filter((id) => selected.has(id))
  const missingCharacterIds = preset.characterIds.filter((id) => !selected.has(id))
  const extraCharacterIds = selectedCharacterIds.filter((id) => !presetIds.has(id))
  const exact =
    selected.size === 4 &&
    presetIds.size === 4 &&
    matchedCharacterIds.length === 4 &&
    extraCharacterIds.length === 0

  let score = matchedCharacterIds.length * 17
  if (exact) score += 30
  if (preset.sourceIds.length > 0) score += 2
  if (preset.characterIds.length !== 4) score -= 8
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

const rotationMatchesSelection = (
  rotation: RotationPreset,
  selectedCharacterIds: string[],
  exactTeam: TeamMatch | null,
): boolean => {
  const selected = [...selectedCharacterIds].sort()
  const rotationIds = [...rotation.characterIds].sort()
  const sameCharacters =
    rotationIds.length === 4 &&
    rotationIds.length === selected.length &&
    rotationIds.every((id, index) => id === selected[index])

  if (sameCharacters) return true
  return Boolean(
    exactTeam &&
      rotation.teamPresetId &&
      rotation.teamPresetId === exactTeam.preset.id &&
      !rotation.characterIds.length,
  )
}

const rotationToChoice = (rotation: RotationPreset): RotationChoice => ({
  id: rotation.id,
  name: rotation.name,
  kind: 'source-backed',
  description: `攻略來源循環 · 條件式順序${
    rotation.scenario ? ` · ${rotation.scenario}` : ''
  }${rotation.description ? `。${rotation.description}` : ''}`,
  steps: rotation.steps,
  warnings: unique([
    ...(rotation.sourceIds.length ? [] : ['此循環沒有來源 ID，請人工核對。']),
    '攻略只提供條件式順序，並非幀級最佳或角色專屬最佳。',
    ...rotation.steps.flatMap((step) => step.warnings),
  ]),
  sourceIds: rotation.sourceIds,
  confidence: rotation.confidence,
  presetId: rotation.id,
})

const battleRule = (skill: SkillFact): { phase: string; rank: number } => {
  if (
    hasAnyTag(skill.tags, [
      'buff-team',
      'team-buff',
      'heal',
      'shield',
      'survival',
      'heal-over-time',
    ])
  ) {
    return { phase: '建立增益 / 生存底稿', rank: 10 }
  }
  if (
    hasAnyTag(skill.tags, [
      'debuff-enemy',
      'control',
      'break-shield',
      'vulnerable',
      'energy-gain',
    ])
  ) {
    return { phase: '鋪設破韌 / 減益', rank: 20 }
  }
  return { phase: '戰技窗口', rank: 40 }
}

const skillRule = (skill: SkillFact): { phase: string; rank: number } => {
  if (skill.type === 'battle') return battleRule(skill)
  if (skill.type === 'combo') {
    return {
      phase: '連攜觸發窗口',
      rank: hasAnyTag(skill.tags, ['debuff-enemy', 'control', 'break-shield']) ? 25 : 35,
    }
  }
  if (skill.type === 'ultimate') return { phase: '終結技能量窗口', rank: 50 }
  return { phase: '其他技能', rank: 60 }
}

const ruleWaitFor = (skill: SkillFact): string => {
  if (skill.type === 'battle') return '確認共享技力足夠，且目標已進入本步效果窗口'
  if (skill.type === 'combo') {
    return skill.triggerConditions[0] ?? '等待角色連攜條件亮起；僅在連攜窗口內接續'
  }
  if (skill.type === 'ultimate') return '確認終結技能量已滿，且增益或破韌窗口尚未結束'
  return '確認技能條件滿足後再執行'
}

const ruleTrigger = (skill: SkillFact): string => {
  if (skill.type === 'combo') {
    return skill.triggerConditions.join(' / ') || '角色條件觸發，不可當作普通戰技主動釋放'
  }
  if (skill.type === 'ultimate') return '終結技能量達到需求'
  return skill.triggerConditions.join(' / ') || '主動戰技；共享全隊技力'
}

const createRuleStep = (character: CharacterFact, skill: SkillFact, order: number): RotationStep => {
  const rule = skillRule(skill)
  const warnings = ['規則生成，待人工核對']
  if (!skill.triggerConditions.length && skill.type === 'combo') {
    warnings.push('連攜觸發條件缺失')
  }
  if (skill.type === 'ultimate' && skill.energyCost === null) {
    warnings.push('終結技能量消耗未標註')
  }

  return {
    id: `rule-${character.id}-${skill.id}-${order}`,
    order,
    phase: rule.phase,
    characterId: character.id,
    skillId: skill.id,
    skillName: skill.name,
    skillType: skill.type,
    triggerCondition: ruleTrigger(skill),
    waitFor: ruleWaitFor(skill),
    // A combo cooldown is not the same as the source-defined combo window.
    comboWindowSeconds: null,
    sharedSkillPointCost: skill.type === 'battle' ? skill.sharedSkillPointCost : null,
    energyCost: skill.type === 'ultimate' ? skill.energyCost : null,
    cooldownSeconds: skill.cooldownSeconds,
    warnings,
    note: skill.description,
  }
}

export const buildRuleRotation = (characters: CharacterFact[]): RotationChoice => {
  const deduplicated = characters.flatMap((character, characterIndex) =>
    character.skills.map((skill, skillIndex) => ({
      character,
      characterIndex,
      skillIndex,
      skill,
      rule: skillRule(skill),
      candidateKey: `${character.id}:${skill.id}:${skill.type}`,
    })),
  )

  const candidates = [...deduplicated]
    .sort(
      (a, b) =>
        a.rule.rank - b.rule.rank ||
        a.characterIndex - b.characterIndex ||
        a.skillIndex - b.skillIndex ||
        a.skill.id.localeCompare(b.skill.id),
    )
    .filter(
      (candidate, index, all) =>
        all.findIndex((other) => other.candidateKey === candidate.candidateKey) === index,
    )

  const ultimates = candidates
    .filter((candidate) => candidate.skill.type === 'ultimate')
    .slice(0, 12)
  const regularSlots = Math.max(0, 12 - ultimates.length)
  const regulars = candidates
    .filter(
      (candidate) =>
        candidate.skill.type !== 'ultimate' &&
        !ultimates.some((ultimate) => ultimate.candidateKey === candidate.candidateKey),
    )
    .slice(0, regularSlots)
  const selectedKeys = new Set(
    [...ultimates, ...regulars].map((candidate) => candidate.candidateKey),
  )
  const ordered = candidates
    .filter((candidate) => selectedKeys.has(candidate.candidateKey))
    .slice(0, 12)

  const warnings = ['規則生成，待人工核對']
  if (!candidates.length) warnings.push('所選角色缺少可用技能欄位，無法生成步驟')

  return {
    id: 'rule-generated',
    name: '標籤規則編排',
    kind: 'rule-generated',
    description: '沒有完全符合的攻略循環。以下順序僅由角色、技能類型與效果標籤確定性推導。',
    steps: ordered.map((candidate, index) =>
      createRuleStep(candidate.character, candidate.skill, index + 1),
    ),
    warnings,
    sourceIds: [],
    confidence: null,
    presetId: null,
  }
}

export const buildRotationChoices = (
  dataset: Dataset,
  selectedCharacterIds: string[],
  exactTeam: TeamMatch | null,
): RotationChoice[] => {
  const byId = new Map(dataset.characters.map((character) => [character.id, character]))
  const selectedCharacters = selectedCharacterIds
    .map((id) => byId.get(id))
    .filter((character): character is CharacterFact => Boolean(character))

  const sourceBacked = dataset.rotationPresets
    .filter((rotation) => rotationMatchesSelection(rotation, selectedCharacterIds, exactTeam))
    .sort(
      (a, b) =>
        b.sourceIds.length - a.sourceIds.length ||
        b.steps.length - a.steps.length ||
        a.id.localeCompare(b.id),
    )
    .map(rotationToChoice)

  return sourceBacked.length ? sourceBacked : [buildRuleRotation(selectedCharacters)]
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
  if (roles.length) matchNotes.push(`定位匹配 · ${roles.join(' / ')}`)
  if (elementMatches) matchNotes.push(`元素匹配 · ${character.element}`)
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
    warnings.push('沒有與目前四人完全一致的攻略隊伍；隊伍摘要來自部分匹配或標籤覆蓋。')
  }
  if (rotations.every((rotation) => rotation.kind === 'rule-generated')) {
    warnings.push('沿用標籤規則回退循環，不能視為已驗證攻略。')
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
