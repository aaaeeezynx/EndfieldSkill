import OpenCC from 'opencc-js'

// Convert Simplified Chinese display strings to Traditional Chinese (Taiwan variant).
// Only ever applied to human-readable text, never to IDs, URLs, or enum values.
const converter = OpenCC.Converter({ from: 'cn', to: 'tw' })

// Keep Taiwan product wording and official names stable instead of letting
// the generic OpenCC vocabulary rewrite them.
const displayOverrides: ReadonlyArray<readonly [string, string]> = [
  ['編排臺', '編排台'],
  ['終末地 // 戰術編排臺', '終末地 // 戰術編排台'],
  ['終末地戰術編排臺', '終末地戰術編排台'],
]

// Return type is deliberately `string | null` (never `undefined`) so call sites
// that assign into `string | null` fields type-check without extra guards.
export const toTraditional = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null
  try {
    return displayOverrides.reduce(
      (converted, [from, to]) => converted.replaceAll(from, to),
      converter(value),
    )
  } catch {
    return value
  }
}

export const toTraditionalList = (
  values: string[] | null | undefined,
): string[] | null => {
  if (!values) return null
  return values.map((v) => toTraditional(v) ?? v)
}
