import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cpSync } from 'node:fs'
import { syncAssets } from './sync-assets.mjs'

const DRACO = ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']
const MANIFEST = {
  floor: { model: 'models/floor_baked.glb', basecolor: 'textures/floor/floor_basecolor.jpg' },
  pieces: [{ id: 'cathedral', url: 'models/cathedral.glb' }],
}
/** A file that passes the GLB header check ("glTF" magic, long enough for a header + chunk header). */
const glb = (tag = 'x') => 'glTF' + tag.padEnd(32, '.')

function put(path, content = 'x') {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

let root, dirs
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sync-assets-'))
  dirs = { exportsDir: join(root, 'Exports'), publicDir: join(root, 'public'), dracoDir: join(root, 'draco-src'), manifest: MANIFEST }
  put(join(dirs.exportsDir, 'meshes', 'floor.glb'), glb('legacy floor'))
  put(join(dirs.exportsDir, 'meshes', 'floor_baked.glb'), glb('baked v1'))
  put(join(dirs.exportsDir, 'meshes', 'cathedral.glb'), glb('cathedral'))
  put(join(dirs.exportsDir, 'meshes', 'floor_baked.json'))
  put(join(dirs.exportsDir, 'textures', 'floor', 'floor_basecolor.jpg'), 'jpg')
  put(join(dirs.exportsDir, 'textures', 'floor', 'floor_normal.png'))
  put(join(dirs.exportsDir, 'textures', 'floor', 'floor_height.png'))
  for (const f of DRACO) put(join(dirs.dracoDir, f))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('syncAssets', () => {
  it('copies the models the manifest references but not the legacy floor or non-glb files', () => {
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
    put(join(dirs.exportsDir, 'meshes', 'floor_baked.glb'), glb('baked v2'))
    syncAssets(dirs)
    expect(readFileSync(join(dirs.publicDir, 'models', 'floor_baked.glb'), 'utf8')).toBe(glb('baked v2'))
    expect(existsSync(join(dirs.publicDir, 'models', 'old_piece.glb'))).toBe(false)
  })

  it('returns the list of copied files and leaves no staging folders behind', () => {
    const { copied } = syncAssets(dirs)
    expect(copied).toContain('models/floor_baked.glb')
    expect(copied).toContain('textures/floor/floor_basecolor.jpg')
    expect(copied).toContain('draco/draco_wasm_wrapper.js')
    expect(readdirSync(dirs.publicDir).filter((n) => n.endsWith('.tmp'))).toEqual([])
    expect(readdirSync(join(dirs.publicDir, 'textures')).filter((n) => n.endsWith('.tmp'))).toEqual([])
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

  // Review finding I4: a failure while copying must not destroy the working copy.
  it('keeps the previous models intact when copying fails partway through', () => {
    syncAssets(dirs)
    put(join(dirs.publicDir, 'models', 'keep_me.glb'), 'working copy')
    let calls = 0
    const flaky = (src, dest, opts) => {
      if (++calls === 2) throw new Error('EPERM: simulated antivirus lock')
      cpSync(src, dest, opts)
    }
    expect(() => syncAssets({ ...dirs, copy: flaky })).toThrow(/EPERM/)
    expect(readFileSync(join(dirs.publicDir, 'models', 'keep_me.glb'), 'utf8')).toBe('working copy')
    expect(readdirSync(dirs.publicDir).filter((n) => n.endsWith('.tmp'))).toEqual([])
  })

  // Review finding I4: Blender may still be writing the file, or it may be empty.
  it('rejects a model that is empty or not a GLB, naming it, and leaves the previous models untouched', () => {
    syncAssets(dirs)
    put(join(dirs.publicDir, 'models', 'keep_me.glb'), 'working copy')
    put(join(dirs.exportsDir, 'meshes', 'cathedral.glb'), '')
    expect(() => syncAssets(dirs)).toThrow(/cathedral\.glb.*not a valid GLB/)
    put(join(dirs.exportsDir, 'meshes', 'cathedral.glb'), 'this is plain text, not a glb file at all')
    expect(() => syncAssets(dirs)).toThrow(/cathedral\.glb.*not a valid GLB/)
    expect(readFileSync(join(dirs.publicDir, 'models', 'keep_me.glb'), 'utf8')).toBe('working copy')
  })

  // Review finding I5: a renamed model must be reported with the real fix.
  it('reports a model the manifest needs but Blender no longer exports, pointing at assets.json', () => {
    rmSync(join(dirs.exportsDir, 'meshes', 'cathedral.glb'))
    put(join(dirs.exportsDir, 'meshes', 'catedral.glb'), glb('renamed'))
    expect(() => syncAssets(dirs)).toThrow(/cathedral\.glb[\s\S]*assets\.json/)
  })

  it('warns about an exported model the manifest does not use, but not about the legacy floor', () => {
    put(join(dirs.exportsDir, 'meshes', 'new_piece.glb'), glb('new'))
    const { warnings } = syncAssets(dirs)
    expect(warnings.join('\n')).toMatch(/new_piece\.glb/)
    expect(warnings.join('\n')).toMatch(/assets\.json/)
    expect(warnings.join('\n')).not.toMatch(/floor\.glb/)
    expect(existsSync(join(dirs.publicDir, 'models', 'new_piece.glb'))).toBe(false)
  })

  it('has no warnings when everything exported is used', () => {
    expect(syncAssets(dirs).warnings).toEqual([])
  })
})
