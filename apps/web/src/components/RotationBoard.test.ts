import { describe, expect, it } from 'vitest'
import {
  clampStepIndex,
  conditionState,
  moveStepIndex,
  summarizeRotationConditions,
} from './RotationBoard.vue'

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

describe('RotationBoard condition annotations', () => {
  it('keeps missing source conditions explicitly unknown', () => {
    expect(conditionState(null)).toBe('unknown')
    expect(conditionState('   ')).toBe('unknown')
    expect(conditionState(undefined)).toBe('unknown')
  })

  it('marks only non-empty source text as documented', () => {
    expect(conditionState('連攜窗口開啟後立即施放')).toBe('documented')
    expect(conditionState('終結能量全滿')).toBe('documented')
  })

  it('summarizes step-level conditions when preset-level fields are empty', () => {
    const summary = summarizeRotationConditions({
      triggerConditions: [],
      waitConditions: [],
      steps: [
        {
          triggerCondition: '秋栗戰技施加火屬性效果。',
          waitFor: '隊伍可使用共享技力。',
        },
        {
          triggerCondition: '管理員戰技施加破防。',
          waitFor: '秋栗戰技已完成。',
        },
      ],
    })

    expect(summary.triggerConditions).toEqual([
      '秋栗戰技施加火屬性效果。',
      '管理員戰技施加破防。',
    ])
    expect(summary.waitConditions).toEqual([
      '隊伍可使用共享技力。',
      '秋栗戰技已完成。',
    ])
    expect(conditionState(summary.triggerConditions.join(' / '))).toBe('documented')
    expect(conditionState(summary.waitConditions.join(' / '))).toBe('documented')
  })

  it('preserves source order and deduplicates repeated step annotations', () => {
    expect(summarizeRotationConditions({
      triggerConditions: ['總覽觸發條件', '重複標註'],
      waitConditions: ['總覽等待條件'],
      steps: [
        { triggerCondition: '重複標註', waitFor: '第一步等待條件' },
        { triggerCondition: '  第二步觸發條件  ', waitFor: '第一步等待條件' },
        { triggerCondition: '   ', waitFor: null },
      ],
    })).toEqual({
      triggerConditions: [
        '總覽觸發條件',
        '重複標註',
        '第二步觸發條件',
      ],
      waitConditions: ['總覽等待條件', '第一步等待條件'],
    })
  })
})
