import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePlannerStore } from '@/stores/planner'
import { makeCharacter, makeDataset } from '@/test/fixtures'

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
    expect(store.notice).toBe('同一角色的不同形態不能同時上陣')

    store.toggleCharacter('perlica')
    expect(store.selectedCharacterIds).toEqual(['admin-a', 'perlica'])
  })
})
