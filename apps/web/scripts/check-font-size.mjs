// Static type-scale audit. The project intentionally sets the document root to
// 130%, so rem values must be resolved against 16px * 1.3 before comparing with
// the 12px minimum. This checker fails closed: context-dependent units,
// unresolved variables, and values it cannot prove are reported as failures.
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const MIN_PX = 12
const DEFAULT_ROOT_PX = 16
const CSS_UNITS = /^-?(?:\d+\.?\d*|\.\d+)(px|rem|em|%|vw|vh|vmin|vmax|ch|ex|cap|ic|lh|rlh|pt|pc|cm|mm|in|q)$/i
const SIZE_FUNCTION = /^(?:var|clamp|min|max|calc)\(/i
const SIZE_KEYWORD = /^(?:inherit|initial|unset|revert|revert-layer|medium|xx-small|x-small|small|large|x-large|xx-large|xxx-large|smaller|larger)$/i

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(vue|css)$/.test(entry.name)) out.push(full)
  }
  return out
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\r\n]/g, ' '),
  )
}

function splitTopLevel(value, separator = ',') {
  const parts = []
  let depth = 0
  let quote = null
  let start = 0
  for (let i = 0; i < value.length; i++) {
    const char = value[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
    } else if (char === '(') {
      depth++
    } else if (char === ')') {
      depth--
    } else if (char === separator && depth === 0) {
      parts.push(value.slice(start, i).trim())
      start = i + 1
    }
  }
  parts.push(value.slice(start).trim())
  return parts
}

function splitWhitespace(value) {
  const parts = []
  let depth = 0
  let quote = null
  let start = 0
  for (let i = 0; i < value.length; i++) {
    const char = value[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
    } else if (char === '(') {
      depth++
    } else if (char === ')') {
      depth--
    } else if (/\s/.test(char) && depth === 0) {
      if (start < i) parts.push(value.slice(start, i))
      start = i + 1
    }
  }
  if (start < value.length) parts.push(value.slice(start))
  return parts.filter(Boolean)
}

function extractDeclarations(source, file) {
  const declarations = []
  const stack = []
  let buffer = ''
  let quote = null
  let parenDepth = 0

  const addDeclaration = (raw) => {
    const context = [...stack].reverse().find((entry) => !entry.atRule)
    if (!context) return
    const colon = raw.indexOf(':')
    if (colon < 0) return
    const property = raw.slice(0, colon).trim().toLowerCase()
    const value = raw.slice(colon + 1).trim()
    if (/^--[\w-]+$|^font(?:-size)?$/.test(property) && value) {
      declarations.push({ property, value, selector: context.prelude, file })
    }
  }

  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quote) {
      buffer += char
      if (char === '\\') {
        if (i + 1 < source.length) buffer += source[++i]
      } else if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      buffer += char
      continue
    }
    if (char === '(') parenDepth++
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1)
    if (char === '{') {
      const prelude = buffer.trim()
      stack.push({ prelude, atRule: prelude.startsWith('@') })
      buffer = ''
      continue
    }
    if (char === ';' && parenDepth === 0) {
      addDeclaration(buffer)
      buffer = ''
      continue
    }
    if (char === '}') {
      addDeclaration(buffer)
      buffer = ''
      stack.pop()
      continue
    }
    buffer += char
  }
  return declarations
}

function formatPx(px) {
  return Math.round(px * 1000) / 1000
}

function parseNumber(value) {
  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(value) ? Number(value) : null
}

