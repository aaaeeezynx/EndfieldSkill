import { describe, expect, it } from 'vitest'
import type { EquipmentFact, EquipmentSlot, EquipmentUnlock } from '@/types/domain'
import {
  isIndeterminate,
  isLevelEligible,
  selectIndeterminateEquipment,
  selectIndeterminateEquipmentBySlot,
  selectLevelEligibleEquipment,
  selectLevelEligibleEquipmentBySlot,
} from './equipmentEligibility'

// Test factories. We only populate the fields the module reads so fixtures stay
// small and explicit about which gate is being exercised.
const makeUnlock = (overrides: Partial<EquipmentUnlock> = {}): EquipmentUnlock => ({
  playerLevel: null,
  playerLevelKind: null,
  chapterId: null,
  chapterOrder: null,
  materials: [],
  ...overrides,
})

const makeEquipment = (
  id: string,
  slot: EquipmentSlot,
  overrides: Partial<EquipmentFact> = {},
): EquipmentFact => ({
  id,
  name: id,
  slot,
  rarity: 1,
  setName: null,
  craftable: true,
  unlock: makeUnlock({ playerLevel: 1 }),
  formulaAuthorityRank: null,
  recipeTier: null,
  formulaId: null,
  domainName: null,
  recommendedFor: [],
  roleTags: [],
  elementTags: [],
  stats: {},
  description: null,
  sourceIds: [],
  ...overrides,
})

describe('isLevelEligible', () => {
  it('includes craftable gear whose player level gate is met', () => {
    const item = makeEquipment('eq_a', 'body', {
      craftable: true,
      unlock: makeUnlock({ playerLevel: 10 }),
    })
    expect(isLevelEligible(item, 10)).toBe(true)
    expect(isLevelEligible(item, 25)).toBe(true)
  })

  it('ignores chapter gates entirely (story progress is not consulted)', () => {
    const gated = makeEquipment('eq_chapter', 'body', {
      craftable: true,
      unlock: makeUnlock({
        playerLevel: 5,
        chapterId: 'chapter_3',
        chapterOrder: 3,
      }),
    })
    // Even though the player has no chapter progress, level alone decides.
    expect(isLevelEligible(gated, 5)).toBe(true)
    expect(isLevelEligible(gated, 20)).toBe(true)
  })

  it('excludes non-craftable gear', () => {
    const notCraftable = makeEquipment('eq_x', 'body', {
      craftable: false,
      unlock: makeUnlock({ playerLevel: 1 }),
    })
    const unknownCraftable = makeEquipment('eq_y', 'body', {
      craftable: null,
      unlock: makeUnlock({ playerLevel: 1 }),
    })
    expect(isLevelEligible(notCraftable, 10)).toBe(false)
    expect(isLevelEligible(unknownCraftable, 10)).toBe(false)
  })

  it('excludes gear whose player level gate is unknown (null)', () => {
    const noLevel = makeEquipment('eq_nl', 'body', {
      craftable: true,
      unlock: makeUnlock({ playerLevel: null }),
    })
    expect(isLevelEligible(noLevel, 10)).toBe(false)
  })

  it('excludes gear whose player level gate exceeds the configured level', () => {
    const high = makeEquipment('eq_high', 'body', {
      craftable: true,
      unlock: makeUnlock({ playerLevel: 30 }),
    })
    expect(isLevelEligible(high, 29)).toBe(false)
    expect(isLevelEligible(high, 30)).toBe(true)
  })

  it('treats a non-finite player level as ineligible', () => {
    const item = makeEquipment('eq_z', 'body', {
      craftable: true,
      unlock: makeUnlock({ playerLevel: 1 }),
    })
    expect(isLevelEligible(item, NaN)).toBe(false)
    expect(isLevelEligible(item, Infinity)).toBe(false)
    expect(isLevelEligible(item, -Infinity)).toBe(false)
  })

  it('uses the raw decimal comparison without rounding', () => {
    const item = makeEquipment('eq_dec', 'body', {
      craftable: true,
      unlock: makeUnlock({ playerLevel: 10 }),
    })
    // 9.9 < 10 so it stays ineligible; we do not round the player level.
    expect(isLevelEligible(item, 9.9)).toBe(false)
    expect(isLevelEligible(item, 10.5)).toBe(true)
  })
})

