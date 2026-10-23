import { describe, expect, it } from 'vitest'
import {
  buildEquipmentStatDisplays,
  formatEquipmentStatValue,
  mapEquipmentStatLabel,
} from '@/lib/equipmentDisplay'

describe('formatEquipmentStatValue', () => {
  it.each([
    [0.11499999999999999, '0.115'],
    [0.19599999999999998, '0.196'],
    [1.2349, '1.235'],
    [1.23, '1.23'],
    [74, '74'],
    [-0.0004, '0'],
    ['12.500%', '12.500%'],
  ])('formats %j as %s', (value, expected) => {
    expect(formatEquipmentStatValue(value)).toBe(expected)
  })

  it('preserves non-finite values safely', () => {
    expect(formatEquipmentStatValue(Number.NaN)).toBe('NaN')
    expect(formatEquipmentStatValue(Number.POSITIVE_INFINITY)).toBe('Infinity')
  })
})

describe('mapEquipmentStatLabel', () => {
  it.each([
    ['FireAndNaturalDamageIncrease', '火與自然傷害提升'],
    ['UltimateSkillDamageIncrease', '終結技傷害提升'],
    ['Str', '力量'],
    ['Agi', '敏捷'],
    ['Wisd', '智識'],
  ])('maps %s to %s', (statType, expected) => {
    expect(mapEquipmentStatLabel(statType)).toBe(expected)
  })

  it('keeps unknown labels and hides null, undefined, or blank labels', () => {
    expect(mapEquipmentStatLabel('FutureStatIncrease')).toBe('FutureStatIncrease')
    expect(mapEquipmentStatLabel(null)).toBeNull()
    expect(mapEquipmentStatLabel(undefined)).toBeNull()
    expect(mapEquipmentStatLabel('   ')).toBeNull()
  })
})

describe('buildEquipmentStatDisplays', () => {
  it('maps, formats, hides missing labels, and preserves unknown labels', () => {
    const displays = buildEquipmentStatDisplays(
      {
        attrType_0: 0.11499999999999999,
        attrType_28: 80,
        attrType_39: 87,
        attrType_null: 1,
        attrType_missing: 2,
        attrType_unknown: 3.2,
      },
      {
        attrType_0: 'PhysicalDamageIncrease',
        attrType_28: 'UltimateSkillDamageIncrease',
        attrType_39: 'Str',
        attrType_null: null,
        attrType_unknown: 'FutureStatIncrease',
      },
    )

    expect(displays).toEqual([
      { key: 'attrType_0', label: '物理傷害提升', value: '0.115' },
      { key: 'attrType_28', label: '終結技傷害提升', value: '80' },
      { key: 'attrType_39', label: '力量', value: '87' },
      { key: 'attrType_unknown', label: 'FutureStatIncrease', value: '3.2' },
    ])
  })

  it('limits the number of rendered stat entries', () => {
    const displays = buildEquipmentStatDisplays(
      { first: 1, second: 2, third: 3 },
      { first: 'Atk', second: 'Str', third: 'Agi' },
      2,
    )

    expect(displays.map((display) => display.label)).toEqual(['攻擊力', '力量'])
  })
})
