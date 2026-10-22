import type {
  CharacterFact,
  Dataset,
  EquipmentCandidate,
  EquipmentFact,
  EquipmentRecommendation,
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
  description:
    rotation.description ??
    (rotation.scenario ? `攻略预设 · ${rotation.scenario}` : '攻略预设循环'),
  steps: rotation.steps,
  warnings: unique([
    ...(rotation.sourceIds.length ? [] : ['此循环没有来源 ID，请人工核对。']),
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
    return { phase: '铺设破韧 / 减益', rank: 20 }
  }
  return { phase: '战技窗口', rank: 40 }
}

const skillRule = (skill: SkillFact): { phase: string; rank: number } => {
  if (skill.type === 'battle') return battleRule(skill)
  if (skill.type === 'combo') {
    return {
      phase: '连携触发窗口',
      rank: hasAnyTag(skill.tags, ['debuff-enemy', 'control', 'break-shield']) ? 25 : 35,
    }
  }
  if (skill.type === 'ultimate') return { phase: '终结技能量窗口', rank: 50 }
  return { phase: '其他技能', rank: 60 }
}

const ruleWaitFor = (skill: SkillFact): string => {
  if (skill.type === 'battle') return '确认共享技力足够，且目标已进入本步效果窗口'
  if (skill.type === 'combo') {
    return skill.triggerConditions[0] ?? '等待角色连携条件亮起；仅在连携窗口内接续'
  }
  if (skill.type === 'ultimate') return '确认终结技能量已满，且增益或破韧窗口尚未结束'
  return '确认技能条件满足后再执行'
}

const ruleTrigger = (skill: SkillFact): string => {
  if (skill.type === 'combo') {
    return skill.triggerConditions.join(' / ') || '角色条件触发，不可当作普通战技主动释放'
  }
  if (skill.type === 'ultimate') return '终结技能量达到需求'
  return skill.triggerConditions.join(' / ') || '主动战技；共享全队技力'
}

const createRuleStep = (character: CharacterFact, skill: SkillFact, order: number): RotationStep => {
  const rule = skillRule(skill)
  const warnings = ['规则生成，待人工核对']
  if (!skill.triggerConditions.length && skill.type === 'combo') {
    warnings.push('连携触发条件缺失')
  }
  if (skill.type === 'ultimate' && skill.energyCost === null) {
    warnings.push('终结技能量消耗未标注')
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
  const candidates = characters.flatMap((character, characterIndex) =>
    character.skills.map((skill) => ({
      character,
      characterIndex,
      skill,
      rule: skillRule(skill),
    })),
  )

  const ordered = candidates
    .sort(
      (a, b) =>
        a.rule.rank - b.rule.rank ||
        a.characterIndex - b.characterIndex ||
        a.skill.id.localeCompare(b.skill.id),
    )
    .filter(
      (candidate, index, all) =>
        all.findIndex(
          (other) =>
            other.character.id === candidate.character.id && other.skill.type === candidate.skill.type,
        ) === index,
    )
    .slice(0, 10)

  const warnings = ['规则生成，待人工核对']
  if (!candidates.length) warnings.push('所选角色缺少可用技能字段，无法生成步骤')

  return {
    id: 'rule-generated',
    name: '标签规则编排',
    kind: 'rule-generated',
    description: '没有完全匹配的攻略循环。以下顺序仅由角色、技能类型与效果标签确定性推导。',
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
    return { state: 'not-craftable', labels: ['来源标记为不可制造'] }
  }

  const labels: string[] = []
  let unknown = false
  let locked = false

  if (equipment.unlock.playerLevel !== null) {
    const levelKind = equipment.unlock.playerLevelKind
    labels.push(
      !levelKind || levelKind === 'equipment_wear_level'
        ? `装备穿戴等级 Lv.${equipment.unlock.playerLevel}`
        : `等级门槛 ${levelKind} Lv.${equipment.unlock.playerLevel}`,
    )
    if (progress.playerLevel < equipment.unlock.playerLevel) locked = true
  }

  if (equipment.formulaAuthorityRank !== null) {
    labels.push(`配方权限要求 Rank ${equipment.formulaAuthorityRank}`)
  }
  if (equipment.recipeTier) labels.push(`配方阶级 ${equipment.recipeTier}`)

  const requiredChapterOrder =
    equipment.unlock.chapterOrder ??
    (equipment.unlock.chapterId ? chaptersById.get(equipment.unlock.chapterId)?.order ?? null : null)
  if (equipment.unlock.chapterId) {
    const chapter = chaptersById.get(equipment.unlock.chapterId)
    labels.push(`剧情 ${chapter?.name ?? equipment.unlock.chapterId}`)
  }
  if (requiredChapterOrder !== null) {
    const currentOrder = progress.chapterId
      ? chaptersById.get(progress.chapterId)?.order
      : undefined
    if (!equipment.unlock.chapterId) labels.push(`章节序 ${requiredChapterOrder}`)
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

  if (equipment.recommendedFor.includes(character.id)) matchNotes.push('角色专属推荐')
  if (roles.length) matchNotes.push(`定位匹配 · ${roles.join(' / ')}`)
  if (elementMatches) matchNotes.push(`元素匹配 · ${character.element}`)
  if (!equipment.recommendedFor.length && !equipment.roleTags.length) {
    matchNotes.push('仅按通用属性排序，需人工核对')
  }
  return {
    equipment,
    score: equipmentMatchScore(character, equipment),
    unlockState: unlock.state,
    gateLabels: unlock.labels,
    matchNotes,
  }
}

export const recommendEquipmentForCharacter = (
  dataset: Dataset,
  character: CharacterFact,
  progress: PlannerProgress,
): EquipmentRecommendation => {
  const chaptersById = chapterIndex(dataset)
  const relevant = dataset.equipment
    .filter((item) => item.craftable !== false)
    .filter((item) => isEquipmentRelevant(character, item))
    .map((item) => toCandidate(character, item, progress, chaptersById))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.unlockState === 'unlocked') - Number(a.unlockState === 'unlocked') ||
        a.equipment.id.localeCompare(b.equipment.id),
    )

  const bestOverall = relevant[0] ?? null
  const available = relevant.filter((item) => item.unlockState === 'unlocked')
  const bestAvailable = available[0] ?? null
  const alternatives = available
    .filter((item) => item.equipment.id !== bestAvailable?.equipment.id)
    .slice(0, 2)

  const warnings: string[] = []
  if (!relevant.length) warnings.push('没有符合角色标签的装备资料')
  if (bestOverall?.unlockState === 'locked') warnings.push('最佳装备尚未达到已知解锁门槛')
  if (!bestAvailable) {
    warnings.push('当前装备穿戴等级与已知章节条件下，没有可确认通过已知门槛的装备')
  }
  if (relevant.some((item) => item.unlockState === 'unknown')) {
    warnings.push('部分装备缺少等级、章节或制造状态，未计入“穿戴等级已达标”')
  }
  if (!dataset.chapters.length) {
    warnings.push('章节与权限解锁资料尚未核验；本次仅确认装备穿戴等级条件')
  }
  if (relevant.some((item) => item.equipment.formulaAuthorityRank !== null)) {
    warnings.push('配方权限要求尚未由剧情或权限进度自动判定，请进入游戏核对')
  }

  return {
    characterId: character.id,
    bestOverall,
    bestAvailable,
    alternatives,
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

  if (!exactTeam) warnings.push('没有与当前四人完全一致的攻略队伍；队伍摘要来自部分匹配或标签覆盖。')
  if (rotations.every((rotation) => rotation.kind === 'rule-generated')) {
    warnings.push('沿用标签规则回退循环，不能视为已验证攻略。')
  }
  if (!dataset.teamPresets.length) warnings.push('team-presets.json 没有可用记录。')
  if (!dataset.rotationPresets.length) warnings.push('rotation-presets.json 没有可用记录。')
  if (!dataset.equipment.length) warnings.push('equipment.json 没有可用记录。')
  if (!dataset.chapters.length) {
    warnings.push('章节与权限解锁资料尚未核验；装备结果仅按装备穿戴等级生成。')
  }

  return { teamMatches, exactTeam, rotations, equipment, teamTags, warnings }
}

export const describeUnlockGate = (candidate: EquipmentCandidate): string =>
  candidate.gateLabels.length ? candidate.gateLabels.join(' · ') : '解锁门槛未标注'