describe('selectLevelEligibleEquipment', () => {
  it('returns every eligible item for the slot (no count cap)', () => {
    const items: EquipmentFact[] = [
      makeEquipment('eq_1', 'body', { unlock: makeUnlock({ playerLevel: 1 }) }),
      makeEquipment('eq_2', 'body', { unlock: makeUnlock({ playerLevel: 5 }) }),
      makeEquipment('eq_3', 'body', { unlock: makeUnlock({ playerLevel: 10 }) }),
    ]
    const result = selectLevelEligibleEquipment(items, 'body', 10)
    // All rarity 1, so the deterministic order is player level DESC then id ASC.
    expect(result.map((e) => e.id)).toEqual(['eq_3', 'eq_2', 'eq_1'])
  })

  it('ignores story progress: chapter-gated gear still qualifies by level', () => {
    const items: EquipmentFact[] = [
      makeEquipment('eq_story', 'hand', {
        unlock: makeUnlock({ playerLevel: 8, chapterId: 'c5', chapterOrder: 5 }),
      }),
      makeEquipment('eq_plain', 'hand', {
        unlock: makeUnlock({ playerLevel: 8 }),
      }),
    ]
    const result = selectLevelEligibleEquipment(items, 'hand', 8)
    expect(result.map((e) => e.id).sort()).toEqual(['eq_plain', 'eq_story'])
  })

  it('excludes non-craftable, null-level, and over-level gear', () => {
    const items: EquipmentFact[] = [
      makeEquipment('eq_ok', 'body', { unlock: makeUnlock({ playerLevel: 5 }) }),
      makeEquipment('eq_no', 'body', { craftable: false, unlock: makeUnlock({ playerLevel: 1 }) }),
      makeEquipment('eq_null', 'body', { unlock: makeUnlock({ playerLevel: null }) }),
      makeEquipment('eq_high', 'body', { unlock: makeUnlock({ playerLevel: 99 }) }),
    ]
    const result = selectLevelEligibleEquipment(items, 'body', 10)
    expect(result.map((e) => e.id)).toEqual(['eq_ok'])
  })

  it('returns an empty array for an empty input', () => {
    expect(selectLevelEligibleEquipment([], 'body', 10)).toEqual([])
  })

  it('returns an empty array for an unknown slot', () => {
    const items = [makeEquipment('eq_a', 'body', { unlock: makeUnlock({ playerLevel: 1 }) })]
    expect(selectLevelEligibleEquipment(items, 'edc', 10)).toEqual([])
  })

  it('returns an empty array for a non-finite player level', () => {
    const items = [makeEquipment('eq_a', 'body', { unlock: makeUnlock({ playerLevel: 1 }) })]
    expect(selectLevelEligibleEquipment(items, 'body', NaN)).toEqual([])
    expect(selectLevelEligibleEquipment(items, 'body', Infinity)).toEqual([])
  })

  it('deduplicates by id (first occurrence wins)', () => {
    const base = makeEquipment('eq_dup', 'body', { unlock: makeUnlock({ playerLevel: 5 }) })
    const items: EquipmentFact[] = [
      base,
      { ...base, name: 'second copy' },
      { ...base, name: 'third copy' },
    ]
    const result = selectLevelEligibleEquipment(items, 'body', 10)
    expect(result).toHaveLength(1)
    // First occurrence wins, so the original fixture name is kept.
    expect(result[0].name).toBe('eq_dup')
  })

  it('isolates slots: only the requested slot is returned', () => {
    const items: EquipmentFact[] = [
      makeEquipment('eq_body', 'body', { unlock: makeUnlock({ playerLevel: 1 }) }),
      makeEquipment('eq_hand', 'hand', { unlock: makeUnlock({ playerLevel: 1 }) }),
      makeEquipment('eq_edc', 'edc', { unlock: makeUnlock({ playerLevel: 1 }) }),
    ]
    const result = selectLevelEligibleEquipment(items, 'hand', 10)
    expect(result.map((e) => e.id)).toEqual(['eq_hand'])
  })

  it('sorts deterministically: rarity DESC, player level DESC, id ASC', () => {
    const items: EquipmentFact[] = [
      makeEquipment('eq_low_r', 'body', { rarity: 1, unlock: makeUnlock({ playerLevel: 5 }) }),
      makeEquipment('eq_high_r', 'body', { rarity: 5, unlock: makeUnlock({ playerLevel: 5 }) }),
      makeEquipment('eq_same_r_low_lvl', 'body', { rarity: 3, unlock: makeUnlock({ playerLevel: 2 }) }),
      makeEquipment('eq_same_r_high_lvl', 'body', { rarity: 3, unlock: makeUnlock({ playerLevel: 20 }) }),
      makeEquipment('eq_z', 'body', { rarity: 3, unlock: makeUnlock({ playerLevel: 10 }) }),
      makeEquipment('eq_a', 'body', { rarity: 3, unlock: makeUnlock({ playerLevel: 10 }) }),
    ]
    const result = selectLevelEligibleEquipment(items, 'body', 50)
    expect(result.map((e) => e.id)).toEqual([
      'eq_high_r', // rarity 5
      'eq_same_r_high_lvl', // rarity 3, level 20
      'eq_a', // rarity 3, level 10, id asc
      'eq_z', // rarity 3, level 10, id asc
      'eq_same_r_low_lvl', // rarity 3, level 2
      'eq_low_r', // rarity 1
    ])
  })

  it('produces the same order regardless of input order', () => {
    const build = (): EquipmentFact[] => [
      makeEquipment('eq_a', 'body', { rarity: 3, unlock: makeUnlock({ playerLevel: 10 }) }),
      makeEquipment('eq_b', 'body', { rarity: 5, unlock: makeUnlock({ playerLevel: 10 }) }),
      makeEquipment('eq_c', 'body', { rarity: 3, unlock: makeUnlock({ playerLevel: 2 }) }),
    ]
    const forward = selectLevelEligibleEquipment(build(), 'body', 50)
    const reversed = selectLevelEligibleEquipment([...build()].reverse(), 'body', 50)
    expect(reversed.map((e) => e.id)).toEqual(forward.map((e) => e.id))
    expect(forward.map((e) => e.id)).toEqual(['eq_b', 'eq_a', 'eq_c'])
  })

  it('handles null rarity by treating it as 0', () => {
    const items: EquipmentFact[] = [
      makeEquipment('eq_known', 'body', { rarity: 2, unlock: makeUnlock({ playerLevel: 1 }) }),
      makeEquipment('eq_unknown', 'body', { rarity: null, unlock: makeUnlock({ playerLevel: 1 }) }),
    ]
    const result = selectLevelEligibleEquipment(items, 'body', 10)
    expect(result.map((e) => e.id)).toEqual(['eq_known', 'eq_unknown'])
  })
})

