# Scene Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Vite + React + three.js web app in `app/` that renders the Blender-exported Zacatecas diorama (baked terrain + six piece files) with a bounded orbit/pan/zoom/WASD camera.

**Architecture:** A manifest (`sceneAssets.ts`) lists the GLBs; one generic `Piece` renders each as-is (positions are baked into the glTF nodes), `Terrain` adds the base-colour texture to the baked floor and reports its bounding box, and `MapCamera` frames and clamps itself from that box. A `sync-assets` script copies the Blender exports (and the Draco decoder) into `public/`, so re-exporting meshes from Blender means re-running one command, with no code changes. Camera maths is pure functions with unit tests.

**Tech Stack:** Vite, React 19, TypeScript, three, @react-three/fiber 9, @react-three/drei 10, vitest.

**Spec:** [../specs/2026-10-01-scene-foundation-design.md](../specs/2026-10-01-scene-foundation-design.md) (parent: [../specs/2026-09-30-interactive-map-design.md](../specs/2026-09-30-interactive-map-design.md))

## Global Constraints

- Working directory for every command: `L:\Projects\AIDocs_TomaZacatecas\app` (its own git repo). Shell is bash (Git Bash on Windows); use forward slashes.
- Units: 1 unit = 10 real meters; glTF Y-up. Every node already carries its world transform. Nothing is re-centred or re-scaled in the app.
- All GLBs use `KHR_draco_mesh_compression`; the Draco decoder is hosted locally (`public/draco/`), never drei's default CDN. The app must work offline.
- Static build, no server: `vite.config.ts` uses `base: './'` and every asset URL is relative (no leading slash).
- Floor: `floor_baked.glb` + `floor_basecolor.jpg` only. Texture `flipY = false`, `SRGBColorSpace`, anisotropy + mipmaps. No normal map, no displacement map, no `frustumCulled = false`.
- Camera: perspective, ~29 degrees from top-down, 50 mm-equivalent field of view (23 degrees vertical for 16:9). Framed from the floor's computed bounds, never a hardcoded origin.
- No shadows. No pins, `locations.json`, video overlay, timeline, idle orbit, or `getHeightAt` in this milestone.
- The meshes in `Blender/Exports/` are **stand-ins**: the user is re-doing the floor (retopo) and remodelling pieces and will re-export. Never hardcode a vertex count, node name or position from the current files; always derive from the loaded GLB.
- Commit trailer on every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Spec-implied failure modes no happy-path test covers, most likely first. Each has a pinning test or check in the named task.

1. **The user replaces the floor** (different footprint, offset from the origin): framing and clamping must come from the loaded bounds. Task 3 tests use a non-origin, non-square bounds box.
2. **A file is missing or not synced** (re-export renamed it, or `sync-assets` was not run): the user must see a readable message naming the fix, not a blank canvas. Task 4 manual check.
3. **A failed or stale sync:** a sync that fails validation must leave the existing working `public/models` untouched, and a model removed or renamed in Blender must not linger from an earlier sync. Task 2 tests.
4. **Portrait or resized window:** the board must fit the width (not be cropped) when the window is narrow, and resizing must not reset the user's camera. Task 3 test (`fitDistance`), Task 4 (`framing` computed once).
5. **Keyboard edge cases:** Ctrl/Cmd/Alt chords (Ctrl+W, Cmd+A) must not pan or be swallowed, opposite keys cancel, diagonals are not faster, and a held key must release when the window loses focus (otherwise the camera drifts forever). Task 3 tests for the maths, Task 5 manual check for blur/chords.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `.claude/launch.json`, `src/main.tsx`, `src/App.tsx`

**Interfaces:**
- Produces: `npm run dev | build | preview | test | typecheck | sync-assets` (the last wired in Task 2), `base: './'` build, vitest config picking up `src/**/*.test.ts` and `scripts/**/*.test.mjs`.

- [ ] **Step 1: Create the config files**

`package.json`:

```json
{
  "name": "toma-zacatecas-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

`vite.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
})
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>La Toma de Zacatecas</title>
    <style>
      html, body, #root { margin: 0; height: 100%; overflow: hidden; background: #d9cdb4; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`.gitignore`:

```
node_modules
dist
*.log
# synced from Blender/Exports by `npm run sync-assets`
public/models
public/textures
public/draco
```

`.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "app-dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev", "--", "--port", "5173", "--strictPort"],
      "port": 5173
    }
  ]
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.tsx`:

```tsx
export default function App() {
  return <h1>La Toma de Zacatecas</h1>
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install react react-dom three @react-three/fiber @react-three/drei
npm install -D vite @vitejs/plugin-react typescript vitest @types/react @types/react-dom @types/three @types/node
```

Expected: both succeed. Note the installed `three` and `@react-three/fiber` versions (`npm ls three @react-three/fiber @react-three/drei`); fiber must be 9.x and drei 10.x.

- [ ] **Step 3: Verify the scaffold builds**

Run: `npm run build`
Expected: `tsc` reports no errors and Vite prints `built in` with a `dist/` listing. If `tsc` rejects a tsconfig option under the installed TypeScript major, remove or rename only that option and re-run; do not change the other settings.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json index.html .gitignore .claude/launch.json src
git commit -m "chore: scaffold Vite + React + three app

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Asset sync script

**Files:**
- Create: `scripts/sync-assets.mjs`, `scripts/sync-assets.test.mjs`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: `syncAssets({ exportsDir, publicDir, dracoDir }): { copied: string[] }` (exported from `scripts/sync-assets.mjs`), and `npm run sync-assets` (CLI wrapper). After a sync, `public/models/*.glb`, `public/textures/floor/floor_basecolor.jpg`, `public/draco/{draco_decoder.js,draco_decoder.wasm,draco_wasm_wrapper.js}` exist.

