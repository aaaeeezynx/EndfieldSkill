import { describe, expect, it } from 'vitest'
import { validatePlannerInput } from '@/lib/validation'
import { makeChapter, makeCharacter } from '@/test/fixtures'

const characters = ['a', 'b', 'c', 'd', 'e'].map((id) => makeCharacter(id))
const chapters = [
  makeChapter('chapter-1', { order: 1, minPlayerLevel: 1 }),
  makeChapter('chapter-2', { order: 2, minPlayerLevel: 20 }),
]

const validate = (
  selectedCharacterIds: string[],
  playerLevelRaw = '25',
  chapterId: string | null = 'chapter-2',
  availableChapters = chapters,
) =>
  validatePlannerInput(
    { selectedCharacterIds, playerLevelRaw, chapterId },
    characters,
    availableChapters,
  )

describe('validatePlannerInput', () => {
  it.each([
    [['a']],
    [['a', 'b']],
    [['a', 'b', 'c']],
    [['d', 'c', 'b', 'a']],
  ])('accepts a unique roster of one to four characters %j', (roster) => {
    const result = validate(roster)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.playerLevel).toBe(25)
    expect(result.chapter?.id).toBe('chapter-2')
  })

  it.each([
    [[]],
    [['a', 'b', 'c', 'd', 'e']],
  ])('rejects a roster outside the one-to-four-player range %j', (roster) => {
    const result = validate(roster)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('至少選擇 1 名角色，最多 4 名。')
  })

  it.each([
    [['a', 'a', 'b', 'c'], '隊伍中有重複角色。'],
    [['a', 'b', 'c', 'unknown'], '隊伍包含資料集中不存在的角色。'],
  ])('rejects roster %j', (roster, expectedError) => {
    const result = validate(roster)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(expectedError)
  })

  it.each(['', '0', '1.5', '1000', 'abc'])('rejects invalid player level %j', (level) => {
    const result = validate(['a', 'b', 'c', 'd'], level)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('玩家等級必須是 1–999 的整數。')
  })

  it('does not block validation by chapter minimum player level', () => {
    const result = validate(['a', 'b', 'c', 'd'], '19', 'chapter-2')

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('allows chapter progress to be omitted when chapter data is unavailable', () => {
    const result = validate(['a', 'b', 'c', 'd'], '25', '', [])

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.chapter).toBeNull()
  })

  it('allows an explicit chapter omission when chapter records exist', () => {
    const result = validate(['a', 'b', 'c', 'd'], '25', null)

    expect(result.valid).toBe(true)
    expect(result.chapter).toBeNull()
  })

  it('ignores an unknown non-empty chapter because chapters do not gate planning', () => {
    const result = validate(['a', 'b', 'c', 'd'], '25', 'chapter-x')

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.chapter).toBeNull()
  })
})
