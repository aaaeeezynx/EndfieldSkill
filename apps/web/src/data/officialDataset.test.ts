import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const canonicalDir = resolve(here, '../../../../data/v1')
const publicDataDir = resolve(here, '../../public/data/v1')
const publicAssetsDir = resolve(here, '../../public/assets')
const JSON_FILES = [
  'meta.json',
  'characters.json',
  'equipment.json',
  'progressions.json',
  'team-presets.json',
  'rotation-presets.json',
  'sources.json',
] as const
const EXCLUDED_ADMIN_IDS = ['chr_0003_endminf', 'chr_9000_endmin']
const EXPECTED_CHARACTER_COUNT = 33
const EXPECTED_EQUIPMENT_COUNT = 276
const EXPECTED_SKILL_COUNT = 96
const EXPECTED_MISSING_SKILLS = [
  'chr_0028_wulfa:combo',
  'chr_0031_mifu:battle',
  'chr_0034_typhoea:battle',
]
const EXPECTED_MISSING_EQUIPMENT_ART = [
  'item_equip_t4_parts_wuling00_body_06',
  'item_equip_t4_parts_wuling00_edc_06',
  'item_equip_t4_parts_wuling00_hand_06',
  'item_equip_t4_parts_wuling02_body_03',
  'item_equip_t4_parts_wuling02_body_04',
  'item_equip_t4_parts_wuling02_edc_02',
  'item_equip_t4_parts_wuling02_hand_03',
  'item_equip_t4_parts_wuling02_hand_04',
  'item_equip_t4_suit_atk02_body_05',
  'item_equip_t4_suit_atk02_edc_06',
  'item_equip_t4_suit_atk02_hand_03',
  'item_equip_t4_suit_pulse_cryst01_body_02',
  'item_equip_t4_suit_pulse_cryst01_edc_04',
  'item_equip_t4_suit_pulse_cryst01_hand_02',
  'item_equip_t4_suit_usp02_body_05',
  'item_equip_t4_suit_usp02_body_06',
  'item_equip_t4_suit_usp02_edc_07',
  'item_equip_t4_suit_usp02_hand_05',
]

function readJson(file: string): any {
  return JSON.parse(readFileSync(resolve(canonicalDir, file), 'utf8'))
}

function findExcludedReferences(
  value: unknown,
  path: Array<string | number> = [],
): string[] {
  const leaks: string[] = []
  if (typeof value === 'string') {
    for (const id of EXCLUDED_ADMIN_IDS) {
      if (value.includes(id)) leaks.push(`$${path.map((part) => `.${part}`).join('')}`)
    }
    return leaks
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      leaks.push(...findExcludedReferences(entry, [...path, index])),
    )
    return leaks
  }
  if (!value || typeof value !== 'object') return leaks
  for (const [key, entry] of Object.entries(value)) {
    for (const id of EXCLUDED_ADMIN_IDS) {
      if (key.includes(id)) {
        leaks.push(`$${path.map((part) => `.${part}`).join('')}.${key}`)
      }
    }
    leaks.push(...findExcludedReferences(entry, [...path, key]))
  }
  return leaks
}

