export type SkillType = 'battle' | 'combo' | 'ultimate' | 'other'

export type SkillResource = 'shared_skill_points' | 'energy' | 'none' | 'unknown'
export type EquipmentSlot = 'body' | 'hand' | 'edc'

export interface SkillFact {
  id: string
  name: string
  type: SkillType
  resource: SkillResource
  description: string | null
  tags: string[]
  triggerConditions: string[]
  cooldownSeconds: number | null
  energyCost: number | null
  sharedSkillPointCost: number | null
  sourceIds: string[]
}

export interface CharacterFact {
  id: string
  name: string
  nameEn: string | null
  rarity: number | null
  profession: string | null
  element: string | null
  roles: string[]
  tags: string[]
  portraitUrl: string | null
  skills: SkillFact[]
  sourceIds: string[]
}

export interface TeamPreset {
  id: string
  name: string
  description: string | null
  characterIds: string[]
  alternatives: Record<string, string[]>
  tags: string[]
  sourceIds: string[]
  confidence: number | null
}

export interface RotationStep {
  id: string
  order: number
  phase: string | null
  characterId: string
  skillId: string | null
  skillName: string
  skillType: SkillType
  triggerCondition: string | null
  waitFor: string | null
  comboWindowSeconds: number | null
  sharedSkillPointCost: number | null
  energyCost: number | null
  cooldownSeconds: number | null
  warnings: string[]
  note: string | null
}

export interface RotationDependency {
  characterId: string
  reason: string
}

export interface RotationPreset {
  id: string
  name: string
  teamPresetId: string | null
  characterIds: string[]
  matchType: 'complete' | 'fragment'
  dependencies: RotationDependency[]
  scenario: string | null
  description: string | null
  steps: RotationStep[]
  sourceIds: string[]
  confidence: number | null
  author: string | null
  videoTimestamp: string | null
  publishedAt: string | null
  triggerConditions: string[]
  waitConditions: string[]
  limitations: string[]
}

export interface EquipmentUnlock {
  playerLevel: number | null
  playerLevelKind: string | null
  chapterId: string | null
  chapterOrder: number | null
  materials: string[]
}

export interface EquipmentFact {
  id: string
  name: string
  slot: EquipmentSlot | null
  rarity: number | null
  setName: string | null
  craftable: boolean | null
  unlock: EquipmentUnlock
  formulaAuthorityRank: number | null
  recipeTier: string | null
  formulaId: string | null
  domainName: string | null
  recommendedFor: string[]
  roleTags: string[]
  elementTags: string[]
  stats: Record<string, string | number>
  statTypes?: Record<string, string | null>
  description: string | null
  sourceIds: string[]
}

export interface StoryChapter {
  id: string
  name: string
  order: number
  minPlayerLevel: number | null
  sourceIds: string[]
}

export interface SourceRecord {
  id: string
  title: string
  publisher: string | null
  url: string | null
  fetchedAt: string | null
  fields: string[]
  author: string | null
  publishedAt: string | null
  videoTimestamp: string | null
  notes: string[]
}

export interface DatasetMeta {
  schemaVersion: string | null
  dataVersion: string | null
  gameVersion: string | null
  generatedAt: string | null
  sourceCount: number | null
  notes: string[]
  missingSkillTypes: string[]
  partialFields: string[]
  unresolved: DatasetUnresolved[]
  coverage: Record<string, unknown>
}

export interface DatasetUnresolved {
  subject: string | null
  field: string | null
  reason: string | null
  sourceIds: string[]
}

export interface DatasetCoverage {
  characterSkillCoverage: number | null
  characterSourceCoverage: number | null
  equipmentGateCoverage: number | null
  rotationSourceCoverage: number | null
  missingFields: string[]
}

export interface Dataset {
  meta: DatasetMeta
  characters: CharacterFact[]
  // The visible roster after excluded forms are removed (currently 33).
  // `characters` is the visible, B-form-excluded view used by all UI paths.
  equipment: EquipmentFact[]
  chapters: StoryChapter[]
  teamPresets: TeamPreset[]
  rotationPresets: RotationPreset[]
  sources: SourceRecord[]
  loadedFiles: string[]
  missingFiles: string[]
  errors: string[]
  coverage: DatasetCoverage
}

export interface TeamMatch {
  preset: TeamPreset
  score: number
  exact: boolean
  matchedCharacterIds: string[]
  missingCharacterIds: string[]
  extraCharacterIds: string[]
  sourceBacked: boolean
}

export type RotationChoiceKind = 'source-backed' | 'source-fragment' | 'unavailable'

export interface RotationChoice {
  id: string
  name: string
  kind: RotationChoiceKind
  matchType: 'complete' | 'fragment' | null
  dependencies: RotationDependency[]
  description: string
  steps: RotationStep[]
  warnings: string[]
  sourceIds: string[]
  confidence: number | null
  presetId: string | null
  author: string | null
  videoTimestamp: string | null
  publishedAt: string | null
  triggerConditions: string[]
  waitConditions: string[]
  limitations: string[]
  matchedCharacterIds: string[]
}

export type UnlockState = 'unlocked' | 'locked' | 'unknown' | 'not-craftable'

export interface EquipmentCandidate {
  equipment: EquipmentFact
  score: number
  unlockState: UnlockState
  gateLabels: string[]
  matchNotes: string[]
}

export interface EquipmentSlotRecommendation {
  slot: EquipmentSlot
  target: EquipmentCandidate | null
  available: EquipmentCandidate | null
  alternatives: EquipmentCandidate[]
  warnings: string[]
}

export interface EquipmentLoadout {
  characterId: string
  slots: Record<EquipmentSlot, EquipmentSlotRecommendation>
  warnings: string[]
}

export interface RecommendationReport {
  teamMatches: TeamMatch[]
  exactTeam: TeamMatch | null
  rotations: RotationChoice[]
  equipment: EquipmentLoadout[]
  teamTags: string[]
  warnings: string[]
}
