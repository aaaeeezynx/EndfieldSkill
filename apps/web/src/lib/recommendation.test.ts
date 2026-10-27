import { describe, expect, it } from 'vitest'
import {
  buildRecommendationReport,
  buildRotationChoices,
  matchTeamPresets,
  recommendEquipmentForCharacter,
} from '@/lib/recommendation'
import type { RotationPreset } from '@/types/domain'
import {
  makeCharacter,
  makeDataset,
  makeEquipment,
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
  matchType: 'complete',
  dependencies: [],
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
  author: '測試作者',
  videoTimestamp: '03:25',
  publishedAt: '2026-10-20',
  triggerConditions: ['條件成立'],
  waitConditions: ['等待窗口開啟'],
  limitations: ['僅記錄來源可核驗部分'],
  ...overrides,
})

const stepIds = (steps: { characterId: string }[]): string[] =>
  steps.map((step) => step.characterId)

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
})

describe('rotation recombination from selected squad', () => {
  it('prefers a verified exact-team rotation and otherwise reports unavailable', () => {
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
      kind: 'source-backed',
      sourceIds: ['source-guide'],
    })

    // No rotation presets at all: the squad has no source evidence.
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
    expect(fallbackReport.rotations[0].kind).toBe('unavailable')
    expect(fallbackReport.rotations[0].steps).toEqual([])
    expect(fallbackReport.warnings).toContain('目前隊伍尚無可核驗循環。')
    // A single character with no source at all is still unavailable.
    expect(buildRotationChoices(makeDataset({ characters: roster }), ['a'])[0].kind).toBe(
      'unavailable',
    )
  })

  it('keeps a same-source fragment when only a subset of a source team is selected', () => {
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
    expect(report.rotations[0]).toMatchObject({
      kind: 'source-fragment',
      matchedCharacterIds: ['a', 'b', 'c'],
    })
    expect(stepIds(report.rotations[0].steps)).toEqual(['a', 'b', 'c'])
    expect(report.rotations[0].warnings).toContain('此為來源循環片段，不能視為完整隊伍攻略。')
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
      kind: 'source-backed',
    })
  })

  it('returns unavailable when no rotation source can cover the selected squad', () => {
    const report = buildRecommendationReport(makeDataset({ characters: roster }), ['a', 'b', 'c', 'd'], {
      playerLevel: 20,
      chapterId: null,
    })

    expect(report.equipment.map((loadout) => loadout.characterId)).toEqual(['a', 'b', 'c', 'd'])
    expect(report.rotations).toHaveLength(1)
    expect(report.rotations[0].kind).toBe('unavailable')
    expect(report.rotations[0].steps).toEqual([])
  })

  it('rejects 0, 5, or duplicated selections as invalid-selection', () => {
    const rotation = makeRotation('rotation-four', ['a', 'b', 'c', 'd'])
    const dataset = makeDataset({ characters: roster, rotationPresets: [rotation] })

    for (const bad of [[], ['a', 'b', 'c', 'd', 'e'], ['a', 'a']]) {
      const report = buildRecommendationReport(dataset, bad, {
        playerLevel: 20,
        chapterId: null,
      })
      expect(report.rotations[0].kind).toBe('invalid-selection')
      expect(report.rotations[0].steps).toEqual([])
      expect(report.warnings).toContain('隊伍人數必須為 1 至 4 名不同角色，未生成技能循環。')
    }

    // buildRotationChoices shares the same invalid-selection semantics.
    expect(buildRotationChoices(dataset, ['a', 'b', 'c', 'd', 'e'])[0].kind).toBe('invalid-selection')
    expect(buildRotationChoices(dataset, ['a', 'a'])[0].kind).toBe('invalid-selection')
    expect(buildRotationChoices(dataset, [])[0].kind).toBe('invalid-selection')
  })

  it('shows a source fragment for a single selected character that has coverage', () => {
    const rotation = makeRotation('rotation-src', ['a', 'b'])
    const dataset = makeDataset({ characters: roster, rotationPresets: [rotation] })

    const report = buildRecommendationReport(dataset, ['a'], {
      playerLevel: 20,
      chapterId: null,
    })

    expect(report.rotations[0]).toMatchObject({
      kind: 'source-fragment',
      matchType: 'fragment',
      matchedCharacterIds: ['a'],
    })
    expect(stepIds(report.rotations[0].steps)).toEqual(['a'])
    expect(report.rotations[0].warnings).toContain('此為來源循環片段，不能視為完整隊伍攻略。')
  })

  it('keeps a same-source fragment once two or more characters match', () => {
    const rotation = makeRotation('rotation-four', ['a', 'b', 'c', 'd'])
    const dataset = makeDataset({ characters: roster, rotationPresets: [rotation] })

    const two = buildRotationChoices(dataset, ['b', 'a'])
    const three = buildRotationChoices(dataset, ['c', 'a', 'b'])

    expect(two[0]).toMatchObject({ kind: 'source-fragment' })
    expect(two[0].matchedCharacterIds).toEqual(['a', 'b'])
    expect(stepIds(two[0].steps)).toEqual(['a', 'b'])
    expect(three[0]).toMatchObject({ kind: 'source-fragment' })
    expect(three[0].matchedCharacterIds).toEqual(['a', 'b', 'c'])
  })

  it('returns identical rotations regardless of selected character order', () => {
    const rotation = makeRotation('rotation-order', ['a', 'b', 'c'])
    const dataset = makeDataset({ characters: roster, rotationPresets: [rotation] })

    const forward = buildRotationChoices(dataset, ['a', 'b', 'c'])
    const reversed = buildRotationChoices(dataset, ['c', 'b', 'a'])

    expect(reversed).toEqual(forward)
    expect(stepIds(forward[0].steps)).toEqual(['a', 'b', 'c'])
  })

  it('keeps source step order for exact and fragment choices', () => {
    const rotation = makeRotation('rotation-authored-order', ['a', 'b', 'c'])
    // Intentionally reorder the authored array; selection order must not matter.
    rotation.steps = [
      { ...rotation.steps[2] },
      { ...rotation.steps[0] },
      { ...rotation.steps[1] },
    ].map((step, index) => ({ ...step, order: index + 1 }))
    const dataset = makeDataset({ characters: roster, rotationPresets: [rotation] })

    const exact = buildRotationChoices(dataset, ['c', 'b', 'a'])
    const fragment = buildRotationChoices(dataset, ['b', 'a'])

    expect(stepIds(exact[0].steps)).toEqual(['c', 'a', 'b'])
    expect(stepIds(fragment[0].steps)).toEqual(['a', 'b'])
  })

  it('never promotes an authored fragment to a complete rotation', () => {
    const rotation = makeRotation('rotation-fragment', ['a', 'b'], {
      matchType: 'fragment',
      dependencies: [{ characterId: 'a', reason: '需要另一段尚未核驗的連攜。' }],
    })
    const dataset = makeDataset({ characters: roster, rotationPresets: [rotation] })

    const choices = buildRotationChoices(dataset, ['b', 'a'])

    expect(choices[0]).toMatchObject({
      kind: 'source-fragment',
      matchType: 'fragment',
      dependencies: [{ characterId: 'a', reason: '需要另一段尚未核驗的連攜。' }],
    })
    expect(choices[0].warnings).toContain('此為來源循環片段，不能視為完整隊伍攻略。')
  })

  it('combines multiple complete sources into a disclosed composite', () => {
    const first = makeRotation('rotation-a', ['a', 'b'])
    const second = makeRotation('rotation-b', ['c', 'd'])
    const dataset = makeDataset({
      characters: roster,
      rotationPresets: [first, second],
    })

    const choices = buildRotationChoices(dataset, ['a', 'b', 'c', 'd'])

    expect(choices).toHaveLength(1)
    expect(choices[0].kind).toBe('source-composite')
    expect(choices[0].matchType).toBe('complete')
    expect(choices[0].sourceSegments).toHaveLength(2)
    expect(stepIds(choices[0].steps)).toEqual(['a', 'b', 'c', 'd'])
    expect(choices[0].warnings).toContain(
      '此為跨來源證據化組合，並非單一攻略；各來源片段已分開標示。',
    )
  })

  it('does not let the selection order decide the fragment', () => {
    const rotation = makeRotation('rotation-order-fragment', ['a', 'b', 'c', 'd'])
    const dataset = makeDataset({ characters: roster, rotationPresets: [rotation] })

    const forward = buildRotationChoices(dataset, ['a', 'b'])
    const reversed = buildRotationChoices(dataset, ['b', 'a'])

    expect(reversed).toEqual(forward)
    expect(forward[0].kind).toBe('source-fragment')
    expect(stepIds(forward[0].steps)).toEqual(['a', 'b'])
  })

  it('discloses a cross-source fragment instead of fabricating a complete rotation', () => {
    const first = makeRotation('rotation-a', ['a', 'x'])
    const second = makeRotation('rotation-b', ['b', 'y'])
    const dataset = makeDataset({
      characters: roster,
      rotationPresets: [first, second],
    })

    // 'x' and 'y' are not selected, so neither preset is complete; the engine
    // may still surface their per-character steps as a disclosed fragment.
    const choices = buildRotationChoices(dataset, ['a', 'b'])

    expect(choices).toHaveLength(1)
    expect(choices[0]).toMatchObject({
      kind: 'source-fragment',
      matchType: 'fragment',
    })
    expect(choices[0].sourceSegments.length).toBeGreaterThanOrEqual(1)
    expect(choices[0].matchedCharacterIds.sort()).toEqual(['a', 'b'])
    expect(choices[0].warnings).toContain('此為來源循環片段，不能視為完整隊伍攻略。')
  })

  it('preserves the player slot order in the report and equipment board', () => {
    const rotation = makeRotation('rotation-order', ['a', 'b', 'c', 'd'])
    const dataset = makeDataset({ characters: roster, rotationPresets: [rotation] })

    const report = buildRecommendationReport(dataset, ['d', 'b', 'a'], {
      playerLevel: 20,
      chapterId: null,
    })

    expect(report.selectedCharacterIds).toEqual(['d', 'b', 'a'])
    expect(report.equipment.map((loadout) => loadout.characterId)).toEqual(['d', 'b', 'a'])
  })
})

