// Display-layer labels only. Nothing here participates in matching or filtering
// logic; these helpers exist purely to localize raw ENUM/token values for the UI
// so that the visible text is Traditional Chinese. Matching still uses raw values.

const ELEMENT_LABELS: Readonly<Record<string, string>> = {
  Physical: '物理',
  Pulse: '脈衝',
  Fire: '火焰',
  Natural: '自然',
  Cryst: '結晶',
  cold: '寒冷',
}

const PROFESSION_LABELS: Readonly<Record<string, string>> = {
  先锋: '先鋒',
  术师: '術師',
  突击: '突擊',
  辅助: '輔助',
  近卫: '近衛',
  重装: '重裝',
}

const ROLE_LABELS: Readonly<Record<string, string>> = {
  dps: '輸出',
}

const SKILL_TYPE_LABELS: Readonly<Record<string, string>> = {
  battle: '戰技',
  combo: '連攜技',
  ultimate: '終結技',
}

// The canonical set of skill types a character may hold.
export const KNOWN_SKILL_TYPES = ['battle', 'combo', 'ultimate'] as const
export type KnownSkillType = (typeof KNOWN_SKILL_TYPES)[number]

const asKey = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

/**
 * Localize a raw element token for display. Unknown or empty values are
 * returned unchanged so the UI never renders null.
 */
export const displayElement = (value: string | null | undefined): string => {
  const key = asKey(value)
  if (!key) return value ?? ''
  return ELEMENT_LABELS[key] ?? key
}

/**
 * Localize a raw profession token (which may itself be simplified Chinese).
 * Unknown values are returned unchanged.
 */
export const displayProfession = (value: string | null | undefined): string => {
  const key = asKey(value)
  if (!key) return value ?? ''
  return PROFESSION_LABELS[key] ?? key
}

/**
 * Localize a role or tag token.
 * - `dps` -> 輸出
 * - `tag_01` / `tag-01` -> 效果標籤 01 (prefix stripped, number preserved)
 * - unknown token -> 定位標籤 <raw>
 */
export const displayRoleOrTag = (value: string | null | undefined): string => {
  const key = asKey(value)
  if (!key) return value ?? ''

  if (ROLE_LABELS[key]) return ROLE_LABELS[key]

  const tagMatch = key.match(/^tag[-_](\d+)$/i)
  if (tagMatch) return `效果標籤 ${tagMatch[1]}`

  return `定位標籤 ${key}`
}

/**
 * Generic dispatch: try element first, then profession, then role/tag.
 * Returns the original value (as a string) when nothing matches.
 */
export const displayLabel = (value: string | null | undefined): string => {
  const key = asKey(value)
  if (!key) return value ?? ''
  if (ELEMENT_LABELS[key]) return ELEMENT_LABELS[key]
  if (PROFESSION_LABELS[key]) return PROFESSION_LABELS[key]
  return displayRoleOrTag(key)
}

/** Localize a skill-type token for display (battle/combo/ultimate). */
export const displaySkillType = (value: string | null | undefined): string => {
  const key = asKey(value)
  if (!key) return value ?? ''
  return SKILL_TYPE_LABELS[key] ?? key
}

/**
 * Determine which of the known skill types a character is MISSING, derived
 * purely from the `type` of each entry in `character.skills`. Returns the
 * localized labels (e.g. 戰技 / 連攜技 / 終結技) for any missing types.
 */
export const missingSkillTypeLabels = (
  skills: ReadonlyArray<{ type?: string }> | null | undefined,
): string[] => {
  const present = new Set(
    (skills ?? []).map((skill) => skill?.type).filter(Boolean) as string[],
  )
  return KNOWN_SKILL_TYPES.filter((type) => !present.has(type)).map(
    (type) => SKILL_TYPE_LABELS[type],
  )
}
