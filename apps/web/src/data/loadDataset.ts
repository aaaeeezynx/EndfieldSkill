import type {
  CharacterFact,
  Dataset,
  DatasetCoverage,
  DatasetMeta,
  DatasetUnresolved,
  EquipmentFact,
  EquipmentSlot,
  RotationPreset,
  RotationStep,
  SkillFact,
  SkillType,
  SourceRecord,
  StoryChapter,
  TeamPreset,
} from '@/types/domain'
import { MAX_TEAM_SIZE, MIN_TEAM_SIZE } from '@/lib/validation'

type UnknownRecord = Record<string, unknown>

import { toTraditional, toTraditionalList } from '../lib/traditionalChinese'

const DATA_FILES = [
  'meta.json',
  'characters.json',
  'equipment.json',
  'progressions.json',
  'team-presets.json',
  'rotation-presets.json',
  'sources.json',
] as const

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {}

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(asString).filter((item): item is string => Boolean(item)))]
}

const normalizeEquipmentSlot = (value: unknown): EquipmentSlot | null => {
  const raw = (asString(value) ?? '').toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')
  if (['body', 'chest', 'armor', 'body-armor'].includes(raw)) return 'body'
  if (['hand', 'hands', 'glove', 'gloves', 'arm'].includes(raw)) return 'hand'
  if (['edc', 'accessory', 'accessories', 'device'].includes(raw)) return 'edc'
  return null
}

const firstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    const stringValue = asString(value)
    if (stringValue) return stringValue
  }
  return null
}

const firstNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const numberValue = asNumber(value)
    if (numberValue !== null) return numberValue
  }
  return null
}

const unwrapList = (raw: unknown, keys: string[]): unknown[] => {
  if (Array.isArray(raw)) return raw
  const record = asRecord(raw)
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[]
  }
  if (Array.isArray(record.items)) return record.items
  if (Array.isArray(record.data)) return record.data
  return []
}

const collectionMeta = (raw: unknown): UnknownRecord => {
  const record = asRecord(raw)
  return asRecord(record.meta ?? record.dataset ?? record)
}

const normalizeSkillType = (value: unknown): SkillType => {
  const raw = (asString(value) ?? '').toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')
  if (['battle', 'combat', 'skill', '战技', '戰鬥技能', 'battle-skill'].includes(raw)) {
    return 'battle'
  }
  if (['combo', 'link', 'chain', '连携', '連攜', 'combo-skill'].includes(raw)) return 'combo'
  if (['ultimate', 'ult', 'burst', '终结', '終結', 'ultimate-skill'].includes(raw)) {
    return 'ultimate'
  }
  return 'other'
}

const triggerConditions = (raw: UnknownRecord): string[] => {
  const trigger = asRecord(raw.trigger)
  const conditions =
    raw.triggerConditions ??
    raw.triggerCondition ??
    raw.conditions ??
    trigger.conditions ??
    raw.condition

  if (Array.isArray(conditions)) return asStringArray(conditions)
  const condition = asString(conditions)
  return condition ? [condition] : []
}

const normalizeSkill = (
  rawValue: unknown,
  fallbackType: SkillType,
  characterId: string,
  index: number,
): SkillFact | null => {
  const raw = asRecord(rawValue)
  if (Object.keys(raw).length === 0) return null

  const type = normalizeSkillType(raw.type ?? raw.skillType ?? raw.kind ?? fallbackType)
  const id =
    firstString(raw.id, raw.skillId, raw.code) ?? `${characterId}-${type}-${index + 1}`
  const sharedCost =
    type === 'battle'
      ? firstNumber(raw.sharedSkillPointCost, raw.skillPointCost, raw.spCost, raw.cost)
      : null
  const energyCost =
    type === 'ultimate'
      ? firstNumber(raw.energyCost, raw.energy, raw.ultimateEnergy, raw.cost)
      : null
  const resource =
    type === 'battle'
      ? 'shared_skill_points'
      : type === 'combo'
        ? 'none'
        : type === 'ultimate'
          ? 'energy'
          : 'unknown'

  return {
    id,
    name: toTraditional(firstString(raw.name, raw.title, raw.displayName)) ?? id,
    type,
    resource,
    description: toTraditional(firstString(raw.description, raw.summary, raw.effect)),
    tags: toTraditionalList(asStringArray(raw.tags ?? raw.effectTags ?? raw.labels)) ?? [],
    triggerConditions: toTraditionalList(triggerConditions(raw)) ?? [],
    cooldownSeconds: firstNumber(raw.cooldownSeconds, raw.cooldown, raw.cd),
    energyCost,
    sharedSkillPointCost: sharedCost,
    sourceIds: asStringArray(raw.sourceIds ?? raw.sources),
  }
}