- [ ] **Step 1: Write the failing tests**

`scripts/sync-assets.test.mjs`:

```js
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { syncAssets } from './sync-assets.mjs'

const DRACO = ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']

function put(path, content = 'x') {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

let dirs
beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'sync-assets-'))
  dirs = { exportsDir: join(root, 'Exports'), publicDir: join(root, 'public'), dracoDir: join(root, 'draco-src') }
  put(join(dirs.exportsDir, 'meshes', 'floor.glb'), 'legacy floor')
  put(join(dirs.exportsDir, 'meshes', 'floor_baked.glb'), 'baked v1')
  put(join(dirs.exportsDir, 'meshes', 'cathedral.glb'))
  put(join(dirs.exportsDir, 'meshes', 'floor_baked.json'))
  put(join(dirs.exportsDir, 'textures', 'floor', 'floor_basecolor.jpg'), 'jpg')
  put(join(dirs.exportsDir, 'textures', 'floor', 'floor_normal.png'))
  put(join(dirs.exportsDir, 'textures', 'floor', 'floor_height.png'))
  for (const f of DRACO) put(join(dirs.dracoDir, f))
})

describe('syncAssets', () => {
  it('copies the baked floor and pieces but not the legacy floor or non-glb files', () => {
    syncAssets(dirs)
    expect(readdirSync(join(dirs.publicDir, 'models')).sort()).toEqual(['cathedral.glb', 'floor_baked.glb'])
  })

  it('copies only the floor base colour texture', () => {
    syncAssets(dirs)
    expect(readdirSync(join(dirs.publicDir, 'textures', 'floor'))).toEqual(['floor_basecolor.jpg'])
  })

  it('copies the Draco decoder files so the app never needs a CDN', () => {
    syncAssets(dirs)
    expect(readdirSync(join(dirs.publicDir, 'draco')).sort()).toEqual(DRACO)
  })

  it('overwrites with the newest export and drops models that no longer exist', () => {
    put(join(dirs.publicDir, 'models', 'old_piece.glb'), 'from an earlier export')
    put(join(dirs.exportsDir, 'meshes', 'floor_baked.glb'), 'baked v2')
    syncAssets(dirs)
    expect(readFileSync(join(dirs.publicDir, 'models', 'floor_baked.glb'), 'utf8')).toBe('baked v2')
    expect(existsSync(join(dirs.publicDir, 'models', 'old_piece.glb'))).toBe(false)
  })

  it('returns the list of copied files', () => {
    const { copied } = syncAssets(dirs)
    expect(copied).toContain('models/floor_baked.glb')
    expect(copied).toContain('textures/floor/floor_basecolor.jpg')
    expect(copied).toContain('draco/draco_wasm_wrapper.js')
  })

  it('fails with a clear message when the meshes folder is missing', () => {
    expect(() => syncAssets({ ...dirs, exportsDir: join(dirs.exportsDir, 'nope') })).toThrow(/meshes folder not found/)
  })

  it('fails when floor_baked.glb is missing and leaves the previous models untouched', () => {
    syncAssets(dirs)
    put(join(dirs.publicDir, 'models', 'keep_me.glb'), 'working copy')
    rmSync(join(dirs.exportsDir, 'meshes', 'floor_baked.glb'))
    expect(() => syncAssets(dirs)).toThrow(/floor_baked.glb/)
    expect(readFileSync(join(dirs.publicDir, 'models', 'keep_me.glb'), 'utf8')).toBe('working copy')
  })

  it('fails with an npm install hint when a Draco decoder file is missing', () => {
    rmSync(join(dirs.dracoDir, 'draco_decoder.wasm'))
    expect(() => syncAssets(dirs)).toThrow(/npm install/)
  })

  it('fails when the base colour texture is missing', () => {
    rmSync(join(dirs.exportsDir, 'textures', 'floor', 'floor_basecolor.jpg'))
    expect(() => syncAssets(dirs)).toThrow(/floor_basecolor.jpg/)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/sync-assets.test.mjs`
Expected: FAIL (cannot find module `./sync-assets.mjs`).

- [ ] **Step 3: Implement the script**

`scripts/sync-assets.mjs`:

```js
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
```

In `package.json` add to `"scripts"`: `"sync-assets": "node scripts/sync-assets.mjs"` and `"pretest": "npm run sync-assets"` (so `npm test` always checks against a fresh sync).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/sync-assets.test.mjs`
Expected: PASS, 9 tests.

- [ ] **Step 5: Run the real sync**

Run: `npm run sync-assets`
Expected: `Synced 11 files from ...` (the 6 piece GLBs, `floor_baked.glb`, the base colour texture, and the 3 Draco files; the number is simply every `.glb` in `Blender/Exports/meshes` except the legacy `floor.glb`, plus 4). Then check:

Run: `ls public/models public/textures/floor public/draco`
Expected: no `floor.glb`; `floor_baked.glb`, `cathedral.glb`, `labufa_fort.glb`, `elgrillo_emplacement.glb`, `vetagrande_cannons.glb`, `soldiers_federal.glb`, `soldiers_villista.glb`; `floor_basecolor.jpg`; the three Draco files. If the Draco directory in `node_modules/three/examples/jsm/libs/draco/gltf/` has different file names in the installed three version, update `DRACO_FILES` to match what is there (the decoder JS, WASM and wrapper), keeping the test fixture in step.

- [ ] **Step 6: Commit**

```bash
git add scripts package.json
git commit -m "feat: sync-assets script copies Blender exports and Draco decoder

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Camera maths (pure, tested)

**Files:**
- Create: `src/camera/math.ts`, `src/camera/math.test.ts`

