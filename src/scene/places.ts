import { PAGE_TITLE } from '../i18n'
import { HOTSPOTS } from '../camera/hotspots'
import { stretchHotspots } from '../camera/locked'
import type { Vec3 } from '../camera/math'

/** A named place on the board, marked by a small 3D pin with a label. */
export type Pin = {
  id: string
  label: string
  /** The hotspot a click on the pin goes to; pins without one are for show only (La Sierpe). */
  hotspotId?: string
}

export const PINS: Pin[] = [
  { id: 'vetagrande', label: 'Vetagrande', hotspotId: 'angeles-artillery' },
  { id: 'elgrillo', label: 'Cerro del Grillo', hotspotId: 'elgrillo' },
  { id: 'sierpe', label: 'Cerro de la Sierpe' },
  { id: 'loreto', label: 'Cerro de Loreto' },
  { id: 'labufa', label: 'Cerro de la Bufa', hotspotId: 'labufa' },
  { id: 'centro', label: 'Centro de Zacatecas', hotspotId: 'cathedral' },
  { id: 'toma', label: PAGE_TITLE },
]

/** The title lettering "La Toma de Zacatecas", on the board's north-west corner just right of the compass (world coordinates, not stretched). */
export const TOMA_TITLE: Vec3 = { x: -450, y: 0, z: -370 }

/**
 * Where a marching unit starts or stops that is not a pin: the camp in the north-west, between the compass and La Sierpe,
 * where Villa's train stands (the `villa-train` hotspot).
 */
const HIDDEN_PLACES: { id: string; hotspotId: string }[] = [{ id: 'villa-camp', hotspotId: 'villa-train' }]

// Where the soldiers and guns stand as baked into the GLBs of the wide set (`Blender/Exports_wide`), in world coordinates (the
// stretch does not apply: these are the statues' own positions). The units start there, so that a unit's march begins exactly
// where its statue stands. Heights are replaced by the terrain's (`onGround`).

/** The middle of the three Vetagrande cannons that go on to Cerro de Loreto (cannons 01, 02 and 03 of `vetagrande_cannons.glb`). */
export const ANGELES_GUNS: Vec3 = { x: 278.6453, y: 25.9, z: -277.5175 }
/** The middle of the two Vetagrande cannons that stay (04 and 05): where their glow stands once the other three have gone. */
export const ANGELES_REAR: Vec3 = { x: 392, y: 0, z: -277.5 }
/** The villista soldiers baked in the south-west (`Soldiers_Villista_ElGrillo_Assault`): Pánfilo Natera's army. */
export const NATERA_POST: Vec3 = { x: -634.4744, y: 15.8, z: 245.9232 }
/** The three federal groups (`soldiers_federal.glb`): on El Grillo, east of the cathedral and on La Bufa. */
export const FEDERAL_POSTS = {
  grillo: { x: -494.1843, y: 37.76, z: 98.3143 },
  centro: { x: -48, y: 11.26, z: 100 },
  bufa: { x: 355.5095, y: 32.34, z: 15.5176 },
} as const

/**
 * Where Villa's soldiers wait in his camp, from the camp itself (the locomotive stands on it): beside the train and a little south of
 * it, so the two do not overlap.
 */
export const VILLA_TROOPS_OFFSET: Vec3 = { x: 58, y: 0, z: 32 }

/**
 * La Sierpe is north-west of the Cerro del Grillo ("300 metres" in México Desconocido): north of the Grillo pin and a little west
 * of it, in world units after the board's stretch. A first estimate from the reference map was (-110, -80); the author then moved
 * the battle with two circles on a screenshot (2026-10-12), north-east onto the ridge (by +82, -35). Tune by eye.
 */
export const SIERPE_OFFSET: Vec3 = { x: -28, y: 0, z: -115 }

/**
 * Where the federals who hold La Sierpe stand, from its pin: a little down the slope on the side toward El Grillo, so that Villa, who
 * arrives at the pin from the north-west, does not stand on them, and they have the way back to El Grillo before them.
 */
export const SIERPE_GARRISON_OFFSET: Vec3 = { x: 42, y: 0, z: 32 }

/**
 * Cerro de Loreto (also La Tierra Colorada), the first federal hill taken: "more or less halfway" between Vetagrande
 * and the city, north-north-east of the cathedral, where Ángeles' guns were advanced. In world units from the cathedral
 * after the stretch; placed from the author's circle on a screenshot, tune by eye.
 */
export const LORETO_OFFSET: Vec3 = { x: 129, y: 0, z: -160 }

/**
 * Where the federals who hold Cerro de Loreto stand until 11:00, from its pin: down the slope on the side toward the city, so the guns
 * that come to the pin at 11:00 do not arrive on top of them.
 */
export const LORETO_GARRISON_OFFSET: Vec3 = { x: -45, y: 0, z: 35 }

/**
 * Where the armies stand when they take a place, as offsets from its pin in world units after the stretch: a little short of it, on
 * the side they come from, so that two armies that arrive together stand side by side, not on top of each other or of the federal
 * statues on the pin. Villa and Natera at El Grillo (from the north-west and the south-west), at the city centre (west of the
 * cathedral) and at La Bufa (west of the federal garrison).
 */