const collectSkills = (raw: UnknownRecord, characterId: string): SkillFact[] => {
  const skills: SkillFact[] = []
  const skillContainer = raw.skills ?? raw.skillList ?? raw.abilities

  if (Array.isArray(skillContainer)) {
    skillContainer.forEach((value, index) => {
      const skill = normalizeSkill(value, 'other', characterId, index)
      if (skill) skills.push(skill)
    })
  } else {
    const container = asRecord(skillContainer)
    for (const [key, value] of Object.entries(container)) {
      if (value === null || typeof value !== 'object') continue
      const skill = normalizeSkill(value, normalizeSkillType(key), characterId, skills.length)
      if (skill) skills.push(skill)
    }
  }

  const directSkills = [
    ['battleSkill', 'battle'],
    ['comboSkill', 'combo'],
    ['ultimateSkill', 'ultimate'],
  ] as const
  for (const [key, type] of directSkills) {
    const skill = normalizeSkill(raw[key], type, characterId, skills.length)
    if (skill) skills.push(skill)
  }

  return [...new Map(skills.map((skill) => [`${skill.id}:${skill.type}`, skill])).values()]
}

const normalizeCharacter = (rawValue: unknown, index: number): CharacterFact | null => {
  const raw = asRecord(rawValue)
  const id = firstString(raw.id, raw.characterId, raw.slug, raw.code)
  if (!id) return null
  const names = asRecord(raw.names)
  const name = firstString(
    names.zhHant,
    names.zhHans,
    names.zh,
    raw.name,
    raw.displayName,
    id,
  )
  if (!name) return null

  return {
    id,
    name: toTraditional(name) ?? name,
    nameEn: firstString(raw.nameEn, raw.englishName, names.en),
    rarity: firstNumber(raw.rarity, raw.stars),
    profession: toTraditional(
      firstString(raw.profession, raw.class, raw.role, raw.position),
    ),
    element: toTraditional(firstString(raw.element, raw.attribute, raw.damageType)),
    roles: toTraditionalList(asStringArray(raw.roles ?? raw.roleTags ?? raw.positions)) ?? [],
    tags: toTraditionalList(asStringArray(raw.tags ?? raw.labels)) ?? [],
    portraitUrl: firstString(raw.portraitUrl, raw.avatar, raw.avatarUrl, raw.image),
    skills: collectSkills(raw, id),
    sourceIds: asStringArray(raw.sourceIds ?? raw.sources),
  }
}

const normalizeTeamPreset = (rawValue: unknown, index: number): TeamPreset | null => {
  const raw = asRecord(rawValue)
  const id = firstString(raw.id, raw.teamId, raw.presetId) ?? `team-${index + 1}`

  const slotRecords = Array.isArray(raw.slots)
    ? raw.slots.map(asRecord)
    : Array.isArray(raw.members)
      ? raw.members.map(asRecord)
      : []
  const fromSlots = slotRecords
    .map((slot) => firstString(slot.characterId, slot.id, slot.character))
    .filter((value): value is string => Boolean(value))
  const characterIds = asStringArray(raw.characterIds ?? raw.characters ?? raw.memberIds)
  const resolvedIds = characterIds.length ? characterIds : fromSlots
  if (!resolvedIds.length) return null

  const alternativesRecord = asRecord(raw.alternatives)
  const alternatives: Record<string, string[]> = {}
  for (const [characterId, values] of Object.entries(alternativesRecord)) {
    alternatives[characterId] = asStringArray(values)
  }
  for (const slot of slotRecords) {
    const characterId = firstString(slot.characterId, slot.id, slot.character)
    if (characterId) alternatives[characterId] = asStringArray(slot.alternatives)
  }

  return {
    id,
    name: toTraditional(firstString(raw.name, raw.title, raw.label)) ?? id,
    description: toTraditional(firstString(raw.description, raw.summary, raw.notes)),
    characterIds: [...new Set(resolvedIds)],
    alternatives,
    tags: toTraditionalList(asStringArray(raw.tags ?? raw.teamTags ?? raw.labels)) ?? [],
    sourceIds: asStringArray(raw.sourceIds ?? raw.sources),
    confidence: firstNumber(raw.confidence, raw.score),
  }
}