describe('level-only equipment eligibility', () => {
  const hero = makeCharacter('a', {
    roles: ['dps'],
    element: 'cold',
  })

  const bodyUnlock = (playerLevel: number, chapterId: string | null = null) => ({
    playerLevel,
    playerLevelKind: 'equipment_wear_level',
    chapterId,
    chapterOrder: null,
    materials: [],
  })

  it('lists every level-craftable item per slot, sorted rarity DESC then level DESC then id ASC', () => {
    const dataset = makeDataset({
      characters: [hero],
      equipment: [
        makeEquipment('body-1', { slot: 'body', rarity: 3, unlock: bodyUnlock(5) }),
        makeEquipment('body-2', { slot: 'body', rarity: 5, unlock: bodyUnlock(10) }),
        makeEquipment('body-3', { slot: 'body', rarity: 5, unlock: bodyUnlock(8) }),
        makeEquipment('body-4', { slot: 'body', rarity: 4, unlock: bodyUnlock(20) }),
        makeEquipment('body-5', { slot: 'body', rarity: 5, unlock: bodyUnlock(10) }),
      ],
    })

    const body = recommendEquipmentForCharacter(dataset, hero, {
      playerLevel: 20,
      chapterId: null,
    }).slots.body

    expect(body.target?.equipment.id).toBe('body-2')
    expect(body.available).toBeNull()
    expect(body.alternatives.map((item) => item.equipment.id)).toEqual([
      'body-5',
      'body-3',
      'body-4',
      'body-1',
    ])
    // Five eligible items -> one target plus four alternatives, never truncated.
    expect(body.alternatives).toHaveLength(4)
    expect(body.target?.matchNotes).toEqual([])
    expect(body.alternatives.every((item) => item.matchNotes.length === 0)).toBe(true)
    expect(body.target?.gateLabels).toEqual(['可製造等級 Lv.10'])
    expect(body.target?.unlockState).toBe('unlocked')
  })

  it('ignores chapter, profession, element, and recipe gates when judging craftability', () => {
    const dataset = makeDataset({
      characters: [hero],
      equipment: [
        makeEquipment('body-1', { slot: 'body', rarity: 3, unlock: bodyUnlock(5) }),
        makeEquipment('body-2', { slot: 'body', rarity: 5, unlock: bodyUnlock(10) }),
        makeEquipment('body-3', { slot: 'body', rarity: 5, unlock: bodyUnlock(8) }),
        makeEquipment('body-4', { slot: 'body', rarity: 4, unlock: bodyUnlock(20) }),
        makeEquipment('body-5', { slot: 'body', rarity: 5, unlock: bodyUnlock(10) }),
        // Gated by a late chapter and a recipe rank, but craftable and within
        // level: must still be eligible regardless of those fields.
        makeEquipment('body-ignored', {
          slot: 'body',
          rarity: 2,
          roleTags: ['support'],
          formulaAuthorityRank: 9,
          unlock: bodyUnlock(5, 'chapter-99'),
        }),
        // Never craftable -> excluded everywhere.
        makeEquipment('body-excluded-craftable', {
          slot: 'body',
          rarity: 6,
          craftable: false,
          unlock: bodyUnlock(5),
        }),
        // Above the configured level -> excluded.
        makeEquipment('body-excluded-level', {
          slot: 'body',
          rarity: 6,
          unlock: bodyUnlock(40),
        }),
      ],
    })

    const body = recommendEquipmentForCharacter(dataset, hero, {
      playerLevel: 20,
      chapterId: 'chapter-99',
    }).slots.body

    const listed = [body.target?.equipment.id, ...body.alternatives.map((item) => item.equipment.id)]
    expect(listed).toContain('body-ignored')
    expect(listed).not.toContain('body-excluded-craftable')
    expect(listed).not.toContain('body-excluded-level')
    expect(body.target?.equipment.id).toBe('body-2')
    expect(body.available).toBeNull()
  })

  it('flags indeterminate gear (missing craftable or level) without listing it', () => {
    const dataset = makeDataset({
      characters: [hero],
      equipment: [
        makeEquipment('body-eligible', { slot: 'body', rarity: 3, unlock: bodyUnlock(5) }),
        makeEquipment('body-unknown', {
          slot: 'body',
          rarity: 5,
          unlock: {
            playerLevel: null,
            playerLevelKind: null,
            chapterId: null,
            chapterOrder: null,
            materials: [],
          },
        }),
      ],
    })

    const body = recommendEquipmentForCharacter(dataset, hero, {
      playerLevel: 20,
      chapterId: null,
    }).slots.body

    const listed = [body.target?.equipment.id, ...body.alternatives.map((item) => item.equipment.id)]
    expect(listed).toEqual(['body-eligible'])
    expect(body.warnings).toContain(
      '部分裝備缺少可判定資料（craftable 或等級門檻為空），已另列「無法判定」。',
    )
  })

  it('reports a slot with no level-craftable gear', () => {
    const dataset = makeDataset({
      characters: [hero],
      equipment: [
        makeEquipment('body-locked', { slot: 'body', rarity: 6, unlock: bodyUnlock(40) }),
      ],
    })

    const body = recommendEquipmentForCharacter(dataset, hero, {
      playerLevel: 20,
      chapterId: null,
    }).slots.body

    expect(body.target).toBeNull()
    expect(body.available).toBeNull()
    expect(body.alternatives).toEqual([])
    expect(body.warnings).toContain('此部位目前沒有等級可製造的裝備資料。')
  })
})