**Interfaces:**
- Produces (all exported from `src/camera/math.ts`):
  - `type Vec3 = { x: number; y: number; z: number }`
  - `type Bounds = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }`
  - constants `VFOV_DEG = 23`, `TILT_DEG = 29`, `MIN_POLAR_DEG = 10`, `MAX_POLAR_DEG = 70`, `MIN_DISTANCE = 60`, `MAX_DISTANCE = 4000`, `PAN_SPEED = 0.6`
  - `boundsFromBox(box: Box3): Bounds`
  - `clampTarget(target: Vec3, bounds: Bounds): Vec3`
  - `fitDistance(bounds: Bounds, vfovDeg: number, aspect: number): number` (distance at which the board's width fills the view, clamped to `[MIN_DISTANCE, MAX_DISTANCE]`)
  - `defaultFraming(bounds: Bounds, distance: number): { target: Vec3; position: Vec3 }` (target = box centre; camera south of it (+z) and above, `TILT_DEG` from vertical)
  - `panVector(keys: ReadonlySet<string>, forward: { x: number; z: number }, distance: number, dt: number): { x: number; z: number }` (`keys` are lowercased `KeyboardEvent.key` values; `forward` is the camera's ground-plane heading, need not be normalised)

- [ ] **Step 1: Write the failing tests**

`src/camera/math.test.ts`:

```ts
import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  MAX_DISTANCE,
  MIN_DISTANCE,
  PAN_SPEED,
  TILT_DEG,
  VFOV_DEG,
  boundsFromBox,
  clampTarget,
  defaultFraming,
  fitDistance,
  panVector,
  type Bounds,
} from './math'

// Deliberately not centred on the origin and not square (like the real floor),
// so a hardcoded origin or square assumption fails.
const FLOOR: Bounds = { minX: -335.56, maxX: 382.77, minY: 5.19, maxY: 44.55, minZ: -939.54, maxZ: 284.98 }
const NORTH = { x: 0, z: -1 } // camera looking toward -z (Blender +y)

describe('boundsFromBox', () => {
  it('maps a Box3 to Bounds', () => {
    const b = boundsFromBox(new Box3(new Vector3(1, 2, 3), new Vector3(4, 5, 6)))
    expect(b).toEqual({ minX: 1, maxX: 4, minY: 2, maxY: 5, minZ: 3, maxZ: 6 })
  })
})

describe('clampTarget', () => {
  it('leaves a point inside the bounds unchanged', () => {
    expect(clampTarget({ x: 10, y: 20, z: -300 }, FLOOR)).toEqual({ x: 10, y: 20, z: -300 })
  })
  it('clamps each axis independently to the bounds', () => {
    expect(clampTarget({ x: 9999, y: -50, z: -9999 }, FLOOR)).toEqual({ x: FLOOR.maxX, y: FLOOR.minY, z: FLOOR.minZ })
  })
})

describe('fitDistance', () => {
  it('fits the board width for a 16:9 view (about 990 units for a 718-wide board)', () => {
    const d = fitDistance(FLOOR, VFOV_DEG, 16 / 9)
    expect(d).toBeGreaterThan(980)
    expect(d).toBeLessThan(1005)
  })
  it('pulls back further for a portrait window so the board is not cropped', () => {
    expect(fitDistance(FLOOR, VFOV_DEG, 0.5)).toBeGreaterThan(fitDistance(FLOOR, VFOV_DEG, 16 / 9) * 2)
  })
  it('never leaves the allowed zoom range', () => {
    const huge: Bounds = { ...FLOOR, minX: -1e6, maxX: 1e6 }
    const flat: Bounds = { ...FLOOR, minX: 5, maxX: 5 }
    expect(fitDistance(huge, VFOV_DEG, 16 / 9)).toBe(MAX_DISTANCE)
    expect(fitDistance(flat, VFOV_DEG, 16 / 9)).toBe(MIN_DISTANCE)
  })
})

describe('defaultFraming', () => {
  const { target, position } = defaultFraming(FLOOR, 1000)
  it('targets the centre of the bounds', () => {
    expect(target.x).toBeCloseTo((FLOOR.minX + FLOOR.maxX) / 2)
    expect(target.y).toBeCloseTo((FLOOR.minY + FLOOR.maxY) / 2)
    expect(target.z).toBeCloseTo((FLOOR.minZ + FLOOR.maxZ) / 2)
  })
  it('places the camera at the requested distance, above and south of the target', () => {
    const dx = position.x - target.x, dy = position.y - target.y, dz = position.z - target.z
    expect(Math.hypot(dx, dy, dz)).toBeCloseTo(1000)
    expect(dy).toBeGreaterThan(0)
    expect(dz).toBeGreaterThan(0)
    expect(dx).toBeCloseTo(0)
  })
  it('tilts TILT_DEG away from straight down', () => {
    const deg = (Math.atan2(position.z - target.z, position.y - target.y) * 180) / Math.PI
    expect(deg).toBeCloseTo(TILT_DEG)
  })
})

describe('panVector', () => {
  const k = (...keys: string[]) => new Set(keys)
  const dist = 1000, dt = 0.5
  const step = PAN_SPEED * dist * dt

  it('does nothing with no keys held', () => {
    expect(panVector(k(), NORTH, dist, dt)).toEqual({ x: 0, z: 0 })
  })
  it('moves along the camera heading for w / arrowup', () => {
    const v = panVector(k('w'), NORTH, dist, dt)
    expect(v.x).toBeCloseTo(0)
    expect(v.z).toBeCloseTo(-step)
    expect(panVector(k('arrowup'), NORTH, dist, dt).z).toBeCloseTo(-step)
  })
  it('moves back for s / arrowdown and right (east, +x) for d / arrowright when facing north', () => {
    expect(panVector(k('s'), NORTH, dist, dt).z).toBeCloseTo(step)
    expect(panVector(k('d'), NORTH, dist, dt).x).toBeCloseTo(step)
    expect(panVector(k('arrowright'), NORTH, dist, dt).x).toBeCloseTo(step)
    expect(panVector(k('a'), NORTH, dist, dt).x).toBeCloseTo(-step)
  })
  it('follows the camera heading when it is rotated (facing east, forward is +x, right is +z)', () => {
    const v = panVector(k('w'), { x: 1, z: 0 }, dist, dt)
    expect(v.x).toBeCloseTo(step)
    expect(v.z).toBeCloseTo(0)
    expect(panVector(k('d'), { x: 1, z: 0 }, dist, dt).z).toBeCloseTo(step)
  })
  it('cancels opposite keys', () => {
    expect(panVector(k('w', 's'), NORTH, dist, dt)).toEqual({ x: 0, z: 0 })
    expect(panVector(k('a', 'd'), NORTH, dist, dt)).toEqual({ x: 0, z: 0 })
  })
  it('does not move faster on a diagonal', () => {
    const v = panVector(k('w', 'd'), NORTH, dist, dt)
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(step)
  })
  it('scales with zoom distance and frame time', () => {
    expect(panVector(k('w'), NORTH, 2 * dist, dt).z).toBeCloseTo(-2 * step)
    expect(panVector(k('w'), NORTH, dist, dt / 2).z).toBeCloseTo(-step / 2)
  })
  it('ignores a heading that is not normalised and a zero heading', () => {
    expect(panVector(k('w'), { x: 0, z: -7 }, dist, dt).z).toBeCloseTo(-step)
    expect(panVector(k('w'), { x: 0, z: 0 }, dist, dt)).toEqual({ x: 0, z: 0 })
  })
  it('ignores keys it does not use', () => {
    expect(panVector(k('q', 'enter', 'shift'), NORTH, dist, dt)).toEqual({ x: 0, z: 0 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/camera/math.test.ts`
Expected: FAIL (cannot find module `./math`).

- [ ] **Step 3: Implement**

`src/camera/math.ts`:

```ts
import type { Box3 } from 'three'

export type Vec3 = { x: number; y: number; z: number }
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }

/** 50 mm lens on a 36 mm sensor, 16:9 frame: 2 * atan(10.125 / 50) = 22.9 degrees vertical. */
export const VFOV_DEG = 23
/** Default view is this many degrees away from looking straight down (the Blender diorama camera). */
export const TILT_DEG = 29
export const MIN_POLAR_DEG = 10
export const MAX_POLAR_DEG = 70
export const MIN_DISTANCE = 60
export const MAX_DISTANCE = 4000
/** Keyboard pan speed as a fraction of the camera's distance per second. */
export const PAN_SPEED = 0.6

const rad = (deg: number) => (deg * Math.PI) / 180
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export function boundsFromBox(box: Box3): Bounds {
  return { minX: box.min.x, maxX: box.max.x, minY: box.min.y, maxY: box.max.y, minZ: box.min.z, maxZ: box.max.z }
}

export function clampTarget(t: Vec3, b: Bounds): Vec3 {
  return { x: clamp(t.x, b.minX, b.maxX), y: clamp(t.y, b.minY, b.maxY), z: clamp(t.z, b.minZ, b.maxZ) }
}

/** Distance at which the board's width fills the horizontal field of view. */
export function fitDistance(b: Bounds, vfovDeg: number, aspect: number): number {
  const halfH = Math.atan(Math.tan(rad(vfovDeg) / 2) * aspect)
  const d = (b.maxX - b.minX) / 2 / Math.tan(halfH)
  return clamp(d, MIN_DISTANCE, MAX_DISTANCE)
}

/** Camera south of the board centre (+z), TILT_DEG away from straight down, looking at the centre. */
export function defaultFraming(b: Bounds, distance: number): { target: Vec3; position: Vec3 } {
  const target = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: (b.minZ + b.maxZ) / 2 }
  const tilt = rad(TILT_DEG)
  return {
    target,
    position: { x: target.x, y: target.y + distance * Math.cos(tilt), z: target.z + distance * Math.sin(tilt) },
  }
}

/**
 * Ground-plane movement for the held keys. `keys` holds lowercased KeyboardEvent.key values;
 * `forward` is the camera heading projected on the ground (x, z). Right is forward rotated so
 * that facing -z gives +x (east).
 */
export function panVector(
  keys: ReadonlySet<string>,
  forward: { x: number; z: number },
  distance: number,
  dt: number,
): { x: number; z: number } {
  const ahead = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0)
  const side = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0)
  const len = Math.hypot(forward.x, forward.z)
  if ((!ahead && !side) || len < 1e-9) return { x: 0, z: 0 }
  const fx = forward.x / len, fz = forward.z / len
  const rx = -fz, rz = fx
  const norm = Math.hypot(ahead, side) // diagonals are not faster
  const mag = (PAN_SPEED * distance * dt) / norm
  return { x: (fx * ahead + rx * side) * mag, z: (fz * ahead + rz * side) * mag }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/camera/math.test.ts`
Expected: PASS, all tests. If `fitDistance`'s 16:9 range check fails by a few units, print the value and adjust only the test bounds to bracket the computed value (the formula is exact; the 980–1005 bracket was an estimate).

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/camera
git commit -m "feat: pure camera maths (bounds clamp, framing, fit, keyboard pan)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Scene, terrain, pieces, and basic camera

**Files:**
- Create: `src/scene/sceneAssets.ts`, `src/scene/sceneAssets.test.ts`, `src/scene/Terrain.tsx`, `src/scene/Piece.tsx`, `src/scene/Lighting.tsx`, `src/scene/MapScene.tsx`, `src/camera/MapCamera.tsx`, `src/ui/Loader.tsx`, `src/ui/ErrorBoundary.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Bounds`, `boundsFromBox`, `defaultFraming`, `fitDistance`, `VFOV_DEG`, `MIN_DISTANCE`, `MAX_DISTANCE`, `MIN_POLAR_DEG`, `MAX_POLAR_DEG` from `src/camera/math.ts`; `public/` populated by Task 2.
- Produces: `DRACO_PATH`, `FLOOR`, `PIECES`, `ALL_PUBLIC_FILES` (from `sceneAssets.ts`); `<Terrain onBounds={(b: Bounds) => void} />`; `<Piece url={string} />`; `<Lighting />`; `<MapCamera bounds={Bounds} />`; `<MapScene />`; `<Loader />`; `<ErrorBoundary>`.

- [ ] **Step 1: Write the failing manifest test**

`src/scene/sceneAssets.test.ts`:

```ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALL_PUBLIC_FILES, PIECES } from './sceneAssets'

const publicDir = fileURLToPath(new URL('../../public', import.meta.url))

describe('scene asset manifest', () => {
  it('only references files that exist in public/ (run `npm run sync-assets` if this fails)', () => {
    const missing = ALL_PUBLIC_FILES.filter((f) => !existsSync(join(publicDir, f)))
    expect(missing).toEqual([])
  })

  it('has unique piece ids and urls', () => {
    expect(new Set(PIECES.map((p) => p.id)).size).toBe(PIECES.length)
    expect(new Set(PIECES.map((p) => p.url)).size).toBe(PIECES.length)
  })

  it('uses relative urls so the static build works from any folder', () => {
    for (const f of ALL_PUBLIC_FILES) expect(f.startsWith('/')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/scene/sceneAssets.test.ts`
Expected: FAIL (cannot find module `./sceneAssets`).

- [ ] **Step 3: Implement the manifest**

`src/scene/sceneAssets.ts`:

```ts
/** Everything the scene loads. Paths are relative to public/ (filled by `npm run sync-assets`). */
export const DRACO_PATH = 'draco/'

export const FLOOR = {
  model: 'models/floor_baked.glb',
  basecolor: 'textures/floor/floor_basecolor.jpg',
} as const

/** Positions are baked into each GLB's nodes; adding a piece to the scene is one line here. */
export const PIECES = [
  { id: 'cathedral', url: 'models/cathedral.glb' },
  { id: 'labufa-fort', url: 'models/labufa_fort.glb' },
  { id: 'elgrillo-emplacement', url: 'models/elgrillo_emplacement.glb' },
  { id: 'vetagrande-cannons', url: 'models/vetagrande_cannons.glb' },
  { id: 'soldiers-federal', url: 'models/soldiers_federal.glb' },
  { id: 'soldiers-villista', url: 'models/soldiers_villista.glb' },
] as const

export const ALL_PUBLIC_FILES: string[] = [
  FLOOR.model,
  FLOOR.basecolor,
  ...PIECES.map((p) => p.url),
  `${DRACO_PATH}draco_decoder.js`,
  `${DRACO_PATH}draco_decoder.wasm`,
  `${DRACO_PATH}draco_wasm_wrapper.js`,
]
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/scene/sceneAssets.test.ts`
Expected: PASS (3 tests). If the first fails, run `npm run sync-assets` and retry.

- [ ] **Step 5: Write the scene components**

`src/scene/Piece.tsx`:

```tsx
import { useGLTF } from '@react-three/drei'
import { DRACO_PATH } from './sceneAssets'

/** Renders a piece GLB exactly as exported: node transforms already hold the world positions. */
export function Piece({ url }: { url: string }) {
  const { scene } = useGLTF(url, DRACO_PATH)
  return <primitive object={scene} />
}
```

`src/scene/Terrain.tsx`:

```tsx
import { useGLTF, useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { Box3, SRGBColorSpace, type Mesh, type MeshStandardMaterial } from 'three'
import { boundsFromBox, type Bounds } from '../camera/math'
import { DRACO_PATH, FLOOR } from './sceneAssets'

/**
 * The baked floor mesh with its base colour texture. Shape-agnostic on purpose: it reads the
 * loaded geometry's bounds rather than assuming a size, so a re-exported floor just works.
 */
export function Terrain({ onBounds }: { onBounds: (bounds: Bounds) => void }) {
  const { scene } = useGLTF(FLOOR.model, DRACO_PATH)
  const basecolor = useTexture(FLOOR.basecolor)
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy())

  useLayoutEffect(() => {
    basecolor.colorSpace = SRGBColorSpace
    basecolor.flipY = false // glTF UVs are already top-left
    basecolor.anisotropy = maxAnisotropy
    basecolor.needsUpdate = true
    scene.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        ;(m as MeshStandardMaterial).map = basecolor
        m.needsUpdate = true
      }
    })
    scene.updateWorldMatrix(true, true)
    onBounds(boundsFromBox(new Box3().setFromObject(scene)))
  }, [scene, basecolor, maxAnisotropy, onBounds])

  return <primitive object={scene} />
}
```

`src/scene/Lighting.tsx`:

```tsx
/** Soft sky/ground fill plus a warm low sun from the north-west so relief reads from the default south view. */
export function Lighting() {
  return (
    <>
      <hemisphereLight args={['#dfe6ff', '#8a7a5a', 1.0]} />
      <directionalLight position={[-500, 500, -400]} intensity={1.6} color="#fff1d6" />
    </>
  )
}
```

`src/camera/MapCamera.tsx` (basic version; Task 5 adds keyboard pan and clamping):

```tsx
import { MapControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react'
import {
  MAX_DISTANCE,
  MAX_POLAR_DEG,
  MIN_DISTANCE,
  MIN_POLAR_DEG,
  VFOV_DEG,
  defaultFraming,
  fitDistance,
  type Bounds,
} from './math'

const rad = (deg: number) => (deg * Math.PI) / 180

export function MapCamera({ bounds }: { bounds: Bounds }) {
  const camera = useThree((s) => s.camera)
  const get = useThree((s) => s.get)
  const controls = useRef<ComponentRef<typeof MapControls>>(null)

  // Framed once per terrain. Reading the size via get() (not a subscription) means a window
  // resize does not reset the user's view.
  const framing = useMemo(() => {
    const { width, height } = get().size
    return defaultFraming(bounds, fitDistance(bounds, VFOV_DEG, width / height))
  }, [bounds, get])

  useLayoutEffect(() => {
    const { target, position } = framing
    camera.position.set(position.x, position.y, position.z)
    camera.lookAt(target.x, target.y, target.z)
    controls.current?.target.set(target.x, target.y, target.z)
    controls.current?.update()
  }, [camera, framing])

  return (
    <MapControls
      ref={controls}
      makeDefault
      screenSpacePanning={false}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      minPolarAngle={rad(MIN_POLAR_DEG)}
      maxPolarAngle={rad(MAX_POLAR_DEG)}
    />
  )
}
```

`src/ui/Loader.tsx`:

```tsx
import { useProgress } from '@react-three/drei'

export function Loader() {
  const { progress } = useProgress()
  if (progress >= 100) return null
  return (
    <div
      role="status"
      style={{
        position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
        background: '#d9cdb4', color: '#3b3224', font: '16px/1.4 system-ui, sans-serif',
      }}
    >
      Loading the battlefield… {Math.round(progress)}%
    </div>
  )
}
```

`src/ui/ErrorBoundary.tsx`:

```tsx
import { Component, type ReactNode } from 'react'

/** A missing or unreadable asset should say so, not leave a blank canvas. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div role="alert" style={{ padding: 24, font: '16px/1.5 system-ui, sans-serif', color: '#3b3224' }}>
        <h1 style={{ fontSize: 20 }}>Could not load the scene</h1>
        <p>{error.message}</p>
        <p>
          If a model or texture is missing, re-export it from Blender and run <code>npm run sync-assets</code>.
        </p>
      </div>
    )
  }
}
```

`src/scene/MapScene.tsx`:

```tsx
import { useGLTF, useTexture } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useState } from 'react'
import { MapCamera } from '../camera/MapCamera'
import { VFOV_DEG, type Bounds } from '../camera/math'
import { Lighting } from './Lighting'
import { Piece } from './Piece'
import { Terrain } from './Terrain'
import { DRACO_PATH, FLOOR, PIECES } from './sceneAssets'

const BACKGROUND = '#d9cdb4' // matches the cream border of the floor texture

// Start every download in parallel instead of one after another.
useGLTF.preload(FLOOR.model, DRACO_PATH)
useTexture.preload(FLOOR.basecolor)
for (const p of PIECES) useGLTF.preload(p.url, DRACO_PATH)

export function MapScene() {
  const [bounds, setBounds] = useState<Bounds | null>(null)
  return (
    <Canvas flat dpr={[1, 2]} camera={{ fov: VFOV_DEG, near: 1, far: 12000 }}>
      <color attach="background" args={[BACKGROUND]} />
      <Lighting />
      <Suspense fallback={null}>
        <Terrain onBounds={setBounds} />
        {PIECES.map((p) => (
          <Piece key={p.id} url={p.url} />
        ))}
        {bounds && <MapCamera bounds={bounds} />}
      </Suspense>
    </Canvas>
  )
}
```

`src/App.tsx` (replace):

```tsx
import { MapScene } from './scene/MapScene'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { Loader } from './ui/Loader'

export default function App() {
  return (
    <ErrorBoundary>
      <MapScene />
      <Loader />
    </ErrorBoundary>
  )
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors. Likely fixups if there are any: `ComponentRef<typeof MapControls>` should resolve to the controls implementation type; if drei's typing differs in the installed version, type the ref as `React.ElementRef<typeof MapControls>` instead. Do not weaken types with `any`.

- [ ] **Step 7: Run it and look at it**

Start the dev server with the Browser pane: `preview_start` with name `app-dev` (from `.claude/launch.json`), then `navigate` to `http://localhost:5173`. Wait for the loader to disappear, then take a screenshot.
Expected:
  - the textured terrain fills the view from a south-looking tilted camera, with the cathedral, forts, cannons and soldiers visible where the Blender renders put them;
  - the "Loading…" overlay disappears;
  - `read_console_messages` with `onlyErrors: true` shows no errors (a Three.js/drei deprecation warning is acceptable; report it).
  - shading looks right-way-up (hills lit on the north-west faces, not inverted), and the terrain texture is not darker than in the Blender renders (a dim result means the floor material tint was not white; check `floor_baked.json`).
If highlights look clipped or the image is flat, adjust only the two light intensities in `Lighting.tsx` and re-screenshot.

- [ ] **Step 8: Check the missing-asset error path (Review Focus 2)**

Run: `mv public/models/cathedral.glb public/models/cathedral.glb.bak`, reload the page.
Expected: the page shows "Could not load the scene" with a message mentioning the failed file and the `npm run sync-assets` hint; no blank canvas.
Then restore: `mv public/models/cathedral.glb.bak public/models/cathedral.glb`, reload, confirm the scene is back.

- [ ] **Step 9: Run all tests and commit**

Run: `npm test`
Expected: sync runs, then all tests pass (sync-assets, camera math, manifest).

```bash
git add src
git commit -m "feat: render baked terrain and pieces with framed map camera

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Keyboard pan and bounds clamping

**Files:**
- Create: `src/camera/useKeyboardPan.ts`
- Modify: `src/camera/MapCamera.tsx`

**Interfaces:**
- Consumes: `clampTarget`, `panVector`, `Bounds` from `src/camera/math.ts`; `<MapControls ref>` from Task 4.
- Produces: `useKeyboardPan(): { current: Set<string> }` (a ref to the lowercased `KeyboardEvent.key` values of held pan keys; the set is cleared on blur/visibility change/unmount); `MapCamera` now clamps the orbit target (and shifts the camera by the same amount) to the floor bounds every frame, and applies keyboard panning. In dev builds `window.__map = { camera, controls, bounds }` is exposed for manual checks.

- [ ] **Step 1: Write the hook**

`src/camera/useKeyboardPan.ts`:

```ts
import { useEffect, useRef } from 'react'

const PAN_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

/**
 * Tracks which pan keys (WASD / arrows) are held. The camera reads the set every frame, so
 * holding a key pans smoothly. Browser chords (Ctrl/Cmd/Alt + key) and typing in form fields
 * are ignored, and every held key is released when the window loses focus so the camera
 * cannot drift on its own.
 */
export function useKeyboardPan() {
  const keys = useRef<Set<string>>(new Set())

  useEffect(() => {
    const held = keys.current
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      const key = e.key.toLowerCase()
      if (!PAN_KEYS.has(key)) return
      held.add(key)
      e.preventDefault() // keep the arrow keys from scrolling the page
    }
    const onUp = (e: KeyboardEvent) => held.delete(e.key.toLowerCase())
    const release = () => held.clear()

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', release)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', release)
      held.clear()
    }
  }, [])

  return keys
}
```

- [ ] **Step 2: Wire pan and clamping into `MapCamera`**

Replace `src/camera/MapCamera.tsx` with:

```tsx
import { MapControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react'
import { Vector3 } from 'three'
import {
  MAX_DISTANCE,
  MAX_POLAR_DEG,
  MIN_DISTANCE,
  MIN_POLAR_DEG,
  VFOV_DEG,
  clampTarget,
  defaultFraming,
  fitDistance,
  panVector,
  type Bounds,
} from './math'
import { useKeyboardPan } from './useKeyboardPan'

const rad = (deg: number) => (deg * Math.PI) / 180
const MAX_FRAME_DT = 0.1 // a tab coming back from the background must not teleport the camera
const heading = new Vector3()

export function MapCamera({ bounds }: { bounds: Bounds }) {
  const camera = useThree((s) => s.camera)
  const get = useThree((s) => s.get)
  const controls = useRef<ComponentRef<typeof MapControls>>(null)
  const keys = useKeyboardPan()

  // Framed once per terrain. Reading the size via get() (not a subscription) means a window
  // resize does not reset the user's view.
  const framing = useMemo(() => {
    const { width, height } = get().size
    return defaultFraming(bounds, fitDistance(bounds, VFOV_DEG, width / height))
  }, [bounds, get])

  useLayoutEffect(() => {
    const { target, position } = framing
    camera.position.set(position.x, position.y, position.z)
    camera.lookAt(target.x, target.y, target.z)
    controls.current?.target.set(target.x, target.y, target.z)
    controls.current?.update()
    if (import.meta.env.DEV) Object.assign(window, { __map: { camera, controls: controls.current, bounds } })
  }, [camera, framing, bounds])

  // Runs after drei's controls.update() (priority -1), so we adjust the final state each frame.
  useFrame((_, delta) => {
    const c = controls.current
    if (!c) return

    camera.getWorldDirection(heading)
    const distance = camera.position.distanceTo(c.target)
    const step = panVector(keys.current, { x: heading.x, z: heading.z }, distance, Math.min(delta, MAX_FRAME_DT))
    c.target.x += step.x
    c.target.z += step.z
    camera.position.x += step.x
    camera.position.z += step.z

    // Keep the target on the board; move the camera by the same amount so the view just stops at the edge.
    const clamped = clampTarget(c.target, bounds)
    camera.position.x += clamped.x - c.target.x
    camera.position.y += clamped.y - c.target.y
    camera.position.z += clamped.z - c.target.z
    c.target.set(clamped.x, clamped.y, clamped.z)
  })

  return (
    <MapControls
      ref={controls}
      makeDefault
      screenSpacePanning={false}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      minPolarAngle={rad(MIN_POLAR_DEG)}
      maxPolarAngle={rad(MAX_POLAR_DEG)}
    />
  )
}
```

- [ ] **Step 3: Typecheck and run the unit tests**

Run: `npm run typecheck && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 4: Manual check: keyboard pan**

In the Browser pane (dev server from Task 4), reload the page, wait for the scene, then run via `javascript_tool`:

```js
const m = window.__map; const before = m.camera.position.x;
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
await new Promise(r => setTimeout(r, 600));
window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
[before, m.camera.position.x]
```
Expected: the second value is larger than the first (east pan). Repeat with `'w'` and check `camera.position.z` decreases (moving north).

- [ ] **Step 5: Manual check: clamping**

```js
const m = window.__map; m.controls.target.x = 1e6; m.controls.target.z = -1e6;
await new Promise(r => setTimeout(r, 300));
[m.controls.target.x, m.controls.target.z, m.bounds.maxX, m.bounds.minZ]
```
Expected: `target.x` equals `bounds.maxX` and `target.z` equals `bounds.minZ` (within rounding), i.e. the target is pulled back to the board edge, not left at 1e6. Take a screenshot to confirm the view did not jump into a void or flip.

- [ ] **Step 6: Manual check: focus loss and chords (Review Focus 5)**

```js
const m = window.__map;
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
await new Promise(r => setTimeout(r, 200));
window.dispatchEvent(new Event('blur'));
const a = m.camera.position.x; await new Promise(r => setTimeout(r, 400));
const afterBlur = m.camera.position.x;
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }));
await new Promise(r => setTimeout(r, 300));
[a, afterBlur, m.camera.position.x]
```
Expected: all three numbers are equal: after `blur` the camera stops, and Ctrl+D does nothing.

- [ ] **Step 7: Manual check: mouse**

Using `computer` actions: left-drag pans along the ground (the view slides without the camera tilting), right-drag orbits, scroll zooms. Zoom all the way in and out: it stops at the limits, and orbiting down stops before the camera goes below the horizon. Take a screenshot at max zoom-out to confirm the whole board fits and no unintended void appears.

- [ ] **Step 8: Commit**

```bash
git add src/camera
git commit -m "feat: keyboard pan and bounds clamping for the map camera

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Production build, docs, and final verification

**Files:**
- Create: `README.md`
- Modify: `.claude/launch.json` (add the preview config), `docs/superpowers/specs/2026-10-01-scene-foundation-design.md` (Verification section)

**Interfaces:**
- Consumes: everything above.
- Produces: a `dist/` that loads from a static server, and a README that tells the user how to swap in re-exported meshes.

- [ ] **Step 1: Add the preview config**

In `.claude/launch.json` append to `configurations`:

```json
    {
      "name": "app-preview",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "preview", "--", "--port", "4173", "--strictPort"],
      "port": 4173
    }