const normalizeRotationStep = (rawValue: unknown, index: number, rotationId: string): RotationStep | null => {
  const raw = asRecord(rawValue)
  const characterId = firstString(raw.characterId, raw.character, raw.memberId)
  const skillName = firstString(raw.skillName, raw.name, raw.action, raw.title)
  if (!characterId || !skillName) return null

  return {
    id: firstString(raw.id, raw.stepId) ?? `${rotationId}-step-${index + 1}`,
    order: firstNumber(raw.order, raw.index) ?? index + 1,
    phase: toTraditional(firstString(raw.phase, raw.stage, raw.section)),
    characterId,
    skillId: firstString(raw.skillId, raw.skill),
    skillName: toTraditional(skillName) ?? skillName,
    skillType: normalizeSkillType(raw.skillType ?? raw.type ?? raw.skill),
    triggerCondition: toTraditional(
      firstString(
      raw.triggerCondition,
      raw.trigger,
      raw.condition,
      Array.isArray(raw.conditions) ? raw.conditions.map(String).join(' / ') : null,
      raw.timing,
      ),
    ),
    waitFor: toTraditional(
      firstString(raw.waitFor, raw.waitCondition, raw.wait, raw.precondition),
    ),
    comboWindowSeconds: firstNumber(raw.comboWindowSeconds, raw.comboWindow, raw.windowSeconds),
    sharedSkillPointCost: firstNumber(raw.sharedSkillPointCost, raw.skillPointCost, raw.spCost),
    energyCost: firstNumber(raw.energyCost, raw.energy),
    cooldownSeconds: firstNumber(raw.cooldownSeconds, raw.cooldown, raw.cd),
    warnings: toTraditionalList(asStringArray(raw.warnings ?? raw.caveats)) ?? [],
    note: toTraditional(firstString(raw.note, raw.notes, raw.description)),
  }
}

const normalizeRotation = (rawValue: unknown, index: number): RotationPreset | null => {
  const raw = asRecord(rawValue)
  const id = firstString(raw.id, raw.rotationId) ?? `rotation-${index + 1}`
  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .map((step, stepIndex) => normalizeRotationStep(step, stepIndex, id))
    .filter((step): step is RotationStep => Boolean(step))
    .sort((a, b) => a.order - b.order)
  if (!steps.length) return null

  return {
    id,
    name: toTraditional(firstString(raw.name, raw.title, raw.label)) ?? id,
    teamPresetId: firstString(raw.teamPresetId, raw.teamId, raw.presetId),
    characterIds: asStringArray(raw.characterIds ?? raw.characters ?? raw.members),
    scenario: toTraditional(firstString(raw.scenario, raw.mode, raw.content)),
    description: toTraditional(firstString(raw.description, raw.summary, raw.notes)),
    steps,
    sourceIds: asStringArray(raw.sourceIds ?? raw.sources),
    confidence: firstNumber(raw.confidence, raw.score),
  }
}