describe('canonical dataset integrity', () => {
  it('contains all required canonical JSON files', () => {
    const actual = readdirSync(canonicalDir)
      .filter((file) => file.endsWith('.json'))
      .sort()
    expect(actual).toEqual(expect.arrayContaining([...JSON_FILES]))
  })

  it('never references excluded Administrator forms in any key or string value', () => {
    for (const file of JSON_FILES) {
      expect(findExcludedReferences(readJson(file)), file).toEqual([])
    }
  })

  it('keeps only the Administrator A-form and reports the expected skill coverage', () => {
    const data = readJson('characters.json')
    const ids = data.characters.map((character: any) => character.id)

    expect(ids).toContain('chr_0002_endminm')
    expect(ids).not.toContain('chr_0003_endminf')
    expect(ids).not.toContain('chr_9000_endmin')
    expect(data.characters).toHaveLength(EXPECTED_CHARACTER_COUNT)
    expect(new Set(ids).size).toBe(EXPECTED_CHARACTER_COUNT)

    const meta = readJson('meta.json')
    expect(meta.coverage.playableCharacters).toBe(EXPECTED_CHARACTER_COUNT)
    expect(meta.coverage.charactersWithSourceIds).toBe(EXPECTED_CHARACTER_COUNT)
    expect(meta.coverage.skills).toEqual({
      total: 96,
      battle: 31,
      combo: 32,
      ultimate: 33,
    })
  })

  it('keeps the canonical dataset and public mirror byte-identical', () => {
    for (const file of JSON_FILES) {
      expect(
        readFileSync(resolve(publicDataDir, file)).equals(
          readFileSync(resolve(canonicalDir, file)),
        ),
        file,
      ).toBe(true)
    }
  })

  it('reports exactly the three known missing skill types', () => {
    const characters = readJson('characters.json').characters
    const missingSkills = characters.flatMap((character: any) => {
      const presentTypes = new Set(
        character.skills.map((skill: any) => skill.type),
      )
      return ['battle', 'combo', 'ultimate']
        .filter((type) => !presentTypes.has(type))
        .map((type) => `${character.id}:${type}`)
    })
    const meta = readJson('meta.json')
    const skillCount = characters.reduce(
      (total: number, character: any) =>
        total +
        character.skills.filter((skill: any) =>
          ['battle', 'combo', 'ultimate'].includes(skill.type),
        ).length,
      0,
    )

    expect(skillCount).toBe(EXPECTED_SKILL_COUNT)
    expect(missingSkills).toEqual(EXPECTED_MISSING_SKILLS)
    expect(meta.coverage.missingSkillTypes).toEqual(EXPECTED_MISSING_SKILLS)
  })

  it('has exactly the known equipment art gaps and no missing or orphaned files', () => {
    const equipment = readJson('equipment.json').equipment
    const imageMap = JSON.parse(
      readFileSync(resolve(here, 'equipmentImageMap.json'), 'utf8'),
    ) as Record<string, string>
    const mappedFiles = Object.values(imageMap)
    const missingArt = equipment
      .map((item: any) => item.id)
      .filter((id: string) => !imageMap[id])
      .sort()
    const missingFiles = mappedFiles.filter(
      (file) => !existsSync(resolve(publicAssetsDir, 'equipment', file)),
    )
    const mappedFileSet = new Set(mappedFiles)
    const orphanFiles = readdirSync(resolve(publicAssetsDir, 'equipment'))
      .filter((file) => file.endsWith('.webp') && !mappedFileSet.has(file))
      .sort()

    expect(equipment).toHaveLength(EXPECTED_EQUIPMENT_COUNT)
    expect(mappedFiles).toHaveLength(258)
    expect(mappedFiles.every((file) => file.endsWith('.webp'))).toBe(true)
    expect(missingArt).toEqual(EXPECTED_MISSING_EQUIPMENT_ART)
    expect(missingFiles).toEqual([])
    expect(orphanFiles).toEqual([])
  })

  it('does not ship official key visuals or the excluded Administrator portrait', () => {
    const removedAssets = [
      'official/hero-desktop.webp',
      'official/hero-tablet.webp',
      'official/hero-mobile.webp',
      'official/kv_v1d6.32f51a5b.jpg',
      'official/kv_v1d6_h5.e4383bbb.jpg',
      'character_portraits/endministrator2.png',
      'character_portraits/minghe.png',
    ]

    for (const asset of removedAssets) {
      expect(existsSync(resolve(publicAssetsDir, asset)), asset).toBe(false)
    }
  })

  it('has one to four unique members and contiguous rotation steps', () => {
    const teams = readJson('team-presets.json').teams
    for (const team of teams) {
      expect(team.characterIds.length, team.id).toBeGreaterThanOrEqual(1)
      expect(team.characterIds.length, team.id).toBeLessThanOrEqual(4)
      expect(new Set(team.characterIds).size, team.id).toBe(team.characterIds.length)
    }

    const rotations = readJson('rotation-presets.json').rotations
    for (const rotation of rotations) {
      const orders = rotation.steps
        .map((step: any) => step.order)
        .sort((a: number, b: number) => a - b)
      expect(orders, rotation.id).toEqual(
        Array.from({ length: rotation.steps.length }, (_, index) => index + 1),
      )
    }
  })
})
