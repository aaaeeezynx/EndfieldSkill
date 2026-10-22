import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(webRoot, '../../data/v1')
const target = resolve(webRoot, 'public/data/v1')

await mkdir(target, { recursive: true })

// Keep the mirrored directory in lockstep with the canonical dataset.
const existing = await readdir(target, { withFileTypes: true }).catch(() => [])
await Promise.all(
  existing
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => rm(resolve(target, entry.name), { force: true })),
)

const sourceExists = await stat(source).then((value) => value.isDirectory()).catch(() => false)
if (!sourceExists) {
  console.warn('[data-sync] data/v1 not found; the app will show the pipeline waiting state.')
  process.exit(0)
}

const entries = await readdir(source, { withFileTypes: true })
const jsonFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'))

await Promise.all(
  jsonFiles.map((entry) => cp(resolve(source, entry.name), resolve(target, entry.name))),
)

console.log(`[data-sync] copied ${jsonFiles.length} JSON file(s) to public/data/v1`)
