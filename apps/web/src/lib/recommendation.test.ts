import { describe, expect, it } from 'vitest'
import {
  buildRecommendationReport,
  buildRotationChoices,
  buildRuleRotation,
  matchTeamPresets,
  recommendEquipmentForCharacter,
} from '@/lib/recommendation'
import type { RotationPreset } from '@/types/domain'
import {
  makeChapter,
  makeCharacter,
  makeDataset,
  makeEquipment,
  makeSkill,
  makeTeamPreset,
} from '@/test/fixtures'

const roster = ['a', 'b', 'c', 'd'].map((id) => makeCharacter(id))

const makeRotation = (
  id: string,
  characterIds: string[],
  overrides: Partial<RotationPreset> = {},
): RotationPreset => ({
  id,
  name: id,
  teamPresetId: null,
  characterIds,
  scenario: null,
  description: null,
  steps: characterIds.map((characterId, index) => ({
    id: `${id}-step-${index + 1}`,
    order: index + 1,
    phase: '攻略窗口',
    characterId,
    skillId: `${characterId}-battle`,
    skillName: `${characterId} 戰技`,
    skillType: 'battle',
    triggerCondition: null,
    waitFor: null,
    comboWindowSeconds: null,
    sharedSkillPointCost: 1,
    energyCost: null,
    cooldownSeconds: null,
    warnings: [],
    note: null,
  })),
  sourceIds: ['source-guide'],
  confidence: 0.8,
  ...overrides,
})

describe('team matching', () => {
  it('ranks an exact source team above a partial team deterministically', () => {
    const exact = makeTeamPreset('team-exact', ['d', 'c', 'b', 'a'])
    const partial = makeTeamPreset('team-partial', ['a', 'b', 'c', 'e'])

    const matches = matchTeamPresets(['a', 'b', 'c', 'd'], [partial, exact])

    expect(matches.map((match) => match.preset.id)).toEqual(['team-exact', 'team-partial'])
    expect(matches[0]).toMatchObject({
      exact: true,
      score: 100,
      sourceBacked: true,
    })
    expect(matches[1]).toMatchObject({
      exact: false,
      matchedCharacterIds: ['a', 'b', 'c'],
      missingCharacterIds: ['e'],
    })
  })

  it('prefers a verified exact-team rotation and otherwise labels the rule fallback', () => {
    const team = makeTeamPreset('team-exact', ['a', 'b', 'c', 'd'])
    const rotation = makeRotation('rotation-exact', ['a', 'b', 'c', 'd'], {
      teamPresetId: team.id,
    })
    const verified = makeDataset({
      characters: roster,
      teamPresets: [team],
      rotationPresets: [rotation],
    })
    const verifiedReport = buildRecommendationReport(verified, ['a', 'b', 'c', 'd'], {
      playerLevel: 20,
      chapterId: null,
    })

    expect(verifiedReport.exactTeam?.preset.id).toBe(team.id)
    expect(verifiedReport.rotations[0]).toMatchObject({
      id: rotation.id,
      kind: 'source-backed',
      sourceIds: ['source-guide'],
    })

    const fallbackReport = buildRecommendationReport(makeDataset({ characters: roster }), [
      'a',
      'b',
      'c',
      'd',
    ], {
      playerLevel: 20,
      chapterId: null,
    })

    expect(fallbackReport.exactTeam).toBeNull()
    expect(fallbackReport.rotations).toHaveLength(1)
    expect(fallbackReport.rotations[0].kind).toBe('rule-generated')
    expect(fallbackReport.rotations[0].warnings).toContain('規則生成，待人工核對')
    expect(fallbackReport.warnings).toContain(
      '沿用標籤規則回退循環，不能視為已驗證攻略。',
    )
    expect(buildRotationChoices(makeDataset({ characters: roster }), ['a'], null)[0].kind).toBe(
      'rule-generated',
    )
  })

  it('treats a selected subset of a guide team as partial, never as an exact team', () => {
    const sourceTeam = makeTeamPreset('team-source', ['a', 'b', 'c', 'd'])

    const [match] = matchTeamPresets(['a', 'b', 'c'], [sourceTeam])

    expect(match).toMatchObject({
      exact: false,
      matchedCharacterIds: ['a', 'b', 'c'],
      missingCharacterIds: ['d'],
      extraCharacterIds: [],
    })
  })

  it('falls back to a rule rotation when only a subset of a source team is selected', () => {
    const team = makeTeamPreset('team-source', ['a', 'b', 'c', 'd'])
    const rotation = makeRotation('rotation-source', ['a', 'b', 'c', 'd'], {
      teamPresetId: team.id,
    })
    const dataset = makeDataset({
      characters: roster,
      teamPresets: [team],
      rotationPresets: [rotation],
    })

    const report = buildRecommendationReport(dataset, ['a', 'b', 'c'], {
      playerLevel: 20,
      chapterId: null,
    })

    expect(report.exactTeam).toBeNull()
    expect(report.teamMatches[0]).toMatchObject({
      exact: false,
      matchedCharacterIds: ['a', 'b', 'c'],
      missingCharacterIds: ['d'],
    })
    expect(report.rotations[0].kind).toBe('rule-generated')
    expect(report.warnings).toContain(
      '目前選擇的 3 名角色未與任何攻略隊伍完全一致；隊伍摘要來自部分匹配，不代表攻略隊伍已完整重現。',
    )
  })

  it('supports exact and source-backed guide presets whose recorded team is smaller than four', () => {
    const team = makeTeamPreset('team-three', ['a', 'b', 'c'])
    const rotation = makeRotation('rotation-three', ['a', 'b', 'c'], {
      teamPresetId: team.id,
    })
    const dataset = makeDataset({
      characters: roster,
      teamPresets: [team],
      rotationPresets: [rotation],
    })

    const report = buildRecommendationReport(dataset, ['c', 'a', 'b'], {
      playerLevel: 20,
      chapterId: null,
    })

    expect(report.exactTeam?.preset.id).toBe(team.id)
    expect(report.rotations[0]).toMatchObject({
      id: rotation.id,
      kind: 'source-backed',
    })
  })

  it.each([
    [['a']],
    [['a', 'b']],
    [['a', 'b', 'c']],
    [['a', 'b', 'c', 'd']],
  ])('returns equipment and a skill loop for a %j roster', (selectedIds) => {
    const report = buildRecommendationReport(makeDataset({ characters: roster }), selectedIds, {
      playerLevel: 20,
      chapterId: null,
    })

    expect(report.equipment.map((loadout) => loadout.characterId)).toEqual(selectedIds)
    expect(report.rotations).toHaveLength(1)
    expect(report.rotations[0].kind).toBe('rule-generated')
    expect(new Set(report.rotations[0].steps.map((step) => step.characterId))).toEqual(
      new Set(selectedIds),
    )
  })
})