describe('boundary cases', () => {
  it('includes gear whose player level gate equals the configured level (inclusive)', () => {
    const items: EquipmentFact[] = [
      makeEquipment('eq_exact', 'body', { unlock: makeUnlock({ playerLevel: 10 }) }),
    ]
    // gate <= playerLevel, so an exact match is eligible.
    expect(selectLevelEligibleEquipment(items, 'body', 10).map((e) => e.id)).toEqual(['eq_exact'])
    // one level below is excluded.
    expect(selectLevelEligibleEquipment(items, 'body', 9)).toEqual([])
  })

  it('excludes gear with craftable false regardless of its level gate', () => {
    const items: EquipmentFact[] = [
      makeEquipment('eq_false', 'body', { craftable: false, unlock: makeUnlock({ playerLevel: 1 }) }),
      makeEquipment('eq_null', 'body', { craftable: null, unlock: makeUnlock({ playerLevel: 1 }) }),
    ]
    expect(selectLevelEligibleEquipment(items, 'body', 50)).toEqual([])
  })

  it('excludes gear whose player level gate is null (unknown gate)', () => {
    const items: EquipmentFact[] = [
      makeEquipment('eq_no_gate', 'body', { craftable: true, unlock: makeUnlock({ playerLevel: null }) }),
      makeEquipment('eq_ok', 'body', { craftable: true, unlock: makeUnlock({ playerLevel: 5 }) }),
    ]
    const result = selectLevelEligibleEquipment(items, 'body', 10)
    expect(result.map((e) => e.id)).toEqual(['eq_ok'])
  })

  it('ignores story/chapter and formula authority gates entirely', () => {
    // These fields must never affect eligibility under the level-only rule.
    const items: EquipmentFact[] = [
      makeEquipment('eq_chapter', 'hand', {
        unlock: makeUnlock({ playerLevel: 8, chapterId: 'c5', chapterOrder: 5 }),
      }),
      makeEquipment('eq_formula', 'hand', {
        formulaAuthorityRank: 3,
        recipeTier: 'T2',
        unlock: makeUnlock({ playerLevel: 8 }),
      }),
      makeEquipment('eq_plain', 'hand', { unlock: makeUnlock({ playerLevel: 8 }) }),
    ]
    const result = selectLevelEligibleEquipment(items, 'hand', 8)
    expect(result.map((e) => e.id).sort()).toEqual(['eq_chapter', 'eq_formula', 'eq_plain'])
  })

  it('does not filter by character, role, element, or recommendedFor relevance', () => {
    // The eligibility API takes no character, so relevance tags can never
    // exclude an otherwise level-eligible item (the "alternatives" must not be
    // truncated by role/element/recommendation fit).
    const items: EquipmentFact[] = [
      makeEquipment('eq_other_char', 'body', {
        recommendedFor: ['char_different'],
        roleTags: ['tank'],
        elementTags: ['fire'],
        unlock: makeUnlock({ playerLevel: 5 }),
      }),
      makeEquipment('eq_empty_tags', 'body', {
        recommendedFor: [],
        roleTags: [],
        elementTags: [],
        unlock: makeUnlock({ playerLevel: 5 }),
      }),
      makeEquipment('eq_self', 'body', {
        recommendedFor: ['char_self'],
        unlock: makeUnlock({ playerLevel: 5 }),
      }),
    ]
    const result = selectLevelEligibleEquipment(items, 'body', 10)
    expect(result.map((e) => e.id).sort()).toEqual([
      'eq_empty_tags',
      'eq_other_char',
      'eq_self',
    ])
  })

  it('returns the same eligible set regardless of which character is evaluated', () => {
    // Character isolation: the same equipment pool yields the identical slot
    // result for any character because no relevance filter is applied.
    const items: EquipmentFact[] = [
      makeEquipment('eq_a', 'body', { unlock: makeUnlock({ playerLevel: 5 }) }),
      makeEquipment('eq_b', 'hand', { unlock: makeUnlock({ playerLevel: 5 }) }),
      makeEquipment('eq_c', 'edc', { unlock: makeUnlock({ playerLevel: 5 }) }),
    ]
    const forHeroOne = selectLevelEligibleEquipmentBySlot(items, 10)
    const forHeroTwo = selectLevelEligibleEquipmentBySlot(items, 10)
    expect(forHeroOne).toEqual(forHeroTwo)
  })

  it('does not truncate a large eligible pool', () => {
    const items: EquipmentFact[] = Array.from({ length: 25 }, (_, index) =>
      makeEquipment(`eq_bulk_${index}`, 'body', {
        rarity: 1 + (index % 5),
        unlock: makeUnlock({ playerLevel: 1 + (index % 10) }),
      }),
    )
    const result = selectLevelEligibleEquipment(items, 'body', 50)
    expect(result).toHaveLength(25)
    // Highest rarity first, then highest player level, then id ASC.
    expect(result[0].rarity).toBe(5)
  })

  it('prefers the first occurrence when ids are duplicated', () => {
    const base = makeEquipment('eq_dup', 'body', {
      rarity: 4,
      name: 'first',
      unlock: makeUnlock({ playerLevel: 5 }),
    })
    const items: EquipmentFact[] = [
      base,
      { ...base, name: 'second' },
      { ...base, name: 'third' },
    ]
    const result = selectLevelEligibleEquipment(items, 'body', 10)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('first')
  })

  it('returns an empty array for a null/empty input', () => {
    expect(selectLevelEligibleEquipment([], 'body', 10)).toEqual([])
    expect(selectLevelEligibleEquipmentBySlot([], 10)).toEqual({
      body: [],
      hand: [],
      edc: [],
    })
  })
})

