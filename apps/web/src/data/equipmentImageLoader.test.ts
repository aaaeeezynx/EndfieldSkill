import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getEquipmentImage } from './equipmentImageLoader'
import equipmentImageMap from './equipmentImageMap.json'

const COMMUNITY_MIRROR_IDS = [
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
] as const

const EXPECTED_EQUIPMENT_ARTWORK_COUNT = 276

describe('equipmentImageLoader', () => {
  it('returns null for equipment without mirrored artwork', () => {
    expect(getEquipmentImage('item_equip_not_available')).toBeNull()
  })

  it('returns a BASE_URL-prefixed path for mapped equipment', () => {
    const result = getEquipmentImage('item_equip_t0_parts_tundra01_body_01')

    expect(result).toMatch(
      /^.*assets\/equipment\/item_equip_t0_parts_tundra01_body_01\.webp$/,
    )
  })

  it('keeps every mapped artwork file present in the public directory', () => {
    const equipmentDir = path.resolve(__dirname, '../../public/assets/equipment')
    const missingFiles = Object.values(equipmentImageMap as Record<string, string>).filter(
      (filename) => !fs.existsSync(path.join(equipmentDir, filename)),
    )

    expect(missingFiles).toEqual([])
  })

  it('maps all 18 Warfarin community mirror entries to local webp files', () => {
    const mappedIds = new Set(Object.keys(equipmentImageMap))
    const equipmentDir = path.resolve(__dirname, '../../public/assets/equipment')

    for (const id of COMMUNITY_MIRROR_IDS) {
      expect(mappedIds.has(id), `${id} should be present in the image map`).toBe(true)
      expect(equipmentImageMap[id as keyof typeof equipmentImageMap]).toBe(`${id}.webp`)
      expect(
        fs.existsSync(path.join(equipmentDir, `${id}.webp`)),
        `${id}.webp should exist in public/assets/equipment`,
      ).toBe(true)
    }
  })

  it('keeps local mirror coverage at 276 mapped files without orphan artwork', () => {
    const equipmentDir = path.resolve(__dirname, '../../public/assets/equipment')
    const localFiles = fs
      .readdirSync(equipmentDir)
      .filter((filename) => filename.endsWith('.webp'))
      .sort()
    const mappedFiles = Object.values(equipmentImageMap as Record<string, string>).sort()

    expect(mappedFiles).toHaveLength(EXPECTED_EQUIPMENT_ARTWORK_COUNT)
    expect(localFiles).toHaveLength(EXPECTED_EQUIPMENT_ARTWORK_COUNT)
    expect(mappedFiles).toEqual(localFiles)
  })
})
