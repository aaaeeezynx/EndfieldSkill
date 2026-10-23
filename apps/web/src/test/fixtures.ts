import type {
  CharacterFact,
  Dataset,
  DatasetCoverage,
  DatasetMeta,
  EquipmentFact,
  SkillFact,
  StoryChapter,
  TeamPreset,
} from '@/types/domain'

export const makeSkill = (id: string, overrides: Partial<SkillFact> = {}): SkillFact => ({
  id,
  name: id,
  type: 'battle',
  resource: 'shared_skill_points',
  description: null,
  tags: [],
  triggerConditions: [],
  cooldownSeconds: null,
  energyCost: null,
  sharedSkillPointCost: 1,
  sourceIds: [],
  ...overrides,
})

export const makeCharacter = (
  id: string,
  overrides: Partial<CharacterFact> = {},
): CharacterFact => ({
  id,
  name: id.toUpperCase(),
  nameEn: id.toUpperCase(),
  rarity: 5,
  profession: '攻击',
  element: '物理',
  roles: ['dps'],
  tags: [],
  portraitUrl: null,
  skills: [makeSkill(`${id}-battle`)],
  sourceIds: [`source-${id}`],
  ...overrides,
})

export const makeChapter = (
  id: string,
  overrides: Partial<StoryChapter> = {},
): StoryChapter => ({
  id,
  name: id,
  order: 1,
  minPlayerLevel: 1,
  sourceIds: [],
  ...overrides,
})

export const makeTeamPreset = (
  id: string,
  characterIds: string[],
  overrides: Partial<TeamPreset> = {},
): TeamPreset => ({
  id,
  name: id,
  description: null,
  characterIds,
  alternatives: {},
  tags: [],
  sourceIds: [`source-${id}`],
  confidence: null,
  ...overrides,
})

export const makeEquipment = (
  id: string,
  overrides: Partial<EquipmentFact> = {},
): EquipmentFact => ({
  id,
  name: id,
  slot: 'weapon',
  rarity: 3,
  setName: null,
  craftable: true,
  unlock: {
    playerLevel: 1,
    playerLevelKind: 'equipment_wear_level',
    chapterId: null,
    chapterOrder: null,
    materials: [],
  },
  formulaAuthorityRank: null,
  recipeTier: null,
  formulaId: null,
  domainName: null,
  recommendedFor: [],
  roleTags: [],
  elementTags: [],
  statTypes: {},
  stats: {},
  description: null,
  sourceIds: [],
  ...overrides,
})

const emptyMeta: DatasetMeta = {
  schemaVersion: null,
  dataVersion: null,
  gameVersion: null,
  generatedAt: null,
  sourceCount: null,
  notes: [],
  coverage: {},
}

const emptyCoverage: DatasetCoverage = {
  characterSkillCoverage: null,
  characterSourceCoverage: null,
  equipmentGateCoverage: null,
  rotationSourceCoverage: null,
  missingFields: [],
}

export const makeDataset = (overrides: Partial<Dataset> = {}): Dataset => ({
  meta: emptyMeta,
  characters: [],
  equipment: [],
  chapters: [],
  teamPresets: [],
  rotationPresets: [],
  sources: [],
  loadedFiles: [],
  missingFiles: [],
  errors: [],
  coverage: emptyCoverage,
  ...overrides,
})
