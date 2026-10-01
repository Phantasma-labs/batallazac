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