const normalizeEquipment = (rawValue: unknown, index: number): EquipmentFact | null => {
  const raw = asRecord(rawValue)
  const id = firstString(raw.id, raw.equipmentId, raw.slug, raw.code)
  if (!id) return null
  const unlock = asRecord(raw.unlock ?? raw.unlockRequirement ?? raw.requirements)
  const unlockDetails = asRecord(
    raw.unlockDetails ?? raw.recipeUnlock ?? raw.formulaUnlock ?? raw.formula,
  )
  const statsRecord = asRecord(raw.stats ?? raw.attributes)
  const stats: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(statsRecord)) {
    if (typeof value === 'string' || typeof value === 'number') stats[key] = value
  }
  const statTypesRecord = asRecord(raw.statTypes ?? raw.attributeTypes)
  const statTypes: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(statTypesRecord)) {
    if (value === null || typeof value === 'string') statTypes[key] = value
  }

  return {
    id,
    name: toTraditional(firstString(raw.name, raw.displayName, raw.title)) ?? id,
    slot: normalizeEquipmentSlot(raw.slot ?? raw.type ?? raw.category),
    rarity: firstNumber(raw.rarity, raw.stars),
    setName: toTraditional(firstString(raw.setName, raw.set, asRecord(raw.set).name)),
    craftable: asBoolean(raw.craftable ?? raw.canCraft ?? raw.craftableAt),
    unlock: {
      playerLevel: firstNumber(unlock.playerLevel, unlock.level, raw.playerLevel),
      playerLevelKind: firstString(unlock.playerLevelKind, raw.playerLevelKind),
      chapterId: firstString(unlock.chapterId, unlock.chapter, raw.chapterId),
      chapterOrder: firstNumber(unlock.chapterOrder, uncoverOrder(raw)),
      materials: toTraditionalList(asStringArray(unlock.materials ?? raw.materials)) ?? [],
    },
    formulaAuthorityRank: firstNumber(
      unlockDetails.authorityRank,
      raw.authorityRank,
      raw.formulaAuthorityRank,
    ),
    recipeTier: firstString(unlockDetails.recipeTier, raw.recipeTier),
    formulaId: firstString(unlockDetails.formulaId, raw.formulaId),
    domainName: toTraditional(firstString(unlockDetails.domainName, raw.domainName)),
    recommendedFor: asStringArray(
      raw.recommendedFor ?? raw.characterIds ?? raw.suitableFor ?? raw.recommendedCharacters,
    ),
    roleTags:
      toTraditionalList(asStringArray(raw.roleTags ?? raw.roles ?? raw.suitableRoles)) ?? [],
    elementTags:
      toTraditionalList(asStringArray(raw.elementTags ?? raw.elements ?? raw.suitableElements)) ?? [],
    statTypes,
    stats,
    description: toTraditional(firstString(raw.description, raw.effect, raw.summary)),
    sourceIds: asStringArray(raw.sourceIds ?? raw.sources),
  }
}

const uncoverOrder = (raw: UnknownRecord): unknown => {
  const unlock = asRecord(raw.unlock ?? raw.unlockRequirement ?? raw.requirements)
  return unlock.order ?? unlock.chapterOrder
}

const normalizeChapter = (rawValue: unknown, index: number): StoryChapter | null => {
  const raw = asRecord(rawValue)
  const id = firstString(raw.id, raw.chapterId, raw.slug)
  if (!id) return null
  return {
    id,
    name: toTraditional(firstString(raw.name, raw.title, raw.label)) ?? id,
    order: firstNumber(raw.order, raw.index, raw.sequence) ?? index + 1,
    minPlayerLevel: firstNumber(raw.minPlayerLevel, raw.playerLevel, raw.requiredLevel),
    sourceIds: asStringArray(raw.sourceIds ?? raw.sources),
  }
}

const normalizeSource = (rawValue: unknown, index: number): SourceRecord | null => {
  const raw = asRecord(rawValue)
  const id = firstString(raw.id, raw.sourceId, raw.slug)
  if (!id) return null
  return {
    id,
    title: toTraditional(firstString(raw.title, raw.name, raw.publisher)) ?? id,
    publisher: toTraditional(firstString(raw.publisher, raw.site, raw.author)),
    url: firstString(raw.url, raw.link, raw.href),
    fetchedAt: firstString(raw.fetchedAt, raw.scrapedAt, raw.retrievedAt),
    fields: toTraditionalList(asStringArray(raw.fields ?? raw.extractedFields)) ?? [],
  }
}

