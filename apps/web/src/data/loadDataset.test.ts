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
})