describe('selectLevelEligibleEquipmentBySlot', () => {
  it('groups all eligible gear into the three slots, ignoring story progress', () => {
    const items: EquipmentFact[] = [
      makeEquipment('eq_body_a', 'body', { unlock: makeUnlock({ playerLevel: 1, chapterId: 'c3' }) }),
      makeEquipment('eq_body_b', 'body', { unlock: makeUnlock({ playerLevel: 20 }) }),
      makeEquipment('eq_hand_a', 'hand', { unlock: makeUnlock({ playerLevel: 10 }) }),
      makeEquipment('eq_edc_a', 'edc', { unlock: makeUnlock({ playerLevel: 15 }) }),
      // Non-craftable and over-level gear must not appear in any slot.
      makeEquipment('eq_body_x', 'body', { craftable: false, unlock: makeUnlock({ playerLevel: 1 }) }),
      makeEquipment('eq_hand_x', 'hand', { unlock: makeUnlock({ playerLevel: 99 }) }),
    ]
    const grouped = selectLevelEligibleEquipmentBySlot(items, 25)
    expect(Object.keys(grouped).sort()).toEqual(['body', 'edc', 'hand'])
    expect(grouped.body.map((e) => e.id)).toEqual(['eq_body_b', 'eq_body_a'])
    expect(grouped.hand.map((e) => e.id)).toEqual(['eq_hand_a'])
    expect(grouped.edc.map((e) => e.id)).toEqual(['eq_edc_a'])
  })

  it('includes every eligible item per slot (no truncation, no relevance filter)', () => {
    const items: EquipmentFact[] = [
      makeEquipment('eq_body_1', 'body', { unlock: makeUnlock({ playerLevel: 1 }) }),
      makeEquipment('eq_body_2', 'body', { unlock: makeUnlock({ playerLevel: 5 }) }),
      makeEquipment('eq_body_3', 'body', { unlock: makeUnlock({ playerLevel: 10 }) }),
    ]
    const grouped = selectLevelEligibleEquipmentBySlot(items, 10)
    // All rarity 1, so deterministic order is player level DESC then id ASC.
    expect(grouped.body.map((e) => e.id)).toEqual(['eq_body_3', 'eq_body_2', 'eq_body_1'])
  })

  it('returns empty arrays for all slots on a non-finite player level', () => {
    const items = [makeEquipment('eq_a', 'body', { unlock: makeUnlock({ playerLevel: 1 }) })]
    const grouped = selectLevelEligibleEquipmentBySlot(items, NaN)
    expect(grouped.body).toEqual([])
    expect(grouped.hand).toEqual([])
    expect(grouped.edc).toEqual([])
  })

  it('deduplicates by id within each slot (first occurrence wins)', () => {
    const base = makeEquipment('eq_dup', 'hand', { unlock: makeUnlock({ playerLevel: 1 }) })
    const items: EquipmentFact[] = [
      base,
      { ...base, name: 'second copy' },
    ]
    const grouped = selectLevelEligibleEquipmentBySlot(items, 10)
    expect(grouped.hand).toHaveLength(1)
    expect(grouped.hand[0].name).toBe('eq_dup')
  })
})

