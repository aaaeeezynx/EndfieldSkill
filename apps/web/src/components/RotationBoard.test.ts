import { describe, expect, it } from 'vitest'
import { clampStepIndex, moveStepIndex } from './RotationBoard.vue'

describe('RotationBoard step navigation', () => {
  it('clamps an index to the available step range', () => {
    expect(clampStepIndex(-4, 3)).toBe(0)
    expect(clampStepIndex(1, 3)).toBe(1)
    expect(clampStepIndex(9, 3)).toBe(2)
    expect(clampStepIndex(0, 0)).toBe(-1)
  })

  it('moves one manual step without wrapping', () => {
    expect(moveStepIndex(0, 4, 1)).toBe(1)
    expect(moveStepIndex(1, 4, -1)).toBe(0)
    expect(moveStepIndex(0, 4, -1)).toBe(0)
    expect(moveStepIndex(3, 4, 1)).toBe(3)
  })

  it('returns an empty state for rotations without steps', () => {
    expect(moveStepIndex(-1, 0, 1)).toBe(-1)
    expect(moveStepIndex(0, 0, -1)).toBe(-1)
  })
})
