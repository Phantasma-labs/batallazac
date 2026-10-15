import type { Hotspot } from './locked'

/**
 * Where the locked camera can zoom to. Points are the piece positions baked into the GLBs
 * (public/models); the Vetagrande cannons are Felipe Angeles' artillery. Roll is kept slight on purpose.
 * Radii and click targets are sized for statues 3x their original size (see Blender/heightmaps/export_wide_set.py).
 */
export const HOTSPOTS: Hotspot[] = [
  { id: 'angeles-artillery', point: { x: 193, y: 12, z: -277.5 }, radius: 130, hitRadius: 110, rollDeg: 3 },
  { id: 'elgrillo', point: { x: -346, y: 30, z: 103 }, radius: 80, hitRadius: 55, rollDeg: -2.5 },
  // Aimed between the federal soldiers and their sandbags (the fort that stood here was removed).
  { id: 'labufa', point: { x: 222, y: 25, z: 18 }, radius: 80, hitRadius: 55, rollDeg: 2 },
  // The federal garrison with its sandbags stands east of the cathedral: aim a little east of it and open the lens so both fit.
  { id: 'cathedral', point: { x: -50, y: 8, z: 95 }, radius: 90, hitRadius: 45, rollDeg: -3 },
  // Villa's camp in the north-west, between the compass and La Sierpe, where his train stands (the locomotive's baked
  // position, in the south-west on the rail, is moved here in assets.json). The point is in the board's original x, so
  // the stretch (1.679) puts it at about x = -623, z = -197.
  { id: 'villa-train', point: { x: -371, y: 5, z: -197 }, radius: 90, hitRadius: 55, rollDeg: -2 },
]
