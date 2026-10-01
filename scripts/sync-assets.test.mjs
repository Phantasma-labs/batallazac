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
    expect(() => syncAssets(dirs)).toThrow(/floor_baked\.glb/)
    expect(readFileSync(join(dirs.publicDir, 'models', 'keep_me.glb'), 'utf8')).toBe('working copy')
  })

  it('fails with an npm install hint when a Draco decoder file is missing', () => {
    rmSync(join(dirs.dracoDir, 'draco_decoder.wasm'))
    expect(() => syncAssets(dirs)).toThrow(/npm install/)
  })

  it('fails when the base colour texture is missing', () => {
    rmSync(join(dirs.exportsDir, 'textures', 'floor', 'floor_basecolor.jpg'))
    expect(() => syncAssets(dirs)).toThrow(/floor_basecolor\.jpg/)
  })
})
