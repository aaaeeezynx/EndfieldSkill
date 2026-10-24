import { describe, expect, it } from 'vitest'
import {
  displayElement,
  displayProfession,
  displayRoleOrTag,
  displayLabel,
  displaySkillType,
  missingSkillTypeLabels,
} from '@/lib/displayLabels'

describe('displayElement', () => {
  it.each([
    ['Physical', '物理'],
    ['Pulse', '脈衝'],
    ['Fire', '火焰'],
    ['Natural', '自然'],
    ['Cryst', '結晶'],
    ['cold', '寒冷'],
  ])('maps %s to %s', (value, expected) => {
    expect(displayElement(value)).toBe(expected)
  })

  it('returns the original value for unknown or empty input', () => {
    expect(displayElement('Frost')).toBe('Frost')
    expect(displayElement('')).toBe('')
    expect(displayElement(null)).toBe('')
    expect(displayElement(undefined)).toBe('')
  })
})

describe('displayProfession', () => {
  it.each([
    ['先锋', '先鋒'],
    ['术师', '術師'],
    ['突击', '突擊'],
    ['辅助', '輔助'],
    ['近卫', '近衛'],
    ['重装', '重裝'],
  ])('maps %s to %s', (value, expected) => {
    expect(displayProfession(value)).toBe(expected)
  })

  it('returns the original value for unknown profession', () => {
    expect(displayProfession('哨兵')).toBe('哨兵')
    expect(displayProfession(null)).toBe('')
  })
})

describe('displayRoleOrTag', () => {
  it('maps the dps role', () => {
    expect(displayRoleOrTag('dps')).toBe('輸出')
  })

  it.each([
    ['tag_01', '效果標籤 01'],
    ['tag-01', '效果標籤 01'],
    ['tag_28', '效果標籤 28'],
  ])('maps %s to %s', (value, expected) => {
    expect(displayRoleOrTag(value)).toBe(expected)
  })

  it('falls back to a readable 定位標籤 for unknown tokens', () => {
    expect(displayRoleOrTag('burst')).toBe('定位標籤 burst')
    expect(displayRoleOrTag('')).toBe('')
    expect(displayRoleOrTag(null)).toBe('')
  })
})

describe('displayLabel', () => {
  it('dispatches element, then profession, then role/tag', () => {
    expect(displayLabel('Fire')).toBe('火焰')
    expect(displayLabel('先锋')).toBe('先鋒')
    expect(displayLabel('dps')).toBe('輸出')
    expect(displayLabel('tag_03')).toBe('效果標籤 03')
    expect(displayLabel('unknown')).toBe('定位標籤 unknown')
  })
})

describe('displaySkillType', () => {
  it.each([
    ['battle', '戰技'],
    ['combo', '連攜技'],
    ['ultimate', '終結技'],
  ])('maps %s to %s', (value, expected) => {
    expect(displaySkillType(value)).toBe(expected)
  })
})

describe('missingSkillTypeLabels', () => {
  it('returns labels for missing skill types derived from skills[].type', () => {
    expect(
      missingSkillTypeLabels([{ type: 'battle' }, { type: 'ultimate' }]),
    ).toEqual(['連攜技'])
    expect(
      missingSkillTypeLabels([{ type: 'combo' }, { type: 'ultimate' }]),
    ).toEqual(['戰技'])
  })

  it('returns empty when all known types are present', () => {
    expect(
      missingSkillTypeLabels([
        { type: 'battle' },
        { type: 'combo' },
        { type: 'ultimate' },
      ]),
    ).toEqual([])
  })

  it('derives purely from type without hardcoding character ids', () => {
    expect(missingSkillTypeLabels([{ type: 'battle' }, { type: 'combo' }])).toEqual([
      '終結技',
    ])
  })
})
