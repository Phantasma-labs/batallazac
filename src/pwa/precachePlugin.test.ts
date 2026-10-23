import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildHash, injectManifest, listPrecache } from './precachePlugin'

let dir: string
const put = (name: string, content = name) => {
  const file = join(dir, name)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, content)
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'precache-'))
  for (const f of ['index.html', 'assets/a-1.js', 'models/f.glb', 'videos/natera.mp4', 'videos/natera.jpg', 'videos/natera.en.vtt', 'sw.js', '_headers']) put(f)
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('listPrecache', () => {
  it('lists the app files, not the worker, the headers or the films', () => {
    expect(listPrecache(dir)).toEqual(['assets/a-1.js', 'index.html', 'models/f.glb', 'videos/natera.en.vtt', 'videos/natera.jpg'])
  })
  it('refuses a name that would corrupt the list', () => {
    put('we|ird.txt')
    expect(() => listPrecache(dir)).toThrow('we|ird.txt')
  })
  it.each(["it's.txt", 'a"b.txt', 'a\\b.txt'])('refuses %s', (name) => {
    put(name)
    expect(() => listPrecache(dir)).toThrow()
  })
})

describe('buildHash', () => {
  it('is 12 hex characters and stable', () => {
    const files = listPrecache(dir)
    const hash = buildHash(dir, files)
    expect(hash).toMatch(/^[0-9a-f]{12}$/)
    expect(buildHash(dir, files)).toBe(hash)
  })
  it('changes when a file changes', () => {
    const files = listPrecache(dir)
    const before = buildHash(dir, files)
    put('models/f.glb', 'new bytes')
    expect(buildHash(dir, files)).not.toBe(before)
  })
})

describe('injectManifest', () => {
  it('replaces both tokens', () => {
    expect(injectManifest("const F='__PRECACHE_FILES__',B='__BUILD_HASH__'", ['a', 'b'], 'h1')).toBe("const F='a|b',B='h1'")
  })
  it('throws when a token is missing', () => {
    expect(() => injectManifest("const F='x'", ['a'], 'h1')).toThrow()
  })
})
