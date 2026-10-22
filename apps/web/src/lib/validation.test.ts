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
  it('accepts exactly four unique known characters with valid progress', () => {
    const result = validate(['d', 'c', 'b', 'a'])

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.playerLevel).toBe(25)
    expect(result.chapter?.id).toBe('chapter-2')
  })

  it.each([
    [['a', 'b', 'c'], '需要恰好 4 名角色，目前为 3 名。'],
    [['a', 'b', 'c', 'd', 'e'], '需要恰好 4 名角色，目前为 5 名。'],
    [['a', 'a', 'b', 'c'], '队伍中有重复角色。'],
    [['a', 'b', 'c', 'unknown'], '队伍包含数据集中不存在的角色。'],
  ])('rejects roster %j', (roster, expectedError) => {
    const result = validate(roster)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(expectedError)
  })

  it.each(['', '0', '1.5', '1000', 'abc'])('rejects invalid player level %j', (level) => {
    const result = validate(['a', 'b', 'c', 'd'], level)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('玩家等级必须是 1–999 的整数。')
  })

  it('enforces the chapter minimum player level', () => {
    const result = validate(['a', 'b', 'c', 'd'], '19', 'chapter-2')

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('该章节至少需要玩家等级 Lv.20。')
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

  it('rejects an unknown non-empty chapter only when chapter records exist', () => {
    expect(validate(['a', 'b', 'c', 'd'], '25', 'chapter-x').errors).toContain(
      '所选剧情章节不在资料库中。',
    )
    expect(validate(['a', 'b', 'c', 'd'], '25', 'chapter-x', []).valid).toBe(true)
  })
})
