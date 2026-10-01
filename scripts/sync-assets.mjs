import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LEGACY_MODELS = new Set(['floor.glb']) // flat plane + shader displacement; superseded by floor_baked.glb
const REQUIRED_MODEL = 'floor_baked.glb'
const BASECOLOR = 'floor_basecolor.jpg'
const DRACO_FILES = ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']

/**
 * Copy the Blender exports and the Draco decoder into the app's public/ folder.
 * Validates everything first so a failed sync never leaves public/models half wiped.
 */
export function syncAssets({ exportsDir, publicDir, dracoDir }) {
  const meshesDir = join(exportsDir, 'meshes')
  const basecolorSrc = join(exportsDir, 'textures', 'floor', BASECOLOR)

  if (!existsSync(meshesDir)) throw new Error(`meshes folder not found: ${meshesDir}`)
  const models = readdirSync(meshesDir).filter((n) => n.endsWith('.glb') && !LEGACY_MODELS.has(n))
  if (!models.includes(REQUIRED_MODEL)) throw new Error(`${REQUIRED_MODEL} not found in ${meshesDir} (export the baked floor from Blender)`)
  if (!existsSync(basecolorSrc)) throw new Error(`${BASECOLOR} not found: ${basecolorSrc}`)
  for (const f of DRACO_FILES) {
    if (!existsSync(join(dracoDir, f))) throw new Error(`Draco decoder file missing: ${join(dracoDir, f)} (run npm install)`)
  }

  const copied = []
  const modelsOut = join(publicDir, 'models')
  rmSync(modelsOut, { recursive: true, force: true }) // models renamed/removed in Blender must not linger
  mkdirSync(modelsOut, { recursive: true })
  for (const name of models) {
    cpSync(join(meshesDir, name), join(modelsOut, name))
    copied.push(`models/${name}`)
  }

  const texOut = join(publicDir, 'textures', 'floor')
  rmSync(texOut, { recursive: true, force: true })
  mkdirSync(texOut, { recursive: true })
  cpSync(basecolorSrc, join(texOut, BASECOLOR))
  copied.push(`textures/floor/${BASECOLOR}`)

  const dracoOut = join(publicDir, 'draco')
  mkdirSync(dracoOut, { recursive: true })
  for (const f of DRACO_FILES) {
    cpSync(join(dracoDir, f), join(dracoOut, f))
    copied.push(`draco/${f}`)
  }
  return { copied }
}

const thisFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  const appRoot = resolve(dirname(thisFile), '..')
  const exportsDir = process.env.EXPORTS_DIR ?? resolve(appRoot, '..', 'Blender', 'Exports')
  const dracoDir = join(appRoot, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'draco', 'gltf')
  try {
    const { copied } = syncAssets({ exportsDir, publicDir: join(appRoot, 'public'), dracoDir })
    console.log(`Synced ${copied.length} files from ${exportsDir}`)
    for (const f of copied) console.log(`  ${f}`)
  } catch (err) {
    console.error(`sync-assets failed: ${err.message}`)
    process.exit(1)
  }
}
