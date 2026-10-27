import type { EquipmentFact, EquipmentSlot } from '@/types/domain'

// Pure eligibility helpers for equipment manufacturing.
//
// Design notes (per project requirements):
// - Eligibility is decided ONLY by the currently configured manufacturing level.
// - Story progress (chapterId / chapterOrder / chapters) is intentionally ignored.
//   Equipment with a chapter gate still qualifies once its player-level gate is met.
// - These functions never slice, cap, or rank by relevance. They only judge
//   eligibility and produce a deterministic ordering. UI concerns live elsewhere.

const isFiniteNumber = (value: number): boolean => Number.isFinite(value)

/**
 * True when the equipment is manufacturable at the given player level, based
 * purely on `craftable` and `unlock.playerLevel`.
 *
 * Excludes: craftable !== true, null playerLevel, and gear whose playerLevel
 * gate exceeds the provided level. Story/chapter fields are never consulted.
 *
 * A non-finite `playerLevel` is treated as "no usable level", so nothing is
 * eligible. Decimals use the raw comparison (we do not round or guess tiers).
 */
export const isLevelEligible = (
  equipment: EquipmentFact,
  playerLevel: number,
): boolean => {
  if (!isFiniteNumber(playerLevel)) return false
  if (equipment.craftable !== true) return false
  const gate = equipment.unlock.playerLevel
  if (gate === null) return false
  return gate <= playerLevel
}

/**
 * Selects every craftable equipment item for `slot` whose player-level gate is
 * satisfied by `playerLevel`, ignoring story progress.
 *
 * - Unknown/empty slots and non-finite levels yield an empty array.
 * - Duplicate ids are collapsed (first occurrence wins).
 * - No result count cap is applied.
 * - Ordering is deterministic and independent of input order:
 *   rarity DESC, then playerLevel DESC, then id ASC.
 */
export const selectLevelEligibleEquipment = (
  equipment: EquipmentFact[],
  slot: EquipmentSlot,
  playerLevel: number,
): EquipmentFact[] => {
  if (!isFiniteNumber(playerLevel)) return []
  if (!equipment || equipment.length === 0) return []

  // Deduplicate by id (first occurrence wins); guard against null slot too.
  const seen = new Set<string>()
  const eligible: EquipmentFact[] = []
  for (const item of equipment) {
    if (item.slot !== slot) continue
    if (seen.has(item.id)) continue
    if (!isLevelEligible(item, playerLevel)) continue
    seen.add(item.id)
    eligible.push(item)
  }

  eligible.sort(
    (a, b) =>
      (b.rarity ?? 0) - (a.rarity ?? 0) ||
      (b.unlock.playerLevel ?? 0) - (a.unlock.playerLevel ?? 0) ||
      a.id.localeCompare(b.id),
  )

  return eligible
}

/**
 * Groups every level-eligible, craftable equipment into the three equip slots
 * (body / hand / edc), ignoring story progress.
 *
 * Convenience wrapper around `selectLevelEligibleEquipment` so callers can
 * render all three slots in one pass without separate calls. Every eligible
 * item is included (no count cap, no relevance filter). Duplicate ids are
 * collapsed per slot (first occurrence wins), and each slot is ordered with the
 * same deterministic comparator used elsewhere.
 */
export const selectLevelEligibleEquipmentBySlot = (
  equipment: EquipmentFact[],
  playerLevel: number,
): Record<EquipmentSlot, EquipmentFact[]> => {
  const slots: EquipmentSlot[] = ['body', 'hand', 'edc']
  const result = {} as Record<EquipmentSlot, EquipmentFact[]>
  for (const slot of slots) {
    result[slot] = selectLevelEligibleEquipment(equipment, slot, playerLevel)
  }
  return result
}

/**
 * True when eligibility cannot be decided purely from the configured level:
 * either `craftable` is unknown (null) or the player-level gate is unknown
 * (null). Such items are shown in a separate "無法判定" section rather than
 * being silently dropped or accepted.
 *
 * An explicit `craftable === false` is never indeterminate: the source has
 * already told us the item cannot be manufactured, regardless of its level
 * data. Those records stay excluded from both the eligible and unknown lists.
 */
export const isIndeterminate = (equipment: EquipmentFact): boolean =>
  equipment.craftable !== false &&
  (equipment.craftable === null || equipment.unlock.playerLevel === null)

/**
 * Selects every equipment item for `slot` whose eligibility cannot be decided
 * from the configured level (unknown craftable flag or unknown player-level
 * gate). Used to surface "無法判定" gear explicitly rather than guess.
 */
export const selectIndeterminateEquipment = (
  equipment: EquipmentFact[],
  slot: EquipmentSlot,
): EquipmentFact[] => {
  if (!equipment || equipment.length === 0) return []
  const seen = new Set<string>()
  const indeterminate: EquipmentFact[] = []
  for (const item of equipment) {
    if (item.slot !== slot) continue
    if (seen.has(item.id)) continue
    if (!isIndeterminate(item)) continue
    seen.add(item.id)
    indeterminate.push(item)
  }
  indeterminate.sort((a, b) => a.id.localeCompare(b.id))
  return indeterminate
}

/**
 * Groups every indeterminate equipment item into the three equip slots. The
 * result mirrors `selectLevelEligibleEquipmentBySlot` but lists gear whose
 * level-based eligibility cannot be judged from the current data.
 */
export const selectIndeterminateEquipmentBySlot = (
  equipment: EquipmentFact[],
): Record<EquipmentSlot, EquipmentFact[]> => {
  const slots: EquipmentSlot[] = ['body', 'hand', 'edc']
  const result = {} as Record<EquipmentSlot, EquipmentFact[]>
  for (const slot of slots) {
    result[slot] = selectIndeterminateEquipment(equipment, slot)
  }
  return result
}
