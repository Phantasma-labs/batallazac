import { closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LEGACY_MODELS = new Set(['floor.glb']) // flat plane + shader displacement; superseded by floor_baked.glb
const DRACO_FILES = ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']
const MANIFEST_HINT = 'src/scene/assets.json'

/** True when the file starts with the GLB magic ("glTF") and is long enough for a header + chunk header. */
function looksLikeGlb(path) {
  if (statSync(path).size < 20) return false
  const fd = openSync(path, 'r')
  try {
    const head = Buffer.alloc(4)
    readSync(fd, head, 0, 4, 0)
    return head.toString('latin1') === 'glTF'
  } finally {
    closeSync(fd)
  }
}

/** Build `finalDir` next to itself, then swap it in, so a failure never leaves the old copy half wiped. */
function replaceDir(finalDir, populate) {
  const staging = `${finalDir}.tmp`
  mkdirSync(dirname(finalDir), { recursive: true })
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  try {
    populate(staging)
  } catch (err) {
    rmSync(staging, { recursive: true, force: true })
    throw err
  }
  rmSync(finalDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  renameSync(staging, finalDir)
}

/**
 * Copy the Blender exports the app's manifest (src/scene/assets.json) uses, plus the Draco decoder,
 * into the app's public/ folder. Everything is validated before anything is replaced, and each folder
 * is swapped in as a whole, so a failed sync leaves the previous working copy untouched.
 * `copy` is injectable so tests can simulate a failure partway through.
 */
export function syncAssets({ exportsDir, publicDir, dracoDir, manifest, copy = cpSync }) {
  const meshesDir = join(exportsDir, 'meshes')
  // The floor GLB may embed its textures; a separate floor texture is only used when the manifest names one.
  const basecolor = manifest.floor.basecolor
  const basecolorName = basecolor ? basename(basecolor) : null
  const basecolorSrc = basecolor ? join(exportsDir, 'textures', 'floor', basecolorName) : null
  const wanted = [...new Set([manifest.floor.model, ...manifest.pieces.map((p) => p.url)].map((u) => basename(u)))]

  if (!existsSync(meshesDir)) throw new Error(`meshes folder not found: ${meshesDir}`)
  const exported = readdirSync(meshesDir).filter((n) => n.toLowerCase().endsWith('.glb'))

  const missing = wanted.filter((n) => !exported.includes(n))
  if (missing.length) {
    throw new Error(
      `${MANIFEST_HINT} uses ${missing.join(', ')} but ${meshesDir} does not contain it. ` +
        `Re-export it from Blender, or if it was renamed, update the name in ${MANIFEST_HINT}.`,
    )
  }
  for (const name of wanted) {
    if (!looksLikeGlb(join(meshesDir, name))) {
      throw new Error(`${name} is not a valid GLB (empty or wrong header; is Blender still writing it?)`)
    }
  }
  if (basecolor && !existsSync(basecolorSrc)) throw new Error(`${basecolorName} not found: ${basecolorSrc}`)
  for (const f of DRACO_FILES) {
    if (!existsSync(join(dracoDir, f))) throw new Error(`Draco decoder file missing: ${join(dracoDir, f)} (run npm install)`)
  }

  const warnings = exported
    .filter((n) => !wanted.includes(n) && !LEGACY_MODELS.has(n))
    .map((n) => `${n} is exported but not used by the app. To show it, add it to ${MANIFEST_HINT}.`)

  const copied = []
  replaceDir(join(publicDir, 'models'), (dir) => {
    for (const name of wanted) {
      copy(join(meshesDir, name), join(dir, name))
      copied.push(`models/${name}`)
    }
  })
  if (basecolor) {
    replaceDir(join(publicDir, dirname(basecolor)), (dir) => {
      copy(basecolorSrc, join(dir, basecolorName))
      copied.push(basecolor)
    })
  } else {
    rmSync(join(publicDir, 'textures'), { recursive: true, force: true }) // only ever created by earlier syncs
  }
  replaceDir(join(publicDir, 'draco'), (dir) => {
    for (const f of DRACO_FILES) {
      copy(join(dracoDir, f), join(dir, f))
      copied.push(`draco/${f}`)
    }
  })
  return { copied, warnings }
}

const thisFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  const appRoot = resolve(dirname(thisFile), '..')
  const exportsDir = process.env.EXPORTS_DIR ?? resolve(appRoot, '..', 'Blender', 'Exports')
  const dracoDir = join(appRoot, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'draco', 'gltf')
  const manifest = JSON.parse(readFileSync(join(appRoot, MANIFEST_HINT), 'utf8'))
  try {
    const { copied, warnings } = syncAssets({ exportsDir, publicDir: join(appRoot, 'public'), dracoDir, manifest })
    console.log(`Synced ${copied.length} files from ${exportsDir}`)
    for (const f of copied) console.log(`  ${f}`)
    for (const w of warnings) console.warn(`warning: ${w}`)
  } catch (err) {
    console.error(`sync-assets failed: ${err.message}`)
    process.exit(1)
  }
}
