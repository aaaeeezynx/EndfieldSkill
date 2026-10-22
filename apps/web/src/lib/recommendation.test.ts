import { describe, expect, it } from 'vitest'
import {
  buildRecommendationReport,
  buildRotationChoices,
  buildRuleRotation,
  matchTeamPresets,
  recommendEquipmentForCharacter,
} from '@/lib/recommendation'
import {
  makeChapter,
  makeCharacter,
  makeDataset,
  makeEquipment,
  makeSkill,
  makeTeamPreset,
} from '@/test/fixtures'

const roster = ['a', 'b', 'c', 'd'].map((id) => makeCharacter(id))

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

  it('uses a clearly labelled rule fallback when no exact rotation exists', () => {
    const dataset = makeDataset({ characters: roster })
    const report = buildRecommendationReport(dataset, ['a', 'b', 'c', 'd'], {
      playerLevel: 20,
      chapterId: 'chapter-1',
    })

    expect(report.exactTeam).toBeNull()
    expect(report.rotations).toHaveLength(1)
    expect(report.rotations[0].kind).toBe('rule-generated')
    expect(report.rotations[0].warnings).toContain('规则生成，待人工核对')
    expect(report.warnings).toContain('沿用标签规则回退循环，不能视为已验证攻略。')
    expect(buildRotationChoices(dataset, ['a'], null)[0].kind).toBe('rule-generated')
  })
})

describe('rule rotation battle mechanics', () => {
  it('keeps shared SP, combo trigger/window, and ultimate energy as distinct constraints', () => {
    const hero = makeCharacter('a', {
      name: '测试干员',
      skills: [
        makeSkill('battle', {
          name: '战术战技',
          type: 'battle',
          resource: 'shared_skill_points',
          sharedSkillPointCost: 2,
          tags: ['debuff-enemy'],
        }),
        makeSkill('combo', {
          name: '条件连携',
          type: 'combo',
          resource: 'none',
          sharedSkillPointCost: null,
          triggerConditions: ['目标处于失衡'],
          cooldownSeconds: 14,
          tags: ['break-shield'],
        }),
        makeSkill('ultimate', {
          name: '终结打击',
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
      triggerCondition: '目标处于失衡',
      comboWindowSeconds: null,
      cooldownSeconds: 14,
    })
    expect(combo?.waitFor).toBe('目标处于失衡')
    expect(combo?.warnings).toContain('规则生成，待人工核对')
    expect(ultimate).toMatchObject({
      energyCost: 80,
      sharedSkillPointCost: null,
    })
  })
})

describe('equipment gates', () => {
  const hero = makeCharacter('a', {
    roles: ['dps'],
    element: 'cold',
  })
  const chapters = [
    makeChapter('chapter-1', { order: 1 }),
    makeChapter('chapter-2', { order: 2 }),
    makeChapter('chapter-3', { order: 3 }),
  ]

  it('shows the best locked item separately from an unlocked craftable alternative', () => {
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

    const recommendation = recommendEquipmentForCharacter(dataset, hero, {
      playerLevel: 25,
      chapterId: 'chapter-2',
    })

    expect(recommendation.bestOverall?.equipment.id).toBe('best-locked')
    expect(recommendation.bestOverall?.unlockState).toBe('locked')
    expect(recommendation.bestAvailable?.equipment.id).toBe('craftable-now')
    expect(recommendation.bestAvailable?.unlockState).toBe('unlocked')
    expect(recommendation.alternatives.map((item) => item.equipment.id)).toEqual([
      'fallback-now',
    ])
    expect(recommendation.warnings).toContain('最佳装备尚未达到已知解锁门槛')
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

    const recommendation = recommendEquipmentForCharacter(dataset, hero, {
      playerLevel: 99,
      chapterId: 'chapter-3',
    })

    expect(recommendation.bestOverall?.unlockState).toBe('unknown')
    expect(recommendation.bestAvailable).toBeNull()
    expect(recommendation.warnings).toContain(
      '当前装备穿戴等级与已知章节条件下，没有可确认通过已知门槛的装备',
    )
  })

  it('builds four character plans without chapter records and labels authority limits', () => {
    const dataset = makeDataset({
      characters: roster,
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

    const report = buildRecommendationReport(dataset, ['a', 'b', 'c', 'd'], {
      playerLevel: 25,
      chapterId: null,
    })

    expect(report.exactTeam).toBeNull()
    expect(report.rotations).toHaveLength(1)
    expect(report.rotations[0].kind).toBe('rule-generated')
    expect(report.rotations[0].steps).toHaveLength(4)
    expect(report.equipment).toHaveLength(4)
    expect(report.equipment.every((item) => item.bestOverall !== null)).toBe(true)
    expect(report.equipment.every((item) => item.bestAvailable !== null)).toBe(true)
    expect(report.warnings).toContain(
      '章节与权限解锁资料尚未核验；装备结果仅按装备穿戴等级生成。',
    )

    const firstRecommendation = report.equipment[0]
    expect(firstRecommendation.bestAvailable?.gateLabels).toEqual([
      '装备穿戴等级 Lv.15',
      '配方权限要求 Rank 7',
      '配方阶级 III',
    ])
    expect(firstRecommendation.warnings).toContain(
      '配方权限要求尚未由剧情或权限进度自动判定，请进入游戏核对',
    )
  })

  it('labels only role and element tags that actually intersect the character', () => {
    const dataset = makeDataset({
      characters: [hero],
      chapters,
      equipment: [
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

    const recommendation = recommendEquipmentForCharacter(dataset, hero, {
      playerLevel: 25,
      chapterId: 'chapter-2',
    })

    expect(recommendation.bestAvailable?.equipment.id).toBe('matching-dps')
    expect(recommendation.bestAvailable?.matchNotes).toEqual([
      '定位匹配 · dps',
      '元素匹配 · cold',
    ])
    expect(
      recommendation.bestAvailable?.matchNotes.some((note) => note === '定位匹配'),
    ).toBe(false)
  })
})
