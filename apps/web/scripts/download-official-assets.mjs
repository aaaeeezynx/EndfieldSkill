import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(scriptDir, '..')
const outputDir = resolve(webRoot, 'public', 'assets', 'official')

const assets = {
  'kv_v1d6.32f51a5b.jpg':
    'https://web-static.hg-cdn.com/endfield/official-v4/_next/static/media/kv_v1d6.32f51a5b.jpg',
  'block-bg.f05eda37.svg':
    'https://web-static.hg-cdn.com/endfield/official-v4/_next/static/media/block-bg.f05eda37.svg',
  'pag-button-texture.e4e732ad.png':
    'https://web-static.hg-cdn.com/endfield/official-v4/_next/static/media/pag-button-texture.e4e732ad.png',
  'star.c078a0a7.png':
    'https://web-static.hg-cdn.com/endfield/official-v4/_next/static/media/star.c078a0a7.png',
  'ring.5ce6e2bd.png':
    'https://web-static.hg-cdn.com/endfield/official-v4/_next/static/media/ring.5ce6e2bd.png',
  'switcher-active.c8843bb5.png':
    'https://web-static.hg-cdn.com/endfield/official-v4/_next/static/media/switcher-active.c8843bb5.png',
}

await mkdir(outputDir, { recursive: true })

const failures = []

for (const [filename, url] of Object.entries(assets)) {
  const target = resolve(outputDir, filename)
  try {
    const existing = await readFile(target).catch(() => null)
    if (existing?.length) {
      console.log(`Reused ${filename}`)
      continue
    }

    const response = await fetch(url, {
      headers: {
        'user-agent': 'EndfieldSkill asset downloader (non-commercial fan project)',
      },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const buffer = Buffer.from(await response.arrayBuffer())
    if (!buffer.length) throw new Error('empty payload')

    await writeFile(target, buffer)
    console.log(`Downloaded ${filename} (${buffer.length} bytes)`)
  } catch (error) {
    failures.push({ filename, reason: error instanceof Error ? error.message : String(error) })
  }
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`- ${failure.filename}: ${failure.reason}`)
  }
  process.exitCode = 1
}