function createResolver(variables) {
  return function resolve(value, context = 'font-size', stack = []) {
    const input = value.trim().replace(/\s*!important\s*$/i, '')
    if (!input) return { ok: false, reason: 'empty value' }

    if (/^var\(/i.test(input)) {
      if (!input.endsWith(')')) return { ok: false, reason: `malformed variable expression "${input}"` }
      const inner = input.slice(input.indexOf('(') + 1, -1)
      const args = splitTopLevel(inner)
      const name = args[0]
      if (!/^--[\w-]+$/.test(name)) {
        return { ok: false, reason: `invalid variable name in "${input}"` }
      }
      if (stack.includes(name)) return { ok: false, reason: `cyclic variable ${name}` }
      const definitions = variables.get(name)
      if (!definitions || definitions.size === 0) {
        if (args.length > 1) return resolve(args.slice(1).join(','), context, stack)
        return { ok: false, reason: `unresolved CSS variable ${name}` }
      }
      if (definitions.size > 1) {
        return { ok: false, reason: `ambiguous CSS variable ${name} has ${definitions.size} different values` }
      }
      return resolve([...definitions][0], context, [...stack, name])
    }

    const functionMatch = input.match(/^(clamp|min|max)\(([\s\S]*)\)$/i)
    if (functionMatch) {
      const name = functionMatch[1].toLowerCase()
      const args = splitTopLevel(functionMatch[2])
      if (name === 'clamp') {
        if (args.length !== 3) {
          return { ok: false, reason: `clamp() must have 3 arguments in "${input}"` }
        }
        // The lower bound is the only guaranteed rendered size. The preferred
        // value may legitimately use vw, but an unsupported lower bound fails.
        const lower = resolve(args[0], context, stack)
        return lower.ok
          ? { ...lower, note: `clamp lower bound; preferred ${args[1]}, upper ${args[2]}` }
          : { ok: false, reason: `unresolvable clamp lower bound: ${lower.reason}` }
      }
      if (!args.length) return { ok: false, reason: `empty ${name}()` }
      const resolved = args.map((arg) => resolve(arg, context, stack))
      const failed = resolved.find((result) => !result.ok)
      if (failed) return { ok: false, reason: `unresolvable ${name}() argument: ${failed.reason}` }
      const px = name === 'min'
        ? Math.min(...resolved.map((result) => result.px))
        : Math.max(...resolved.map((result) => result.px))
      return { ok: true, px }
    }

    if (/^calc\(/i.test(input)) {
      return { ok: false, reason: `calc() is context-dependent and not statically auditable: "${input}"` }
    }

    const lower = input.toLowerCase()
    if (SIZE_KEYWORD.test(lower)) {
      return { ok: false, reason: `context-dependent keyword "${input}"` }
    }

    const match = input.match(CSS_UNITS)
    if (!match) {
      return { ok: false, reason: `unsupported or malformed font-size "${input}"` }
    }
    const number = parseNumber(input.slice(0, -match[1].length))
    if (number == null) return { ok: false, reason: `malformed numeric font-size "${input}"` }
    const unit = match[1].toLowerCase()
    if (unit === 'px') return { ok: true, px: number }
    if (unit === 'rem') return { ok: true, px: number * context.rootPx }
    if (unit === '%' && context.allowRootPercent) {
      return { ok: true, px: DEFAULT_ROOT_PX * number / 100 }
    }
    if (unit === '%' || unit === 'em') {
      return { ok: false, reason: `context-dependent ${unit} font-size "${input}"` }
    }
    return { ok: false, reason: `unsupported ${unit} font-size "${input}"` }
  }
}

function extractFontShorthandSize(value) {
  if (/^\s*(?:inherit|initial|unset|revert|revert-layer)\s*$/i.test(value)) return null
  const tokens = splitWhitespace(value.replace(/\s*!important\s*$/i, ''))
  for (const token of tokens) {
    const sizeToken = token.split('/')[0]
    if (
      CSS_UNITS.test(sizeToken) ||
      SIZE_FUNCTION.test(sizeToken) ||
      /^0(?:\.0+)?$/.test(sizeToken)
    ) {
      return sizeToken
    }
  }
  return ''
}

const files = walk(root).map((file) => ({ file, source: stripComments(readFileSync(file, 'utf8')) }))
const declarations = files.flatMap(({ file, source }) => extractDeclarations(source, file))

const variables = new Map()
for (const declaration of declarations) {
  if (!declaration.property.startsWith('--')) continue
  if (!variables.has(declaration.property)) variables.set(declaration.property, new Set())
  variables.get(declaration.property).add(declaration.value)
}

const failures = []
const rootDeclarations = declarations.filter(
  (declaration) =>
    declaration.property === 'font-size' &&
    /^(?:html|:root|html\s*,\s*:root|:root\s*,\s*html)$/i.test(declaration.selector),
)
let rootPx = DEFAULT_ROOT_PX
if (rootDeclarations.length) {
  const values = new Set(rootDeclarations.map((declaration) => declaration.value))
  if (values.size > 1) {
    failures.push(`root font-size is ambiguous: ${[...values].join(' | ')}`)
  } else {
    const value = [...values][0].trim()
    const px = value.match(/^([\d.]+)px$/i)
    const percent = value.match(/^([\d.]+)%$/i)
    if (px) rootPx = Number(px[1])
    else if (percent) rootPx = DEFAULT_ROOT_PX * Number(percent[1]) / 100
    else failures.push(`root font-size cannot be resolved statically: "${value}"`)
  }
}
if (rootPx < MIN_PX) failures.push(`root font-size ${formatPx(rootPx)}px is below ${MIN_PX}px`)

const resolve = createResolver(variables)
const checked = []
for (const declaration of declarations) {
  let sizeValue
  if (declaration.property === 'font-size') {
    sizeValue = declaration.value
  } else if (declaration.property === 'font') {
    sizeValue = extractFontShorthandSize(declaration.value)
    if (sizeValue == null) continue // font: inherit is intentionally ignored.
    if (!sizeValue) {
      failures.push(`${declaration.file}: cannot extract a size from font shorthand "${declaration.value}"`)
      continue
    }
  } else {
    continue
  }

  const isRoot = rootDeclarations.includes(declaration)
  const result = resolve(sizeValue, {
    rootPx,
    allowRootPercent: isRoot,
  })
  if (!result.ok) {
    failures.push(`${declaration.file}: ${declaration.property} "${sizeValue}" (${declaration.selector}): ${result.reason}`)
    continue
  }
  checked.push(result.px)
  if (result.px < MIN_PX) {
    failures.push(
      `${declaration.file}: ${declaration.property} ${sizeValue} = ${formatPx(result.px)}px ` +
      `(selector ${declaration.selector || 'unknown'}) < ${MIN_PX}px`,
    )
  }
}

// Catch scale() anywhere in a transform, including compound values such as
// `translateX(1px) scale(1.3)`, while ignoring unrelated scale-like words.
const scaleRe = /transform\s*:\s*[^;{}]*\bscale\s*\(/gi
for (const { file, source } of files) {
  if (scaleRe.test(source)) {
    failures.push(`${file}: transform: scale() used for whole-page magnification`)
  }
}

if (failures.length) {
  console.error('Font size audit failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(
    `Font size audit passed: ${checked.length} declarations resolved; all >= ${MIN_PX}px ` +
    `at root ${formatPx(rootPx)}px.`,
  )
}