const normalizeMeta = (raw: unknown): DatasetMeta => {
  const record = asRecord(raw)
  const meta = asRecord(record.meta)
  const source = Object.keys(meta).length ? meta : record
  const coverage = asRecord(source.coverage)
  const unresolved = (Array.isArray(source.unresolved) ? source.unresolved : [])
    .map((value): DatasetUnresolved | null => {
      const item = asRecord(value)
      const subject = toTraditional(firstString(item.subject, item.field))
      const field = toTraditional(firstString(item.field))
      const reason = toTraditional(firstString(item.reason, item.note))
      if (!subject && !field && !reason) return null
      return {
        subject,
        field,
        reason,
        sourceIds: asStringArray(item.sourceIds ?? item.sources),
      }
    })
    .filter((item): item is DatasetUnresolved => Boolean(item))

  return {
    schemaVersion: firstString(source.schemaVersion, source.schema, source.contractVersion),
    dataVersion: firstString(source.dataVersion, source.version),
    gameVersion: firstString(source.gameVersion, source.game),
    generatedAt: firstString(source.generatedAt, source.fetchedAt, source.updatedAt),
    sourceCount: firstNumber(source.sourceCount, source.sources),
    notes: toTraditionalList(asStringArray(source.notes ?? source.warnings)) ?? [],
    missingSkillTypes: asStringArray(coverage.missingSkillTypes),
    partialFields: toTraditionalList(asStringArray(coverage.partialFields)) ?? [],
    unresolved,
    coverage,
  }
}

const percentage = (value: number, total: number): number | null =>
  total === 0 ? null : Math.round((value / total) * 100)

const calculateCoverage = (
  characters: CharacterFact[],
  equipment: EquipmentFact[],
  rotations: RotationPreset[],
): DatasetCoverage => {
  const missingFields = new Set<string>()
  let completeSkills = 0
  let sourcedCharacters = 0
  for (const character of characters) {
    const presentTypes = new Set(
      character.skills.filter((skill) => skill.name).map((skill) => skill.type),
    )
    const hasFullSkillSet =
      presentTypes.has('battle') &&
      presentTypes.has('combo') &&
      presentTypes.has('ultimate')
    if (hasFullSkillSet) completeSkills += 1
    else missingFields.add('characters.skills')
    if (character.sourceIds.length) sourcedCharacters += 1
    else missingFields.add('characters.sourceIds')
    if (!character.element) missingFields.add('characters.element')
    if (!character.profession) missingFields.add('characters.profession')
  }

  const gatedEquipment = equipment.filter(
    (item) => item.unlock.playerLevel !== null || item.unlock.chapterId !== null,
  ).length
  if (gatedEquipment < equipment.length) missingFields.add('equipment.unlock')
  const sourcedRotations = rotations.filter((rotation) => rotation.sourceIds.length).length
  if (sourcedRotations < rotations.length) missingFields.add('rotation-presets.sourceIds')

  return {
    characterSkillCoverage: percentage(completeSkills, characters.length),
    characterSourceCoverage: percentage(sourcedCharacters, characters.length),
    equipmentGateCoverage: percentage(gatedEquipment, equipment.length),
    rotationSourceCoverage: percentage(sourcedRotations, rotations.length),
    missingFields: [...missingFields].sort(),
  }
}

export interface RawDatasetFiles {
  'meta.json'?: unknown
  'characters.json'?: unknown
  'equipment.json'?: unknown
  'progressions.json'?: unknown
  'team-presets.json'?: unknown
  'rotation-presets.json'?: unknown
  'sources.json'?: unknown
}

