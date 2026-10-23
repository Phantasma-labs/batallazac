import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

/** Files of the build the worker does not precache: itself, the Cloudflare headers file, and the films (cached after their first play). */
const SKIPPED = (path: string) => path === 'sw.js' || path === '_headers' || /^videos\/[^/]+\.mp4$/.test(path)

/** Names the worker's `|`-joined list (and its quotes) cannot hold. */
const UNSAFE = /[|'"\\]/

function walk(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]))
}

/** The files of the built folder the worker precaches, as sorted relative paths. */
export function listPrecache(dir: string): string[] {
  const files = walk(dir).filter((f) => !SKIPPED(f)).sort()
  const bad = files.find((f) => UNSAFE.test(f))
  if (bad) throw new Error(`precache: the file name "${bad}" contains | ' " or \\ and cannot go in the worker's list`)
  return files
}

/** A short hash of the names and bytes of `files`: the cache name changes whenever any of them does. */
export function buildHash(dir: string, files: string[]): string {
  const hash = createHash('sha256')
  for (const f of files) hash.update(f).update('\0').update(readFileSync(join(dir, f))).update('\0')
  return hash.digest('hex').slice(0, 12)
}

/** Writes the list and the hash into the worker's code, in place of its two tokens. */
export function injectManifest(code: string, files: string[], hash: string): string {
  for (const token of ['__PRECACHE_FILES__', '__BUILD_HASH__']) if (!code.includes(token)) throw new Error(`precache: sw.js has no ${token} to replace`)
  return code.replace('__PRECACHE_FILES__', () => files.join('|')).replace('__BUILD_HASH__', () => hash)
}

/** After the build: lists the built folder and writes the list and a hash into dist/sw.js. */
export function precachePlugin(): Plugin {
  return {
    name: 'precache-manifest',
    apply: 'build',
    writeBundle(options) {
      const dir = options.dir
      if (!dir) return
      const files = listPrecache(dir)
      const sw = join(dir, 'sw.js')
      writeFileSync(sw, injectManifest(readFileSync(sw, 'utf8'), files, buildHash(dir, files)))
    },
  }
}
