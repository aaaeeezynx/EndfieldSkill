// Self-contained APCA-W3 0.1.9 (4g) implementation for design audits.
// Reads the ACTUAL design tokens / component colors used in the project and
// measures the real text/background pairings. Rarity purple/gold are border
// colors (decorative, non-text) and are intentionally NOT scored as text.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const normBG = 0.56
const normTXT = 0.57
const revTXT = 0.62
const revBG = 0.65
const blkThrs = 0.022
const blkClmp = 1.414
const scaleBoW = 1.14
const scaleWoB = 1.14
const loBoWoffset = 0.027
const loWoBoffset = 0.027
const deltaYmin = 0.0005
const loClip = 0.1

function sRGBtoY(rgb) {
  const f = (v) => {
    v /= 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2])
}
function parse(hex) {
  hex = hex.replace('#', '')
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ]
}

function parseAlpha(value) {
  if (value === undefined) return 1
  const text = value.trim()
  if (text.endsWith('%')) return parseFloat(text) / 100
  return parseFloat(text)
}

function parseRgbChannel(value) {
  const text = value.trim()
  const number = text.endsWith('%')
    ? parseFloat(text) * 2.55
    : parseFloat(text)
  return Math.max(0, Math.min(255, Math.round(number)))
}

// Parse #rgb / #rgba / #rrggbb / #rrggbbaa, legacy rgb()/rgba(), modern
// space-separated rgb(), and color(srgb ...). Chrome exposes placeholder text
// as color(srgb ...), so accepting that computed form is required for a
// complete rendered audit.
export function parseColor(str) {
  if (typeof str !== 'string') return null
  const s = str.trim()
  if (s.startsWith('#')) {
    let h = s.slice(1)
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    if (h.length === 4) {
      h = h.split('').map((c) => c + c).join('')
    }
    if (h.length !== 6 && h.length !== 8) return null
    if (!/^[0-9a-f]+$/i.test(h)) return null
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    ]
  }

  const rgbComma = s.match(
    /^rgba?\(\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*(?:,\s*([\d.]+%?)\s*)?\)$/i,
  )
  if (rgbComma) {
    return [
      parseRgbChannel(rgbComma[1]),
      parseRgbChannel(rgbComma[2]),
      parseRgbChannel(rgbComma[3]),
      parseAlpha(rgbComma[4]),
    ]
  }

  const rgbSpace = s.match(
    /^rgba?\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+%?)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i,
  )
  if (rgbSpace) {
    return [
      parseRgbChannel(rgbSpace[1]),
      parseRgbChannel(rgbSpace[2]),
      parseRgbChannel(rgbSpace[3]),
      parseAlpha(rgbSpace[4]),
    ]
  }

  const srgb = s.match(
    /^color\(\s*srgb\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i,
  )
  if (srgb) {
    return [
      Math.max(0, Math.min(255, Math.round(parseFloat(srgb[1]) * 255))),
      Math.max(0, Math.min(255, Math.round(parseFloat(srgb[2]) * 255))),
      Math.max(0, Math.min(255, Math.round(parseFloat(srgb[3]) * 255))),
      parseAlpha(srgb[4]),
    ]
  }
  return null
}

// Composite a possibly-alpha foreground over an opaque background, returning a
// flat [r, g, b] (0-255) tuple suitable for sRGB->Y conversion.
export function composite(fg, bg) {
  const a = fg[3]
  return [
    Math.round(fg[0] * a + bg[0] * (1 - a)),
    Math.round(fg[1] * a + bg[1] * (1 - a)),
    Math.round(fg[2] * a + bg[2] * (1 - a)),
  ]
}

export function toHex(rgb) {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
}

export function apca(txtHex, bgHex) {
  const Yt = sRGBtoY(parse(txtHex))
  const Yb = sRGBtoY(parse(bgHex))
  let Yt2 = Yt > blkThrs ? Yt : Yt + Math.pow(blkThrs - Yt, blkClmp)
  let Yb2 = Yb > blkThrs ? Yb : Yb + Math.pow(blkThrs - Yb, blkClmp)
  if (Math.abs(Yb2 - Yt2) < deltaYmin) return 0
  let SApc
  if (Yb2 > Yt2) {
    SApc = (Math.pow(Yb2, normBG) - Math.pow(Yt2, normTXT)) * scaleBoW
  } else {
    SApc = (Math.pow(Yb2, revBG) - Math.pow(Yt2, revTXT)) * scaleWoB
  }
  if (Math.abs(SApc) < loClip) return 0
  return Math.round((SApc - Math.sign(SApc) * (Yb2 > Yt2 ? loBoWoffset : loWoBoffset)) * 1000) / 10
}

