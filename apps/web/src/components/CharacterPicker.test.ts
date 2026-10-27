import { describe, expect, it } from 'vitest'
import { makeCharacter } from '@/test/fixtures'
import {
  applyFilterSelection,
  characterMatchesFilters,
} from './CharacterPicker.vue'

describe('CharacterPicker filter selection', () => {
  it('replaces the selection in single mode', () => {
    expect(applyFilterSelection(['Physical'], 'Fire', 'single')).toEqual(['Fire'])
  })

  it('toggles values without duplicates in multi mode', () => {
    expect(applyFilterSelection(['Physical'], 'Fire', 'multi')).toEqual([
      'Physical',
      'Fire',
    ])
    expect(applyFilterSelection(['Physical', 'Fire'], 'Physical', 'multi')).toEqual([
      'Fire',
    ])
  })
})

describe('CharacterPicker filter matching', () => {
  const character = makeCharacter('operator', {
    profession: '近卫',
    element: 'Physical',
    name: '測試角色',
    nameEn: 'Test Operator',
  })

  it('uses OR within a category and AND across categories', () => {
    expect(
      characterMatchesFilters(
        character,
        'test operator',
        '',
        ['Physical', 'Fire'],
        ['近卫', '术师'],
      ),
    ).toBe(true)
    expect(
      characterMatchesFilters(
        character,
        'test operator',
        '',
        ['Physical'],
        ['术师'],
      ),
    ).toBe(false)
    expect(
      characterMatchesFilters(character, 'test operator', '', [], []),
    ).toBe(true)
  })

  it('applies the free-text query before category filters', () => {
    expect(
      characterMatchesFilters(
        character,
        'test operator',
        '不存在',
        [],
        [],
      ),
    ).toBe(false)
    expect(
      characterMatchesFilters(
        character,
        'test operator',
        'OPERATOR',
        ['Physical'],
        ['近卫'],
      ),
    ).toBe(true)
  })

  it('does not match an unlabelled category through an empty filter', () => {
    const unlabelled = makeCharacter('unknown', {
      profession: null,
      element: null,
    })
    expect(
      characterMatchesFilters(unlabelled, 'unknown', '', ['Physical'], []),
    ).toBe(false)
    expect(
      characterMatchesFilters(unlabelled, 'unknown', '', [], ['近卫']),
    ).toBe(false)
    expect(characterMatchesFilters(unlabelled, 'unknown', '', [], [])).toBe(true)
  })
})
