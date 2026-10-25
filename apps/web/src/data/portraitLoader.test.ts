import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getCharacterPortrait } from './portraitLoader'
import portraitMap from './characterPortraitMap.json'

const here = dirname(fileURLToPath(import.meta.url))
const canonicalCharacters = resolve(here, '../../../../data/v1/characters.json')
const portraitsDir = resolve(here, '../../public/assets/character_portraits')

const map = portraitMap as Record<string, string>
const canonicalIds = (
  JSON.parse(readFileSync(canonicalCharacters, 'utf8')) as {
    characters: Array<{ id: string }>
  }
).characters.map((character) => character.id)
const portraitFiles = readdirSync(portraitsDir)
  .filter((file) => file.endsWith('.png'))
  .map((file) => file.slice(0, -'.png'.length))

describe('portraitLoader', () => {
  it('returns null for unmapped character IDs', () => {
    expect(getCharacterPortrait('chr_9999_notexist')).toBeNull()
  })

  it('returns a BASE_URL-prefixed path for mapped character IDs', () => {
    expect(getCharacterPortrait('chr_0033_camille')).toMatch(
      /^.*assets\/character_portraits\/camille\.png$/,
    )
  })

  it('maps exactly the canonical character IDs', () => {
    expect(Object.keys(map).sort()).toEqual([...canonicalIds].sort())
  })

  it('has exactly one PNG for every mapped portrait and no orphan files', () => {
    expect([...new Set(Object.values(map))].sort()).toEqual([...portraitFiles].sort())
    expect(new Set(Object.values(map)).size).toBe(Object.keys(map).length)
  })
})
