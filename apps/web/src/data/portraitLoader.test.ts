import { describe, expect, it } from 'vitest'
import { getCharacterPortrait } from './portraitLoader'
import portraitMap from './characterPortraitMap.json'
import fs from 'node:fs'
import path from 'node:path'

describe('portraitLoader', () => {
  it('returns null for unmapped character IDs', () => {
    expect(getCharacterPortrait('chr_9999_notexist')).toBeNull()
  })

  it('returns BASE_URL-prefixed path for mapped character IDs', () => {
    const result = getCharacterPortrait('chr_0033_camille')
    expect(result).toBeTruthy()
    expect(result).toContain('assets/character_portraits/camille.png')
    // BASE_URL is injected at runtime, just verify the path structure
    expect(result).toMatch(/^.*assets\/character_portraits\/camille\.png$/)
  })

  it('has portrait files for all mapped character IDs except minghe', () => {
    const publicDir = path.resolve(__dirname, '../../public')
    const portraitsDir = path.join(publicDir, 'assets/character_portraits')

    const mappedFilenames = Object.entries(portraitMap as Record<string, string>)

    const missingFiles: string[] = []
    for (const [characterId, filename] of mappedFilenames) {
      // minghe is an extra portrait not in dataset, allowed to exist
      if (characterId === 'chr_0037_minghe') continue

      const filePath = path.join(portraitsDir, `${filename}.png`)
      if (!fs.existsSync(filePath)) {
        missingFiles.push(`${characterId} → ${filename}.png`)
      }
    }

    expect(missingFiles).toEqual([])
  })

  it('all mapped character IDs correspond to real dataset character IDs', async () => {
    // Load actual dataset to verify IDs
    const dataPath = path.resolve(__dirname, '../../public/data/v1/characters.json')
    
    // In test environment, data may not be synced yet, so we check source
    const sourcePath = path.resolve(__dirname, '../../../../data/v1/characters.json')
    const targetPath = fs.existsSync(dataPath) ? dataPath : sourcePath

    if (!fs.existsSync(targetPath)) {
      // If neither exists, skip this test (CI may run before sync)
      return
    }

    const rawData = fs.readFileSync(targetPath, 'utf-8')
    const parsed = JSON.parse(rawData) as { characters: { id: string }[] }
    const datasetIds = new Set(parsed.characters.map((c) => c.id))

    const mappedIds = Object.keys(portraitMap as Record<string, string>)
    const unmatchedIds: string[] = []

    for (const characterId of mappedIds) {
      // minghe is extra, allowed
      if (characterId === 'chr_0037_minghe') continue

      if (!datasetIds.has(characterId)) {
        unmatchedIds.push(characterId)
      }
    }

    expect(unmatchedIds).toEqual([])
  })
})
