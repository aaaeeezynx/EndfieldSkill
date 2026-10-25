import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePlannerStore } from '@/stores/planner'
import { makeCharacter, makeChapter, makeDataset } from '@/test/fixtures'

describe('planner character selection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('blocks different forms of the same character from joining the team together', () => {
    const store = usePlannerStore()
    store.dataset = makeDataset({
      characters: [
        makeCharacter('admin-a', { name: '管理员' }),
        makeCharacter('admin-b', { name: '管理员' }),
        makeCharacter('perlica', { name: '佩丽卡' }),
      ],
    })

    store.toggleCharacter('admin-a')
    store.toggleCharacter('admin-b')

    expect(store.selectedCharacterIds).toEqual(['admin-a'])
    expect(store.notice).toBe('同一角色只能選擇一名')

    store.toggleCharacter('perlica')
    expect(store.selectedCharacterIds).toEqual(['admin-a', 'perlica'])
  })

  it('rejects the excluded Administrator B-form and unknown character IDs', () => {
    const store = usePlannerStore()
    store.dataset = makeDataset({
      characters: [
        makeCharacter('chr_0002_endminm', { name: '管理員' }),
        makeCharacter('chr_0003_endminf', { name: '管理員' }),
      ],
    })

    store.toggleCharacter('chr_0003_endminf')

    expect(store.selectedCharacterIds).toEqual([])
    expect(store.notice).toBe('此角色未開放，無法加入隊伍。')

    store.toggleCharacter('chr_9999_unknown')

    expect(store.selectedCharacterIds).toEqual([])
    expect(store.notice).toBe('找不到此角色，無法加入隊伍。')
  })

  it('blocks the fifth character while allowing one to four unique characters', () => {
    const store = usePlannerStore()
    store.dataset = makeDataset({
      characters: ['a', 'b', 'c', 'd', 'e'].map((id) => makeCharacter(id)),
      chapters: [makeChapter('chapter-1')],
    })
    store.playerLevelRaw = '60'
    store.chapterId = 'chapter-1'

    for (const id of ['a', 'b', 'c', 'd']) store.toggleCharacter(id)

    expect(store.selectedCharacterIds).toEqual(['a', 'b', 'c', 'd'])
    expect(store.validation.valid).toBe(true)

    store.toggleCharacter('e')

    expect(store.selectedCharacterIds).toEqual(['a', 'b', 'c', 'd'])
    expect(store.notice).toBe(
      '隊伍人數上限為 4 名。請先移除一名角色，再加入新角色。',
    )

    store.removeCharacter('b')
    store.toggleCharacter('e')

    expect(store.selectedCharacterIds).toEqual(['a', 'c', 'd', 'e'])
  })

  it('does not generate with zero selected characters', async () => {
    const store = usePlannerStore()
    store.dataset = makeDataset({
      characters: [makeCharacter('a')],
      chapters: [makeChapter('chapter-1')],
    })
    store.playerLevelRaw = '60'
    store.chapterId = 'chapter-1'

    await expect(store.generate()).resolves.toBe(false)
    expect(store.validation.valid).toBe(false)
    expect(store.validation.errors).toContain('至少選擇 1 名角色，最多 4 名。')
    expect(store.report).toBeNull()
  })

  it.each([
    [['a']],
    [['a', 'b']],
    [['a', 'b', 'c']],
    [['a', 'b', 'c', 'd']],
  ])('generates equipment and skill recommendations for roster %j', async (selectedIds) => {
    const store = usePlannerStore()
    store.dataset = makeDataset({
      characters: ['a', 'b', 'c', 'd'].map((id) => makeCharacter(id)),
      chapters: [makeChapter('chapter-1')],
    })
    store.selectedCharacterIds = selectedIds
    store.playerLevelRaw = '60'
    store.chapterId = 'chapter-1'

    await expect(store.generate()).resolves.toBe(true)
    expect(store.report?.equipment.map((loadout) => loadout.characterId)).toEqual(selectedIds)
    expect(store.report?.rotations[0].steps.map((step) => step.characterId)).toEqual(selectedIds)
  })

  it('filters B-form and unknown IDs before validation and recommendation generation', async () => {
    const store = usePlannerStore()
    store.dataset = makeDataset({
      characters: [
        makeCharacter('chr_0002_endminm', { name: '管理員' }),
        makeCharacter('perlica', { name: '佩麗卡' }),
        makeCharacter('chen', { name: '陳千語' }),
        makeCharacter('wulfgard', { name: '狼衛' }),
        makeCharacter('chr_0003_endminf', { name: '管理員' }),
      ],
      chapters: [makeChapter('chapter-1')],
    })
    store.selectedCharacterIds = [
      'chr_0002_endminm',
      'perlica',
      'chen',
      'wulfgard',
      'chr_0003_endminf',
      'chr_9999_unknown',
    ]
    store.playerLevelRaw = '60'
    store.chapterId = 'chapter-1'

    expect(store.selectedCharacters.map((character) => character.id)).toEqual([
      'chr_0002_endminm',
      'perlica',
      'chen',
      'wulfgard',
    ])
    expect(store.validation.valid).toBe(true)

    const generated = await store.generate()

    expect(generated).toBe(true)
    expect(store.selectedCharacterIds).toEqual([
      'chr_0002_endminm',
      'perlica',
      'chen',
      'wulfgard',
    ])
    expect(store.report?.equipment.map((loadout) => loadout.characterId)).toEqual([
      'chr_0002_endminm',
      'perlica',
      'chen',
      'wulfgard',
    ])
  })
})