export const STANDS: Record<string, { from: string; offset: Vec3 }> = {
  'elgrillo-nw': { from: 'elgrillo', offset: { x: -45, y: 0, z: -30 } },
  'elgrillo-sw': { from: 'elgrillo', offset: { x: -40, y: 0, z: 60 } },
  'centro-villa': { from: 'centro', offset: { x: -70, y: 0, z: 45 } },
  'centro-natera': { from: 'centro', offset: { x: -70, y: 0, z: -45 } },
  'bufa-villa': { from: 'labufa', offset: { x: -80, y: 0, z: -45 } },
  'labufa-sur': { from: 'labufa', offset: { x: -80, y: 0, z: 70 } },
}

/**
 * Where the federal groups stand after they fall back, as offsets from the baked group they join. The Grillo group goes to the city
 * centre (south of the garrison there), the groups of the centre and of El Grillo to La Bufa (north and south of the garrison there).
 * The group thrown back from La Sierpe stands behind the garrison at El Grillo (east, away from where the attackers come from), north
 * of the one at the centre and east of the one at La Bufa.
 */
export const FEDERAL_STANDS: Record<string, { from: keyof typeof FEDERAL_POSTS; offset: Vec3 }> = {
  'grillo-sierpe': { from: 'grillo', offset: { x: 38, y: 0, z: -30 } },
  'centro-federales-2': { from: 'centro', offset: { x: 0, y: 0, z: 34 } },
  'centro-sierpe': { from: 'centro', offset: { x: 0, y: 0, z: -34 } },
  'bufa-fed-1': { from: 'bufa', offset: { x: -6, y: 0, z: -36 } },
  'bufa-fed-2': { from: 'bufa', offset: { x: -6, y: 0, z: 38 } },
  'bufa-fed-3': { from: 'bufa', offset: { x: 44, y: 0, z: 2 } },
}

/**
 * Where the federal army leaves the map when La Bufa falls, past the south-east (bottom-right) corner of the screen (the opening view
 * ends near x = 535): one group along the east road, the others fanning out toward the south-east and the south, the group thrown back
 * from La Sierpe furthest, into the corner. In world units.
 */
export const EXITS: Record<string, Vec3> = {
  'salida-1': { x: 650, y: 0, z: 225 },
  'salida-2': { x: 625, y: 0, z: 310 },
  'salida-3': { x: 585, y: 0, z: 395 },
  'salida-4': { x: 590, y: 0, z: 470 },
}

/**
 * Every place a pin, a march or an attack can name, by id, in world coordinates for a board stretched `k` wider
 * with its moved hills (see `stretchHotspots`). Heights are the hotspots' rough ones; `onGround` puts them on the terrain.
 * With `gunsTogether` (the light version, where the artillery is one formation that divides) the guns that stay start where the
 * others do, not where the cannon statues of those two stand.
 */
export function placePoints(k = 1, shifts: Readonly<Record<string, number>> = {}, gunsTogether = false): Map<string, Vec3> {
  const hotspot = new Map(stretchHotspots(HOTSPOTS, k, shifts).map((h) => [h.id, h.point]))
  const out = new Map<string, Vec3>()
  const need = (id: string) => {
    const p = hotspot.get(id)
    if (!p) throw new Error(`no hotspot "${id}"`)
    return p
  }
  const add = (id: string, from: Vec3, offset: Vec3) => out.set(id, { x: from.x + offset.x, y: from.y + offset.y, z: from.z + offset.z })
  for (const pin of PINS) {
    if (pin.hotspotId) out.set(pin.id, need(pin.hotspotId))
  }
  add('sierpe', need('elgrillo'), SIERPE_OFFSET)
  add('sierpe-federales', out.get('sierpe')!, SIERPE_GARRISON_OFFSET)
  add('loreto', need('cathedral'), LORETO_OFFSET)
  add('loreto-federales', out.get('loreto')!, LORETO_GARRISON_OFFSET)
  for (const h of HIDDEN_PLACES) out.set(h.id, need(h.hotspotId))
  add('villa-troops', need('villa-train'), VILLA_TROOPS_OFFSET)
  for (const [id, { from, offset }] of Object.entries(STANDS)) add(id, out.get(from)!, offset)
  out.set('toma', TOMA_TITLE)
  out.set('angeles-guns', ANGELES_GUNS)
  out.set('angeles-rear', gunsTogether ? ANGELES_GUNS : ANGELES_REAR)
  out.set('suroeste', NATERA_POST)
  out.set('grillo-federales', FEDERAL_POSTS.grillo)
  out.set('centro-federales', FEDERAL_POSTS.centro)
  out.set('bufa-federales', FEDERAL_POSTS.bufa)
  for (const [id, { from, offset }] of Object.entries(FEDERAL_STANDS)) add(id, FEDERAL_POSTS[from], offset)
  for (const [id, p] of Object.entries(EXITS)) out.set(id, p)
  return out
}

/** The same places with their heights replaced by the ground's (`groundY(x, z)`). */
export function onGround(places: ReadonlyMap<string, Vec3>, groundY: (x: number, z: number) => number): Map<string, Vec3> {
  return new Map([...places].map(([id, p]) => [id, { x: p.x, y: groundY(p.x, p.z), z: p.z }]))
}
