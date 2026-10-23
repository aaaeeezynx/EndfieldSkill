import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(scriptDir, '..')
const repoRoot = resolve(webRoot, '..', '..')
const equipmentPath = resolve(repoRoot, 'data', 'v1', 'equipment.json')
const itemTablePath = resolve(
  repoRoot,
  'crawler',
  '.cache',
  'akedatabase',
  'tables',
  'ItemTable.json',
)
const outputDir = resolve(webRoot, 'public', 'assets', 'equipment')
const mapPath = resolve(webRoot, 'src', 'data', 'equipmentImageMap.json')
const baseUrl =
  'https://cos.yituliu.cn/endfield/endfielddata/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig'

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const isWebp = (buffer) =>
  buffer.length >= 12 &&
  buffer.toString('ascii', 0, 4) === 'RIFF' &&
  buffer.toString('ascii', 8, 12) === 'WEBP'

const [equipmentDocument, itemTable] = await Promise.all([
  readJson(equipmentPath),
  readJson(itemTablePath),
])

if (!Array.isArray(equipmentDocument.equipment)) {
  throw new Error('data/v1/equipment.json must contain an equipment array.')
}

await mkdir(outputDir, { recursive: true })

const imageMap = {}
const failures = []
let downloaded = 0
let reused = 0

for (const [index, equipment] of equipmentDocument.equipment.entries()) {
  const item = itemTable[equipment.id]
  const iconId = item?.iconId

  if (!equipment.id || !iconId) {
    failures.push({ id: equipment.id, reason: 'missing iconId in ItemTable' })
    continue
  }

  const filename = `${equipment.id}.webp`
  const targetPath = resolve(outputDir, filename)
  const url = `${baseUrl}/${encodeURIComponent(iconId)}.webp`

  try {
    const existing = await readFile(targetPath).catch(() => null)
    if (existing && isWebp(existing)) {
      imageMap[equipment.id] = filename
      reused += 1
    } else {
      const response = await fetch(url, {
        headers: {
          accept: 'image/webp,image/*;q=0.8',
          'user-agent': 'EndfieldSkill asset downloader (non-commercial fan project)',
        },
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      if (!isWebp(buffer)) {
        throw new Error(`invalid WebP payload (${buffer.length} bytes)`)
      }

      await writeFile(targetPath, buffer)
      imageMap[equipment.id] = filename
      downloaded += 1
    }
  } catch (error) {
    failures.push({
      id: equipment.id,
      name: equipment.name,
      iconId,
      reason: error instanceof Error ? error.message : String(error),
    })
  }

  if ((index + 1) % 25 === 0 || index === equipmentDocument.equipment.length - 1) {
    process.stdout.write(
      `\rProcessed ${index + 1}/${equipmentDocument.equipment.length} equipment images`,
    )
  }
}

await writeFile(mapPath, `${JSON.stringify(imageMap, null, 2)}\n`)

process.stdout.write('\n')
console.log(
  `Equipment images: ${Object.keys(imageMap).length} mapped, ${downloaded} downloaded, ${reused} reused.`,
)

if (failures.length) {
  console.error('Failures:')
  for (const failure of failures) {
    console.error(`- ${failure.id}: ${failure.reason}`)
  }
  process.exitCode = 1
}