```

- [ ] **Step 2: Write the README**

`README.md`:

````markdown
# La Toma de Zacatecas: map app

Interactive 3D map of the 1914 Battle of Zacatecas (React + three.js). Design and plans live in `docs/superpowers/`.

## Run

```bash
npm install
npm run sync-assets   # copies ../Blender/Exports + the Draco decoder into public/
npm run dev           # http://localhost:5173
```

Controls: left-drag pan, right-drag orbit, scroll zoom, WASD / arrow keys pan.

## Updating meshes from Blender

The models in `public/` are copies. After re-exporting from Blender (floor, pieces, or both):

```bash
npm run sync-assets
```

and reload. No code changes are needed as long as the files keep their names (`floor_baked.glb`,
`cathedral.glb`, ...). To add a new piece, drop its `.glb` in `Blender/Exports/meshes/` and add one line to
`src/scene/sceneAssets.ts`. Set `EXPORTS_DIR` to sync from somewhere other than `../Blender/Exports`.
The floor is regenerated with `Blender/heightmaps/bake_floor_mesh.py`.

## Scripts

`npm test` (syncs, then runs unit tests) · `npm run typecheck` · `npm run build` · `npm run preview`
````

- [ ] **Step 3: Update the spec's verification note**

In `docs/superpowers/specs/2026-10-01-scene-foundation-design.md`, in the `## Verification` section, replace the first sentence `No automated tests (parent spec: none for v1). Stage 0 is verified with the` through `measured checks above. The app is verified by running the dev server and using` with:

