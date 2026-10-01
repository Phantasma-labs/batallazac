import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALL_PUBLIC_FILES, PIECES } from './sceneAssets'

const publicDir = fileURLToPath(new URL('../../public', import.meta.url))

describe('scene asset manifest', () => {
  it('only references files that exist in public/ (run `npm run sync-assets`; if a name changed, edit src/scene/assets.json)', () => {
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
