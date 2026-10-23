import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getEquipmentImage } from './equipmentImageLoader'
import equipmentImageMap from './equipmentImageMap.json'

const KNOWN_CDN_MISSES = [
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

  it('does not map artwork that is absent from the official CDN', () => {
    const mappedIds = new Set(Object.keys(equipmentImageMap))
    expect(KNOWN_CDN_MISSES.filter((id) => mappedIds.has(id))).toEqual([])
  })
})