```
Unit tests (vitest) cover only pure logic: the asset sync script and the camera maths. There are
no browser or visual automated tests (parent spec: none for v1). Stage 0 was verified with the
measured checks above. The app is verified by running the dev server and using
```

(Keep the rest of the sentence and the bullet list that follows unchanged.)

- [ ] **Step 4: Production build and preview**

Run: `npm run build`
Expected: `tsc` clean; Vite builds; `dist/` contains `index.html`, `assets/`, and the copied `models/`, `textures/`, `draco/` folders. Note the total `dist` size (`du -sh dist`).

Then `preview_start` with name `app-preview`, `navigate` to `http://localhost:4173`, wait for load, screenshot.
Expected: identical to the dev view; `read_console_messages` with `onlyErrors: true` is empty; `read_network_requests` shows `draco/draco_wasm_wrapper.js` and `draco/draco_decoder.wasm` fetched from `localhost` (not `gstatic.com`), proving the decoder is local.

- [ ] **Step 5: Narrow-window check (Review Focus 4)**

`resize_window` to `{ width: 480, height: 900 }`, reload the preview.
Expected: the whole board width is visible (not cropped at the sides). Then resize to desktop without reloading: the camera must not jump back to a default view. Restore with `resize_window` preset `desktop`.

- [ ] **Step 6: Final run of everything and commit**

Run: `npm test && npm run build`
Expected: all green.

```bash
git add README.md .claude/launch.json docs
git commit -m "docs: README, preview config, and test scope note

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review notes (plan author)

**Spec coverage:** asset delivery and Draco hosted locally → Task 2; `sceneAssets.ts`, `Piece`, `Terrain` (bounds from geometry, no normal map/displacement), `MapCamera` (framing, MapControls, clamping), `useKeyboardPan`, `Lighting`, `Loader`, `App` → Tasks 3–5; project layout and README → Tasks 1, 6; verification bullets (no console errors, shading, pieces seated, controls clamped, `npm run build` + `vite preview`) → Tasks 4–6. `getHeightAt` and everything under "Out of scope" is intentionally absent.

**Spec deviations to confirm with the user:** (1) unit tests for pure logic were added although the spec said no automated tests; the spec's Verification section is updated in Task 6. (2) Camera distance is "fit the board width" rather than the Blender diorama's fixed 650 units (which shows only about two thirds of the board); the 29 degree tilt and 23 degree field of view are kept.

**Known judgement calls to tune visually in Task 4:** light intensities (`Lighting.tsx`), `BACKGROUND` colour.