describe('rule rotation battle mechanics', () => {
  it('keeps shared SP, combo trigger/window, and ultimate energy as distinct constraints', () => {
    const hero = makeCharacter('a', {
      name: '測試幹員',
      skills: [
        makeSkill('battle', {
          name: '戰術戰技',
          type: 'battle',
          resource: 'shared_skill_points',
          sharedSkillPointCost: 2,
          tags: ['debuff-enemy'],
        }),
        makeSkill('combo', {
          name: '條件連攜',
          type: 'combo',
          resource: 'none',
          sharedSkillPointCost: null,
          triggerConditions: ['目標處於失衡'],
          cooldownSeconds: 14,
          tags: ['break-shield'],
        }),
        makeSkill('ultimate', {
          name: '終結打擊',
          type: 'ultimate',
          resource: 'energy',
          energyCost: 80,
          sharedSkillPointCost: null,
        }),
      ],
    })

    const rotation = buildRuleRotation([hero])
    const battle = rotation.steps.find((step) => step.skillType === 'battle')
    const combo = rotation.steps.find((step) => step.skillType === 'combo')
    const ultimate = rotation.steps.find((step) => step.skillType === 'ultimate')

    expect(battle?.sharedSkillPointCost).toBe(2)
    expect(combo).toMatchObject({
      sharedSkillPointCost: null,
      triggerCondition: '目標處於失衡',
      comboWindowSeconds: null,
      cooldownSeconds: 14,
    })
    expect(combo?.waitFor).toBe('目標處於失衡')
    expect(combo?.warnings).toContain('規則生成，待人工核對')
    expect(ultimate).toMatchObject({
      energyCost: 80,
      sharedSkillPointCost: null,
    })
  })

  it('deduplicates only identical character-skill records and keeps duplicate ids across characters', () => {
    const first = makeCharacter('a', {
      skills: [
        makeSkill('shared-id', { type: 'battle' }),
        makeSkill('shared-id', { type: 'battle' }),
      ],
    })
    const second = makeCharacter('b', {
      skills: [makeSkill('shared-id', { type: 'battle' })],
    })

    const rotation = buildRuleRotation([first, second])

    expect(rotation.steps).toHaveLength(2)
    expect(rotation.steps.map((step) => step.characterId)).toEqual(['a', 'b'])
  })

  it('caps rule output at 12 steps while preserving ultimate skills', () => {
    const characters = Array.from({ length: 14 }, (_, index) =>
      makeCharacter(`hero-${index + 1}`, {
        skills: [
          makeSkill(`battle-${index + 1}`, { type: 'battle' }),
          makeSkill(`combo-${index + 1}`, {
            type: 'combo',
            resource: 'none',
            sharedSkillPointCost: null,
            triggerConditions: ['條件成立'],
          }),
          makeSkill(`ultimate-${index + 1}`, {
            type: 'ultimate',
            resource: 'energy',
            sharedSkillPointCost: null,
            energyCost: 80,
          }),
        ],
      }),
    )

    const rotation = buildRuleRotation(characters)
    const ultimateCount = rotation.steps.filter((step) => step.skillType === 'ultimate').length

    expect(rotation.steps).toHaveLength(12)
    expect(ultimateCount).toBe(12)
    expect(new Set(rotation.steps.map((step) => step.characterId)).size).toBe(12)
  })
})

