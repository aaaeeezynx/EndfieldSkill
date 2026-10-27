import { describe, expect, it } from 'vitest'
import {
  equipmentTabRovingTabIndex,
  moveEquipmentTabIndex,
} from './EquipmentBoard.vue'

describe('EquipmentBoard tab keyboard model', () => {
  it('keeps one roving tab stop for the selected tab', () => {
    expect(equipmentTabRovingTabIndex(2, 0)).toBe(-1)
    expect(equipmentTabRovingTabIndex(2, 2)).toBe(0)
    expect(equipmentTabRovingTabIndex(2, 3)).toBe(-1)
  })

  it('moves with left and right arrows and wraps at both ends', () => {
    expect(moveEquipmentTabIndex(1, 4, 'ArrowRight')).toBe(2)
    expect(moveEquipmentTabIndex(1, 4, 'ArrowLeft')).toBe(0)
    expect(moveEquipmentTabIndex(0, 4, 'ArrowLeft')).toBe(3)
    expect(moveEquipmentTabIndex(3, 4, 'ArrowRight')).toBe(0)
  })

  it('jumps to the first and last tab with Home and End', () => {
    expect(moveEquipmentTabIndex(2, 4, 'Home')).toBe(0)
    expect(moveEquipmentTabIndex(0, 4, 'End')).toBe(3)
  })

  it('does not move tabs when there are no tab stops', () => {
    expect(moveEquipmentTabIndex(0, 0, 'ArrowRight')).toBeNull()
  })

  it('ignores keys outside the horizontal tab keyboard model', () => {
    expect(moveEquipmentTabIndex(1, 4, 'ArrowDown')).toBeNull()
    expect(moveEquipmentTabIndex(1, 4, 'Enter')).toBeNull()
  })
})
