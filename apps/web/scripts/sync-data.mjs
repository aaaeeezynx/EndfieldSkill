import {
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(process.env.ENDFIELD_DATA_SOURCE ?? resolve(webRoot, '../../data/v1'))
const target = resolve(process.env.ENDFIELD_DATA_TARGET ?? resolve(webRoot, 'public/data/v1'))

const REQUIRED_JSON_FILES = [
  'meta.json',
  'characters.json',
  'equipment.json',
  'progressions.json',
  'team-presets.json',
  'rotation-presets.json',
  'sources.json',
]

const COLLECTION_PATHS = {
  'characters.json': ['characters'],
  'equipment.json': ['equipment'],
  'team-presets.json': ['teams'],
  'rotation-presets.json': ['rotations'],
  'sources.json': ['sources'],
}

// The Administrator is represented by the A-form (chr_0002_endminm) only.
// Both excluded tokens are checked in every JSON key and string value.
const EXCLUDED_CHARACTER_IDS = ['chr_0003_endminf', 'chr_9000_endmin']

const pathExists = async (path) =>
  stat(path)
    .then(() => true)
    .catch(() => false)

const valueAtPath = (value, segments) =>
  segments.reduce((current, segment) => current?.[segment], value)

const formatPointer = (segments) =>
  segments.length ? `$${segments.map((segment) => `.${segment}`).join('')}` : '$'

const scanForExcludedIds = (value, file, segments, leaks) => {
  if (typeof value === 'string') {
    for (const id of EXCLUDED_CHARACTER_IDS) {
      if (value.includes(id)) leaks.push(`${file}:${formatPointer(segments)}`)
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      scanForExcludedIds(entry, file, [...segments, index], leaks),
    )
    return
  }

  if (!value || typeof value !== 'object') return

  for (const [key, entry] of Object.entries(value)) {
    for (const id of EXCLUDED_CHARACTER_IDS) {
      if (key.includes(id)) leaks.push(`${file}:${formatPointer([...segments, key])}`)
    }
    scanForExcludedIds(entry, file, [...segments, key], leaks)
  }
}

const assertUniqueIds = (file, records, label) => {
  const seen = new Set()
  for (const [index, record] of records.entries()) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`${file}: ${label}[${index}] must be an object`)
    }
    if (typeof record.id !== 'string' || !record.id.trim()) {
      throw new Error(`${file}: ${label}[${index}].id must be a non-empty string`)
    }
    if (seen.has(record.id)) {
      throw new Error(`${file}: duplicate ${label} id "${record.id}"`)
    }
    seen.add(record.id)
  }
}

const validateSemantics = (file, payload) => {
  if (file === 'characters.json') {
    assertUniqueIds(file, payload.characters, 'characters')
    return
  }
  if (file === 'equipment.json') {
    assertUniqueIds(file, payload.equipment, 'equipment')
    return
  }
  if (file === 'team-presets.json') {
    assertUniqueIds(file, payload.teams, 'teams')
    for (const team of payload.teams) {
      const ids = Array.isArray(team.characterIds) ? team.characterIds : []
      if (ids.length < 1 || ids.length > 4 || new Set(ids).size !== ids.length) {
        throw new Error(
          `${file}: team "${team.id}" must contain 1 to 4 unique characterIds`,
        )
      }
    }
    return
  }
  if (file === 'rotation-presets.json') {
    assertUniqueIds(file, payload.rotations, 'rotations')
    for (const rotation of payload.rotations) {
      const steps = Array.isArray(rotation.steps) ? rotation.steps : []
      const actualOrders = steps.map((step) => step?.order).sort((a, b) => a - b)
      const expectedOrders = steps.map((_, index) => index + 1)
      if (JSON.stringify(actualOrders) !== JSON.stringify(expectedOrders)) {
        throw new Error(
          `${file}: rotation "${rotation.id}" step order must be contiguous from 1`,
        )
      }
    }
    return
  }
  if (file === 'sources.json') {
    assertUniqueIds(file, payload.sources, 'sources')
  }
}

