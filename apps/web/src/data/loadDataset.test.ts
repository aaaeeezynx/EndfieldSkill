import { describe, expect, it } from 'vitest'
import { DATA_FILES, loadDataset, parseDataset } from '@/data/loadDataset'

describe('dataset parsing', () => {
  it('returns clearly empty collections when no files have been generated', () => {
    const dataset = parseDataset({})

    expect(dataset.loadedFiles).toEqual([])
    expect(dataset.missingFiles).toEqual([])
    expect(dataset.characters).toEqual([])
    expect(dataset.equipment).toEqual([])
    expect(dataset.chapters).toEqual([])
    expect(dataset.teamPresets).toEqual([])
    expect(dataset.rotationPresets).toEqual([])
    expect(dataset.sources).toEqual([])
    expect(dataset.coverage.characterSkillCoverage).toBeNull()
  })

  it('preserves missing-file and load-error diagnostics without fabricating records', () => {
    const dataset = parseDataset(
      {},
      ['characters.json', 'rotation-presets.json'],
      ['characters.json: HTTP 404', 'rotation-presets.json: HTTP 404'],
    )

    expect(dataset.missingFiles).toEqual(['characters.json', 'rotation-presets.json'])
    expect(dataset.errors).toEqual([
      'characters.json: HTTP 404',
      'rotation-presets.json: HTTP 404',
    ])
    expect(dataset.characters).toEqual([])
    expect(dataset.rotationPresets).toEqual([])
  })

  it('marks every contract file missing when the static data route is absent', async () => {
    const fetcher = (async () =>
      new Response('', { status: 404 })) as unknown as typeof fetch

    const dataset = await loadDataset(fetcher)

    expect(dataset.loadedFiles).toEqual([])
    expect(dataset.missingFiles).toEqual([...DATA_FILES])
    expect(dataset.errors).toHaveLength(DATA_FILES.length)
    expect(dataset.characters).toEqual([])
  })

  it('preserves equipment wear-level and formula-authority gate fields', () => {
    const dataset = parseDataset({
      'equipment.json': [
        {
          id: 'gear-a',
          name: '測試裝備',
          unlock: {
            playerLevel: 18,
            playerLevelKind: 'equipment_wear_level',
          },
          unlockDetails: {
            authorityRank: 6,
            recipeTier: 'III',
            formulaId: 'formula-a',
            domainName: '測試領域',
          },
        },
      ],
    })

    expect(dataset.equipment[0]).toMatchObject({
      id: 'gear-a',
      unlock: {
        playerLevel: 18,
        playerLevelKind: 'equipment_wear_level',
      },
      formulaAuthorityRank: 6,
      recipeTier: 'III',
      formulaId: 'formula-a',
      domainName: '測試領域',
    })
  })

  it('preserves authored rotation step order and per-step source metadata', () => {
    const dataset = parseDataset({
      'rotation-presets.json': {
        rotations: [
          {
            id: 'rotation-authored',
            name: '來源循環',
            sourceIds: ['preset-source'],
            characterIds: ['char-a', 'char-b'],
            steps: [
              {
                id: 'step-second-authored',
                order: 9,
                characterId: 'char-b',
                skillName: '第二個原作者步驟',
                skillType: 'combo',
                sourceIds: ['step-source-2'],
              },
              {
                id: 'step-first-authored',
                order: 2,
                characterId: 'char-a',
                skillName: '第一個原作者步驟',
                skillType: 'battle',
                sourceIds: ['step-source-1'],
              },
            ],
          },
        ],
      },
    })

    expect(dataset.rotationPresets).toHaveLength(1)
    expect(dataset.rotationPresets[0].steps.map((step) => step.skillName)).toEqual([
      '第二個原作者步驟',
      '第一個原作者步驟',
    ])
    expect(dataset.rotationPresets[0].steps.map((step) => step.order)).toEqual([1, 2])
    expect(dataset.rotationPresets[0].steps.map((step) => step.sourceIds)).toEqual([
      ['step-source-2'],
      ['step-source-1'],
    ])
    expect(dataset.rotationPresets[0].sourceIds).toEqual(['preset-source'])
  })

  it('provides optional rotation tags/archetype indexes without inventing unknown presets', () => {
    const indexedIds = [
      'rotation_game8_laevatain_577071',
      'rotation_physical_shatter_202601',
      'rotation_tangtang_ice_202603',
      'rotation_lastrite_tangtang_ice_202603',
      'rotation_wulfa_team_burst_202601',
      'rotation_wulfa_team_charge_202601',
      'rotation_legacy_unclassified',
    ]
    const dataset = parseDataset({
      'rotation-presets.json': {
        rotations: indexedIds.map((id) => ({
          id,
          name: id,
          characterIds: ['char-a'],
          steps: [
            {
              characterId: 'char-a',
              skillName: '既有步驟',
              skillType: 'battle',
            },
          ],
        })),
      },
    })
    const indexById = new Map(
      dataset.rotationPresets.map((rotation) => [
        rotation.id,
        { tags: rotation.tags, archetype: rotation.archetype },
      ]),
    )

    expect(dataset.rotationPresets).toHaveLength(indexedIds.length)
    expect(indexById.get('rotation_physical_shatter_202601')).toEqual({
      tags: ['物理碎甲', '火', '冰'],
      archetype: '物理碎甲',
    })
    expect(indexById.get('rotation_tangtang_ice_202603')?.archetype).toBe('冰')
    expect(indexById.get('rotation_lastrite_tangtang_ice_202603')?.archetype).toBe('冰')
    expect(indexById.get('rotation_game8_laevatain_577071')?.archetype).toBe('火')
    expect(indexById.get('rotation_wulfa_team_burst_202601')).toEqual({
      tags: ['物理/猛擊'],
      archetype: '物理/猛擊',
    })
    expect(indexById.get('rotation_wulfa_team_charge_202601')?.archetype).toBe(
      '物理碎甲',
    )
    expect(indexById.get('rotation_legacy_unclassified')).toEqual({
      tags: [],
      archetype: null,
    })
    expect(
      dataset.rotationPresets.some(
        (rotation) =>
          rotation.name.includes('燃霜') ||
          rotation.name.includes('雷電') ||
          rotation.archetype?.includes('燃霜') ||
          rotation.archetype?.includes('雷電'),
      ),
    ).toBe(false)
  })

  it('honors explicit rotation index fields for forward compatibility', () => {
    const dataset = parseDataset({
      'rotation-presets.json': {
        rotations: [
          {
            id: 'rotation_custom',
            name: '自訂循環',
            tags: ['測試標籤'],
            archetype: '自訂軸',
            characterIds: ['char-a'],
            steps: [
              {
                characterId: 'char-a',
                skillName: '既有步驟',
                skillType: 'battle',
              },
            ],
          },
        ],
      },
    })

    expect(dataset.rotationPresets[0]).toMatchObject({
      tags: ['測試標籤'],
      archetype: '自訂軸',
    })
  })
})