describe('isIndeterminate', () => {
  it('classifies unknown craftable flags and unknown level gates separately', () => {
    expect(
      isIndeterminate(
        makeEquipment('eq_no_craftable', 'body', {
          craftable: null,
          unlock: makeUnlock({ playerLevel: 10 }),
        }),
      ),
    ).toBe(true)
    expect(
      isIndeterminate(
        makeEquipment('eq_no_level', 'body', {
          craftable: true,
          unlock: makeUnlock({ playerLevel: null }),
        }),
      ),
    ).toBe(true)
    expect(
      isIndeterminate(
        makeEquipment('eq_both_unknown', 'body', {
          craftable: null,
          unlock: makeUnlock({ playerLevel: null }),
        }),
      ),
    ).toBe(true)
  })

  it('never treats explicitly non-craftable gear as indeterminate', () => {
    expect(
      isIndeterminate(
        makeEquipment('eq_false', 'body', {
          craftable: false,
          unlock: makeUnlock({ playerLevel: null }),
        }),
      ),
    ).toBe(false)
    expect(
      isIndeterminate(
        makeEquipment('eq_false_known_level', 'body', {
          craftable: false,
          unlock: makeUnlock({ playerLevel: 10 }),
        }),
      ),
    ).toBe(false)
  })
})