describe('three-slot equipment gates', () => {
  const hero = makeCharacter('a', {
    roles: ['dps'],
    element: 'cold',
  })
  const chapters = [
    makeChapter('chapter-1', { order: 1 }),
    makeChapter('chapter-2', { order: 2 }),
    makeChapter('chapter-3', { order: 3 }),
  ]

  it('always returns body, hand, and edc slots without crossing equipment categories', () => {
    const dataset = makeDataset({
      characters: [hero],
      chapters,
      equipment: [
        makeEquipment('body-a', {
          slot: 'body',
          rarity: 4,
          recommendedFor: [hero.id],
        }),
        makeEquipment('hand-a', {
          slot: 'hand',
          rarity: 5,
          recommendedFor: [hero.id],
        }),
        makeEquipment('edc-a', {
          slot: 'edc',
          rarity: 3,
          recommendedFor: [hero.id],
        }),
        makeEquipment('slot-unknown', {
          slot: null,
          rarity: 6,
          recommendedFor: [hero.id],
        }),
      ],
    })

    const loadout = recommendEquipmentForCharacter(dataset, hero, {
      playerLevel: 25,
      chapterId: 'chapter-2',
    })

    expect(Object.keys(loadout.slots)).toEqual(['body', 'hand', 'edc'])
    expect(loadout.slots.body.target?.equipment.id).toBe('body-a')
    expect(loadout.slots.hand.target?.equipment.id).toBe('hand-a')
    expect(loadout.slots.edc.target?.equipment.id).toBe('edc-a')
  })

  it('shows a high-score locked target separately from the best unlocked item', () => {
    const dataset = makeDataset({
      characters: [hero],
      chapters,
      equipment: [
        makeEquipment('best-locked', {
          rarity: 6,
          recommendedFor: [hero.id],
          roleTags: ['dps'],
          sourceIds: ['guide'],
          unlock: {
            playerLevel: 40,
            playerLevelKind: 'equipment_wear_level',
            chapterId: 'chapter-3',
            chapterOrder: 3,
            materials: ['material-a'],
          },
        }),
        makeEquipment('craftable-now', {
          rarity: 3,
          roleTags: ['dps'],
          unlock: {
            playerLevel: 10,
            playerLevelKind: 'equipment_wear_level',
            chapterId: 'chapter-1',
            chapterOrder: 1,
            materials: [],
          },
        }),
        makeEquipment('fallback-now', {
          rarity: 2,
          roleTags: ['dps'],
          unlock: {
            playerLevel: 5,
            playerLevelKind: 'equipment_wear_level',
            chapterId: 'chapter-1',
            chapterOrder: 1,
            materials: [],
          },
        }),
      ],
    })

    const body = recommendEquipmentForCharacter(dataset, hero, {
      playerLevel: 25,
      chapterId: 'chapter-2',
    }).slots.body

    expect(body.target?.equipment.id).toBe('best-locked')
    expect(body.target?.unlockState).toBe('locked')
    expect(body.available?.equipment.id).toBe('craftable-now')
    expect(body.available?.unlockState).toBe('unlocked')
    expect(body.alternatives.map((item) => item.equipment.id)).toEqual(['fallback-now'])
    expect(body.warnings).toContain('此部位最高分裝備尚未達到已知穿戴門檻')
  })

  it('never counts an unknown equipment gate as currently available', () => {
    const dataset = makeDataset({
      characters: [hero],
      chapters,
      equipment: [
        makeEquipment('unknown-gate', {
          rarity: 5,
          recommendedFor: [hero.id],
          unlock: {
            playerLevel: null,
            playerLevelKind: 'equipment_wear_level',
            chapterId: null,
            chapterOrder: null,
            materials: [],
          },
        }),
      ],
    })

    const body = recommendEquipmentForCharacter(dataset, hero, {
      playerLevel: 99,
      chapterId: 'chapter-3',
    }).slots.body

    expect(body.target?.unlockState).toBe('unknown')
    expect(body.available).toBeNull()
    expect(body.alternatives).toEqual([])
    expect(body.warnings).toContain('此部位目前沒有可確認通過已知穿戴門檻的裝備')
  })

  it('does not duplicate target as available and caps alternatives at two items', () => {
    const dataset = makeDataset({
      characters: [hero],
      chapters,
      equipment: Array.from({ length: 5 }, (_, index) =>
        makeEquipment(`unlocked-${index + 1}`, {
          rarity: 6 - index,
          recommendedFor: [hero.id],
        }),
      ),
    })

    const body = recommendEquipmentForCharacter(dataset, hero, {
      playerLevel: 25,
      chapterId: 'chapter-2',
    }).slots.body

    expect(body.target?.equipment.id).toBe('unlocked-1')
    expect(body.target?.unlockState).toBe('unlocked')
    expect(body.available).toBeNull()
    expect(body.alternatives.map((item) => item.equipment.id)).toEqual([
      'unlocked-2',
      'unlocked-3',
    ])
  })

  it('labels formula authority and chapter limits without claiming verified crafting access', () => {
    const dataset = makeDataset({
      characters: [hero],
      chapters: [],
      equipment: [
        makeEquipment('wear-gated-gear', {
          rarity: 4,
          formulaAuthorityRank: 7,
          recipeTier: 'III',
          unlock: {
            playerLevel: 15,
            playerLevelKind: 'equipment_wear_level',
            chapterId: null,
            chapterOrder: null,
            materials: ['material-a'],
          },
        }),
      ],
    })

    const loadout = recommendEquipmentForCharacter(dataset, hero, {
      playerLevel: 25,
      chapterId: null,
    })
    const body = loadout.slots.body

    expect(body.target?.gateLabels).toEqual([
      '裝備穿戴等級 Lv.15',
      '配方權限要求 Rank 7',
      '配方階級 III',
    ])
    expect(body.available).toBeNull()
    expect(body.warnings).toContain(
      '配方權限要求尚未由劇情或權限進度自動判定，請進入遊戲核對',
    )
    expect(loadout.warnings).toContain(
      '章節與權限解鎖資料尚未核驗；本次僅確認已知裝備穿戴等級',
    )
  })

  it('labels only role and element tags that intersect the character', () => {
    const dataset = makeDataset({
      characters: [hero],
      chapters,
      equipment: [
        makeEquipment('best-but-locked', {
          rarity: 6,
          roleTags: ['dps'],
          elementTags: ['cold'],
          unlock: {
            playerLevel: 40,
            playerLevelKind: 'equipment_wear_level',
            chapterId: 'chapter-3',
            chapterOrder: 3,
            materials: [],
          },
        }),
        makeEquipment('matching-dps', {
          rarity: 4,
          roleTags: ['dps'],
          elementTags: ['cold'],
          unlock: {
            playerLevel: 10,
            playerLevelKind: 'equipment_wear_level',
            chapterId: 'chapter-1',
            chapterOrder: 1,
            materials: [],
          },
        }),
        makeEquipment('for-other-role', {
          rarity: 6,
          roleTags: ['support'],
          unlock: {
            playerLevel: 10,
            playerLevelKind: 'equipment_wear_level',
            chapterId: 'chapter-1',
            chapterOrder: 1,
            materials: [],
          },
        }),
        makeEquipment('for-other-character', {
          rarity: 6,
          recommendedFor: ['another-character'],
          unlock: {
            playerLevel: 10,
            playerLevelKind: 'equipment_wear_level',
            chapterId: 'chapter-1',
            chapterOrder: 1,
            materials: [],
          },
        }),
      ],
    })

    const body = recommendEquipmentForCharacter(dataset, hero, {
      playerLevel: 25,
      chapterId: 'chapter-2',
    }).slots.body

    expect(body.available?.equipment.id).toBe('matching-dps')
    expect(body.available?.matchNotes).toEqual([
      '定位匹配 · 輸出',
      '元素匹配 · 寒冷',
    ])
    expect(body.available?.matchNotes.some((note) => note === '定位匹配')).toBe(false)
  })
})
