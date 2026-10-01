import manifest from './assets.json'

/**
 * Everything the scene loads. The list lives in assets.json so `npm run sync-assets` can check it
 * against what Blender exported. Paths are relative to public/ (filled by `npm run sync-assets`).
 * Positions are baked into each GLB's nodes; adding a piece to the scene is one line in assets.json.
 */
export const DRACO_PATH = 'draco/'

export const FLOOR = manifest.floor
export const PIECES = manifest.pieces

export const ALL_PUBLIC_FILES: string[] = [
  FLOOR.model,
  FLOOR.basecolor,
  ...PIECES.map((p) => p.url),
  `${DRACO_PATH}draco_decoder.js`,
  `${DRACO_PATH}draco_decoder.wasm`,
  `${DRACO_PATH}draco_wasm_wrapper.js`,
]