export const parseDataset = (
  files: RawDatasetFiles,
  missingFiles: string[] = [],
  errors: string[] = [],
): Dataset => {
  const characters = unwrapList(files['characters.json'], ['characters', 'items'])
    .map(normalizeCharacter)
    .filter((item): item is CharacterFact => Boolean(item))

  const equipment = unwrapList(files['equipment.json'], ['equipment', 'items'])
    .map(normalizeEquipment)
    .filter((item): item is EquipmentFact => Boolean(item))

  const chapters = unwrapList(files['progressions.json'], ['chapters', 'progressions', 'items'])
    .map(normalizeChapter)
    .filter((item): item is StoryChapter => Boolean(item))

  const teamPresets = unwrapList(files['team-presets.json'], ['teams', 'presets', 'items'])
    .map(normalizeTeamPreset)
    .filter((item): item is TeamPreset => Boolean(item))

  const rotationPresets = unwrapList(files['rotation-presets.json'], ['rotations', 'presets', 'items'])
    .map(normalizeRotation)
    .filter((item): item is RotationPreset => Boolean(item))

  const sources = unwrapList(files['sources.json'], ['sources', 'items'])
    .map(normalizeSource)
    .filter((item): item is SourceRecord => Boolean(item))

  const meta = normalizeMeta(files['meta.json'])
  const computedCoverage = calculateCoverage(characters, equipment, rotationPresets)
  // Keep the computed coverage as source of truth; do not let metadata override it.

  return {
    meta,
    characters,
    equipment,
    chapters,
    teamPresets,
    rotationPresets,
    sources,
    loadedFiles: DATA_FILES.filter((file) => files[file] !== undefined),
    missingFiles: [...new Set(missingFiles)],
    errors,
    coverage: computedCoverage,
  }
}

const resolveDataUrl = (file: string): string => {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${base}data/v1/${file}`
}

const fetchJson = async (file: string, fetcher: typeof fetch): Promise<unknown> => {
  const response = await fetcher(resolveDataUrl(file), {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`)
  return response.json()
}

export const loadDataset = async (fetcher: typeof fetch = fetch): Promise<Dataset> => {
  const entries = await Promise.all(
    DATA_FILES.map(async (file) => {
      try {
        return [file, await fetchJson(file, fetcher), null] as const
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return [file, undefined, message] as const
      }
    }),
  )

  const files: RawDatasetFiles = {}
  const missingFiles: string[] = []
  const errors: string[] = []
  for (const [file, value, error] of entries) {
    if (value === undefined) {
      missingFiles.push(file)
      if (error) errors.push(error)
    } else {
      files[file] = value
    }
  }

  return parseDataset(files, missingFiles, errors)
}

export { DATA_FILES }

// Canonical data already excludes all non-playable Administrator forms and
// keeps only the A-form (chr_0002_endminm). Keep this policy and the
// sanitization below as a defensive guard for stale mirrors, fixtures and
// future crawler regressions. Excluded forms must never surface in the UI,
// search, filters, team presets, rotation presets or statistics.
export const EXCLUDED_CHARACTER_IDS = ['chr_0003_endminf', 'chr_9000_endmin'] as const

export const isExcludedCharacter = (id: string): boolean =>
  (EXCLUDED_CHARACTER_IDS as readonly string[]).includes(id)