// APCA thresholds: body text |Lc| >= 75, large text >= 60, UI/focus >= 45.
export const APCA_THRESHOLDS = Object.freeze({ body: 75, large: 60, ui: 45 })
const { body: BODY, large: LARGE, ui: UI } = APCA_THRESHOLDS

// Reusable rendered-DOM audit helper. `fg` and `bg` are [r, g, b, a] tuples.
// Translucent text is flattened against the resolved opaque background before
// the APCA lightness contrast is calculated.
export function apcaPair(fg, bg, threshold) {
  if (!Array.isArray(fg) || !Array.isArray(bg)) {
    return { ok: false, reason: 'invalid color tuple' }
  }
  const flatFg = fg[3] < 1 ? composite(fg, bg) : fg.slice(0, 3)
  const lc = apca(toHex(flatFg), toHex(bg.slice(0, 3)))
  return {
    ok: Math.abs(lc) >= threshold,
    lc,
    threshold,
    foreground: toHex(flatFg),
    background: toHex(bg.slice(0, 3)),
  }
}

// Parse the simple literal custom properties in :root. Failing closed here is
// intentional: if a token becomes an unresolved alias or non-literal color,
// this audit stops instead of silently scoring a stale value.
function parseDesignTokens() {
  const path = join(WEB_ROOT, 'src', 'styles', 'design-tokens.css')
  const source = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const rootBlock = source.match(/:root\s*\{([\s\S]*?)\}/)
  if (!rootBlock) throw new Error('Cannot locate :root block in design-tokens.css')
  const tokens = new Map()
  for (const match of rootBlock[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(match[1], match[2].trim())
  }
  return tokens
}

const tokens = parseDesignTokens()
const token = (name) => {
  const value = tokens.get(name)
  if (!value) throw new Error(`Missing design token ${name}`)
  if (!parseColor(value)) throw new Error(`Token ${name} is not a literal color: ${value}`)
  return value
}

const sourceCache = new Map()
function componentColor(value, file) {
  if (!sourceCache.has(file)) {
    sourceCache.set(file, readFileSync(join(WEB_ROOT, file), 'utf8'))
  }
  if (!sourceCache.get(file).includes(value)) {
    throw new Error(`${file} no longer contains audited color ${value}`)
  }
  return value
}

// Real pairings from current design tokens and component hard-coded colors.
// Component literals are checked against their source file so stale audit
// values fail immediately. `expectFail` marks pairings we deliberately want to
// confirm are NOT accessible (yellow text on white); decorative non-text
// borders are logged but excluded from scoring.
const pair = (fg, bg, note, kind, extra = {}) => ({ fg, bg, note, kind, ...extra })
const pairs = [
  pair(token('--color-text-primary'), token('--color-bg-primary'), 'primary text on white (body)', 'body'),
  pair(token('--color-text-secondary'), token('--color-bg-primary'), 'secondary text on white (body)', 'body'),
  pair(token('--color-text-tertiary'), token('--color-bg-panel-hover'), 'tertiary text on panel hover (body)', 'body'),
  pair(token('--color-accent-blue'), token('--color-bg-primary'), 'blue link/eyebrow on white (large)', 'large'),
  pair(token('--color-text-primary'), token('--color-accent-primary'), 'primary text on yellow block (large)', 'large'),
  pair(token('--color-text-inverse'), token('--color-bg-inverse'), 'footer text on dark (body)', 'body'),
  pair(token('--color-text-inverse'), token('--color-accent-blue'), 'inverse text on blue (large)', 'large'),
  pair(token('--color-text-primary'), token('--color-bg-primary'), 'focus ring stroke on white (UI)', 'ui'),
  pair(token('--color-accent-orange'), token('--color-bg-primary'), 'accent orange on white (UI)', 'ui'),
  pair(token('--color-danger'), token('--color-bg-primary'), 'danger on white (UI)', 'ui'),
  pair(token('--color-success'), token('--color-bg-primary'), 'success on white (UI)', 'ui'),
  pair(token('--color-border-primary'), token('--color-bg-primary'), 'primary border on white (UI)', 'ui'),

  pair(componentColor('#f2f2f2', 'src/views/PlannerView.vue'), '#191919', 'Planner hero copy on black (body)', 'body'),
  pair(componentColor('#fffa00', 'src/views/PlannerView.vue'), '#191919', 'Planner hero accent on black (large)', 'large'),
  pair(componentColor('#fff', 'src/views/PlannerView.vue'), '#242424', 'Planner roster text on dark panel (body)', 'body'),
  pair(componentColor('#fffa00', 'src/views/PlannerView.vue'), '#242424', 'Planner roster accent on dark panel (large)', 'large'),
  pair(componentColor('#767676', 'src/views/PlannerView.vue'), '#ffffff', 'Planner borders on white (UI)', 'ui'),
  pair(componentColor('#8a3400', 'src/views/PlannerView.vue'), '#fff7ef', 'Planner warning label on warm white (UI)', 'ui'),
  pair(componentColor('#5a3a1a', 'src/views/PlannerView.vue'), '#fff8f1', 'Planner warning copy on cream (body)', 'body'),
  pair(componentColor('#7a3608', 'src/views/PlannerView.vue'), '#fff8f1', 'Planner warning link on cream (body)', 'body'),
  pair(componentColor('#5a5500', 'src/views/PlannerView.vue'), '#fffde7', 'Planner progress label on pale yellow (UI)', 'ui'),
  pair(componentColor('#565015', 'src/views/PlannerView.vue'), '#fffde7', 'Planner progress copy on pale yellow (body)', 'body'),

  pair(componentColor('#5c3a00', 'src/components/TeamDock.vue'), '#fff8ec', 'TeamDock notice on cream (body)', 'body'),
  pair(componentColor('#5c3a00', 'src/components/TeamDock.vue'), '#ffffff', 'TeamDock unverified note on white (body)', 'body'),
  pair(componentColor('#9e332a', 'src/components/TeamDock.vue'), '#ffffff', 'TeamDock validation on white (body)', 'body'),
  pair(componentColor('#5c3a00', 'src/components/TeamSummary.vue'), '#fff8ec', 'TeamSummary notice on cream (body)', 'body'),
  pair(componentColor('#8f3f00', 'src/components/TeamSummary.vue'), '#fff3e6', 'TeamSummary badge on warm white (body)', 'body'),

  pair(componentColor('#8f3f00', 'src/components/RotationBoard.vue'), '#ffffff', 'RotationBoard accent on white (body)', 'body'),
  pair(componentColor('#8f3f00', 'src/components/RotationBoard.vue'), '#fff4ec', 'RotationBoard ultimate on cream (body)', 'body'),
  pair(componentColor('#8f3f00', 'src/components/RotationBoard.vue'), '#fff8f1', 'RotationBoard warning on cream (UI)', 'ui'),
  pair(componentColor('#5c3a00', 'src/components/RotationBoard.vue'), '#fff8f1', 'RotationBoard fallback on cream (body)', 'body'),
  pair(componentColor('#5c3a00', 'src/components/RotationBoard.vue'), '#fff7ef', 'RotationBoard note on warm white (body)', 'body'),

  pair(componentColor('#5c3a00', 'src/components/EquipmentBoard.vue'), '#fff8e8', 'EquipmentBoard warning on cream (body)', 'body'),
  pair(componentColor('#145c35', 'src/components/EquipmentBoard.vue'), '#effbf2', 'EquipmentBoard success on green-cream (body)', 'body'),
  pair(componentColor('#3f3f3f', 'src/components/EquipmentBoard.vue'), '#f7f7f7', 'EquipmentBoard tertiary on grey (body)', 'body'),
  pair(componentColor('#5c3a00', 'src/components/EquipmentBoard.vue'), '#fffaf0', 'EquipmentBoard loadout warning on cream (body)', 'body'),

  pair(componentColor('#8f3f00', 'src/components/CharacterPicker.vue'), '#fff3e6', 'CharacterPicker notice on warm white (body)', 'body'),
  pair(componentColor('#191919', 'src/components/EquipmentArtwork.vue'), '#f7f7f7', 'EquipmentArtwork caption on grey (body)', 'body'),
  pair(componentColor('#3f3f3f', 'src/components/EquipmentArtwork.vue'), '#f7f7f7', 'EquipmentArtwork metadata on grey (body)', 'body'),

  pair(componentColor('#8a3400', 'src/views/DataView.vue'), '#fff7ef', 'DataView warning on warm white (body)', 'body'),
  pair(componentColor('#8a3400', 'src/views/DataView.vue'), '#fff8f1', 'DataView warning on cream (body)', 'body'),
  pair(componentColor('#8a3400', 'src/views/DataView.vue'), '#fafafa', 'DataView warning on grey (body)', 'body'),
  pair(componentColor('#5a3a1a', 'src/views/DataView.vue'), '#fff8f1', 'DataView warning copy on cream (body)', 'body'),
  pair(token('--color-text-secondary'), '#fafafa', 'DataView secondary on grey (body)', 'body'),
  pair(token('--color-text-secondary'), '#f0f0f0', 'DataView secondary on light grey (body)', 'body'),

  // Yellow on white is never used as text; assert it stays inaccessible.
  pair(token('--color-accent-primary'), token('--color-bg-primary'), 'yellow on white (must stay inaccessible)', 'body', { expectFail: true }),
  // Rarity borders (purple/gold/etc.) are decorative, NOT text. They are logged
  // for transparency but deliberately EXCLUDED from text-contrast scoring so
  // they are never mislabeled as accessible text pairings.
  pair(componentColor('#8b5cf6', 'src/components/EquipmentArtwork.vue'), '#ffffff', 'rarity purple BORDER (decorative, non-text)', 'ui', { decorative: true }),
  pair(componentColor('#d99b1c', 'src/components/EquipmentArtwork.vue'), '#ffffff', 'rarity gold BORDER (decorative, non-text)', 'ui', { decorative: true }),
]

const thresholdFor = { body: BODY, large: LARGE, ui: UI }

const isCliEntry = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isCliEntry) {
  const failures = []
  for (const p of pairs) {
    const fg = parseColor(p.fg)
    const bg = parseColor(p.bg)
    if (!fg || !bg) {
      console.log('SKIP ', 'unparseable', p.note)
      continue
    }
    // Decorative, non-text colors (e.g. rarity borders) are reported but never
    // scored against a text threshold.
    if (p.decorative) {
      const composedFg = fg[3] < 1 ? composite(fg, bg) : fg.slice(0, 3)
      const lc = apca(toHex(composedFg), toHex(bg.slice(0, 3)))
      console.log('DECOR', String(lc).padStart(8), 'excluded from text scoring', p.note)
      continue
    }
    // Compose the (possibly alpha) foreground over the opaque background.
    const composedFg = fg[3] < 1 ? composite(fg, bg) : fg.slice(0, 3)
    const lc = apca(toHex(composedFg), toHex(bg.slice(0, 3)))
    const threshold = thresholdFor[p.kind]
    const passed = Math.abs(lc) >= threshold
    if (p.expectFail) {
      const ok = !passed
      console.log((ok ? 'PASS' : 'FAIL').padEnd(5), String(lc).padStart(8), `must be < ${threshold}`, p.note)
      if (!ok) failures.push(`${p.note}: unexpectedly reached |Lc| ${lc} >= ${threshold}`)
    } else {
      console.log((passed ? 'PASS' : 'FAIL').padEnd(5), String(lc).padStart(8), `>= ${threshold}`, p.note)
      if (!passed) failures.push(`${p.note}: |Lc| ${lc} < ${threshold}`)
    }
  }
  if (failures.length) {
    console.error('\nAPCA contrast audit failed:')
    for (const f of failures) console.error(`- ${f}`)
    process.exitCode = 1
  } else {
    console.log('\nAPCA contrast audit passed.')
  }
}