const readAndValidateCanonicalFiles = async (sourceEntries) => {
  const jsonFiles = sourceEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()

  const missing = REQUIRED_JSON_FILES.filter((file) => !jsonFiles.includes(file))
  if (missing.length) {
    throw new Error(`canonical dataset is missing required file(s): ${missing.join(', ')}`)
  }

  const leaks = []
  for (const file of jsonFiles) {
    let text
    try {
      text = await readFile(resolve(source, file), 'utf8')
    } catch (error) {
      throw new Error(`${file}: unable to read file (${error.message})`)
    }

    let payload
    try {
      payload = JSON.parse(text)
    } catch (error) {
      throw new Error(`${file}: malformed JSON (${error.message})`)
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error(`${file}: top-level JSON value must be an object`)
    }

    const collectionPath = COLLECTION_PATHS[file]
    if (collectionPath && !Array.isArray(valueAtPath(payload, collectionPath))) {
      throw new Error(`${file}: ${formatPointer(collectionPath)} must be an array`)
    }

    validateSemantics(file, payload)
    scanForExcludedIds(payload, file, [], leaks)
  }

  if (leaks.length) {
    throw new Error(
      `canonical dataset contains excluded Administrator form reference(s): ${leaks.join(', ')}`,
    )
  }

  return jsonFiles
}

const wait = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))

const renameWithRetry = async (from, to) => {
  const retryableCodes = new Set(['EACCES', 'EBUSY', 'EPERM', 'ENOTEMPTY'])
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      if (!retryableCodes.has(error.code) || attempt === 5) throw error
      await wait(50 * (attempt + 1))
    }
  }
}

const replaceMirror = async (jsonFiles) => {
  const mirrorParent = dirname(target)
  const suffix = `${process.pid}-${Date.now()}`
  const staging = resolve(mirrorParent, `.v1.staging-${suffix}`)
  const backup = resolve(mirrorParent, `.v1.backup-${suffix}`)
  let targetBackedUp = false

  await mkdir(mirrorParent, { recursive: true })
  await mkdir(staging)
  try {
    for (const file of jsonFiles) {
      await cp(resolve(source, file), resolve(staging, file))
    }
    await writeFile(resolve(staging, '.gitkeep'), '\n', 'utf8')

    try {
      if (await pathExists(target)) {
        await renameWithRetry(target, backup)
        targetBackedUp = true
      }
      await renameWithRetry(staging, target)
    } catch (error) {
      if (targetBackedUp) {
        try {
          await renameWithRetry(backup, target)
          targetBackedUp = false
        } catch (rollbackError) {
          throw new Error(
            `mirror replacement failed (${error.message}); rollback also failed ` +
              `(${rollbackError.message}). Previous mirror preserved at ${backup}`,
          )
        }
      }
      throw error
    }

    if (targetBackedUp) {
      try {
        await rm(backup, { recursive: true, force: true })
      } catch (error) {
        console.warn(
          `[data-sync] mirror updated, but backup cleanup failed: ${backup} (${error.message})`,
        )
      }
    }
  } finally {
    await rm(staging, { recursive: true, force: true }).catch(() => {})
  }
}

const main = async () => {
  const sourceExists = await stat(source)
    .then((value) => value.isDirectory())
    .catch(() => false)
  if (!sourceExists) {
    console.warn('[data-sync] data/v1 not found; the app will show the pipeline waiting state.')
    return
  }

  const sourceEntries = await readdir(source, { withFileTypes: true })
  // Validate everything before touching the existing public mirror.
  const jsonFiles = await readAndValidateCanonicalFiles(sourceEntries)
  await replaceMirror(jsonFiles)
  console.log(`[data-sync] atomically copied ${jsonFiles.length} JSON file(s) to public/data/v1`)
}

try {
  await main()
} catch (error) {
  console.error(`[data-sync] blocked: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