describe('selectIndeterminateEquipment', () => {
  it('returns only unknown records for the requested slot', () => {
    const items: EquipmentFact[] = [
      makeEquipment('eq_ok', 'body', {
        craftable: true,
        unlock: makeUnlock({ playerLevel: 10 }),
      }),
      makeEquipment('eq_no_craftable', 'body', {
        craftable: null,
        unlock: makeUnlock({ playerLevel: 10 }),
      }),
      makeEquipment('eq_no_level', 'body', {
        craftable: true,
        unlock: makeUnlock({ playerLevel: null }),
      }),
      makeEquipment('eq_false', 'body', {
        craftable: false,
        unlock: makeUnlock({ playerLevel: null }),
      }),
      makeEquipment('eq_other_slot', 'hand', {
        craftable: null,
        unlock: makeUnlock({ playerLevel: 10 }),
      }),
    ]

    expect(
      selectIndeterminateEquipment(items, 'body').map((item) => item.id),
    ).toEqual(['eq_no_craftable', 'eq_no_level'])
  })

  it('deduplicates by id and uses a deterministic id ordering', () => {
    const base = makeEquipment('eq_dup', 'edc', {
      craftable: null,
      unlock: makeUnlock({ playerLevel: 10 }),
    })
    const items: EquipmentFact[] = [
      makeEquipment('eq_z', 'edc', {
        craftable: true,
        unlock: makeUnlock({ playerLevel: null }),
      }),
      base,
      { ...base, name: 'second copy' },
      makeEquipment('eq_a', 'edc', {
        craftable: null,
        unlock: makeUnlock({ playerLevel: 10 }),
      }),
    ]

    const result = selectIndeterminateEquipment(items, 'edc')
    expect(result.map((item) => item.id)).toEqual(['eq_a', 'eq_dup', 'eq_z'])
    expect(result.find((item) => item.id === 'eq_dup')?.name).toBe('eq_dup')
  })

  it('returns an empty array for an empty pool', () => {
    expect(selectIndeterminateEquipment([], 'body')).toEqual([])
  })
})

describe('selectIndeterminateEquipmentBySlot', () => {
  it('groups indeterminate gear into all three slots', () => {
    const items: EquipmentFact[] = [
      makeEquipment('eq_body', 'body', {
        craftable: null,
        unlock: makeUnlock({ playerLevel: 10 }),
      }),
      makeEquipment('eq_hand', 'hand', {
        craftable: true,
        unlock: makeUnlock({ playerLevel: null }),
      }),
      makeEquipment('eq_edc', 'edc', {
        craftable: null,
        unlock: makeUnlock({ playerLevel: null }),
      }),
      makeEquipment('eq_false', 'body', {
        craftable: false,
        unlock: makeUnlock({ playerLevel: null }),
      }),
      makeEquipment('eq_known', 'hand', {
        craftable: true,
        unlock: makeUnlock({ playerLevel: 1 }),
      }),
    ]

    const grouped = selectIndeterminateEquipmentBySlot(items)
    expect(Object.keys(grouped).sort()).toEqual(['body', 'edc', 'hand'])
    expect(grouped.body.map((item) => item.id)).toEqual(['eq_body'])
    expect(grouped.hand.map((item) => item.id)).toEqual(['eq_hand'])
    expect(grouped.edc.map((item) => item.id)).toEqual(['eq_edc'])
  })

  it('returns empty arrays when every record has a definitive status', () => {
    const items = [
      makeEquipment('eq_craftable', 'body', {
        craftable: true,
        unlock: makeUnlock({ playerLevel: 10 }),
      }),
      makeEquipment('eq_not_craftable', 'hand', {
        craftable: false,
        unlock: makeUnlock({ playerLevel: null }),
      }),
    ]

    expect(selectIndeterminateEquipmentBySlot(items)).toEqual({
      body: [],
      hand: [],
      edc: [],
    })
  })
})