// Returns a new Dataset with B-form admin removed from characters, and any
// reference to excluded ids stripped from team/rotation presets and equipment
// recommendations. Team presets must retain 1–4 unique characters after
// filtering; rotations keep their valid steps with contiguous ordering.
// Coverage is recomputed so statistics stay consistent.
export const sanitizeDataset = (dataset: Dataset): Dataset => {
  const visibleCharacters = dataset.characters.filter(
    (character) => !isExcludedCharacter(character.id),
  )
  // Build the exclusion set from the policy constant, not from the current
  // character list. Presets, rotations and equipment references must be
  // stripped even when the excluded character is already absent from
  // `dataset.characters`.
  const excluded = new Set<string>(EXCLUDED_CHARACTER_IDS)

  const stripIds = (ids: string[] = []): string[] => ids.filter((id) => !excluded.has(id))
  const stripAlternatives = (
    alternatives: Record<string, string[]>,
  ): Record<string, string[]> => {
    const next: Record<string, string[]> = {}
    for (const [characterId, values] of Object.entries(alternatives)) {
      if (excluded.has(characterId)) continue
      // Keep the key (even when emptied) so consumers can rely on its presence.
      next[characterId] = values.filter((id) => !excluded.has(id))
    }
    return next
  }

  const teamPresets = dataset.teamPresets.flatMap((team) => {
    const characterIds = stripIds(team.characterIds)
    if (
      characterIds.length < MIN_TEAM_SIZE ||
      characterIds.length > MAX_TEAM_SIZE ||
      new Set(characterIds).size !== characterIds.length
    ) {
      return []
    }
    return [
      {
        ...team,
        characterIds,
        alternatives: stripAlternatives(team.alternatives),
      },
    ]
  })

  const teamPresetIds = new Set(teamPresets.map((team) => team.id))
  const rotationPresets = dataset.rotationPresets.flatMap((rotation) => {
    const characterIds = stripIds(rotation.characterIds)
    // Keep the authored execution order, remove excluded-character steps, then
    // close any gaps in `order` so the rotation remains 1..n.
    const steps = rotation.steps
      .filter((step) => !excluded.has(step.characterId))
      .sort((a, b) => a.order - b.order)
      .map((step, index) => ({ ...step, order: index + 1 }))
    if (!characterIds.length || !steps.length) return []

    return [
      {
        ...rotation,
        // A rotation whose linked team was removed must not retain a dangling ID.
        teamPresetId:
          rotation.teamPresetId && teamPresetIds.has(rotation.teamPresetId)
            ? rotation.teamPresetId
            : null,
        characterIds,
        steps,
      },
    ]
  })

  const equipment = dataset.equipment.map((item) => ({
    ...item,
    recommendedFor: stripIds(item.recommendedFor),
  }))

  const missingSkillTypes = dataset.meta.missingSkillTypes.filter(
    (entry) => !excluded.has(entry.split(':')[0]),
  )
  const countSkills = (type: SkillType): number =>
    visibleCharacters.reduce(
      (total, character) =>
        total + character.skills.filter((skill) => skill.type === type).length,
      0,
    )
  const battleSkills = countSkills('battle')
  const comboSkills = countSkills('combo')
  const ultimateSkills = countSkills('ultimate')
  const sourceCoverage = asRecord(dataset.meta.coverage)
  const sourceSkillCoverage = asRecord(sourceCoverage.skills)
  const sourceEquipmentCoverage = asRecord(sourceCoverage.equipment)

  const meta = {
    ...dataset.meta,
    // Drop B-form entries from the missing-skill list so the gap panel never
    // surfaces an invisible character.
    missingSkillTypes,
    // `meta.coverage` is published alongside the raw dataset and is separate
    // from the computed `dataset.coverage`. Recompute every character-dependent
    // statistic so data panels cannot disclose the hidden B-form.
    coverage: {
      ...sourceCoverage,
      charactersWithSourceIds: visibleCharacters.filter(
        (character) => character.sourceIds.length > 0,
      ).length,
      playableCharacters: visibleCharacters.length,
      missingSkillTypes,
      skills: {
        ...sourceSkillCoverage,
        battle: battleSkills,
        combo: comboSkills,
        ultimate: ultimateSkills,
        total: battleSkills + comboSkills + ultimateSkills,
      },
      teamPresets: teamPresets.length,
      rotationPresets: rotationPresets.length,
      rotationSteps: rotationPresets.reduce(
        (total, rotation) => total + rotation.steps.length,
        0,
      ),
      storyChapters: dataset.chapters.length,
      equipment: {
        ...sourceEquipmentCoverage,
        total: equipment.length,
        withFormula: equipment.filter((item) => item.formulaId !== null).length,
        withMaterials: equipment.filter((item) => item.unlock.materials.length > 0)
          .length,
        withRecommendation: equipment.filter((item) => item.recommendedFor.length > 0)
          .length,
        withSet: equipment.filter((item) => item.setName !== null).length,
        withWearLevelGate: equipment.filter((item) => item.unlock.playerLevel !== null)
          .length,
      },
    },
  }

  const visibleDataset: Dataset = {
    ...dataset,
    meta,
    characters: visibleCharacters,
    teamPresets,
    rotationPresets,
    equipment,
  }
  visibleDataset.coverage = calculateCoverage(
    visibleCharacters,
    equipment,
    rotationPresets,
  )
  return visibleDataset
}
