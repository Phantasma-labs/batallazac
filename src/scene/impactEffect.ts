/**
 * Pure timing of the fire and smoke where an attack lands. Everything is a function of the time, a seed and a slot number
 * (no state), so the tracers in flight and the flashes where they land read the same shells, and the effect looks the
 * same however the clock is scrubbed.
 */

export type ImpactKind = {
  /** Shells (or volleys) in the cycle, each in its own slot. */
  shells: number
  /** Seconds between one slot's launches. */
  period: number
  /** Seconds a shell is in the air (0 = the flash appears at once, like a rifle volley). */
  flight: number
  /** How far from the aim point a shell lands, in effect units (see `effectUnit`). */
  scatter: number
  /** Flash size, in effect units. */
  flash: number
  /** Smoke puffs alive at once. */
  puffs: number
  /** Opacity of the smoke, 0..1. */
  smoke: number
  /** How big the plume and the fire core are, as a share of the full artillery burst. */
  plume: number
  /** Tracers streak from the attacker, and the ground rings out where they land. */
  tracers: boolean
}

/** Artillery: a few shells a cycle, each a streak that ends in a flash and a ring on the ground. */
export const SHELL: ImpactKind = { shells: 4, period: 2.7, flight: 0.9, scatter: 0.75, flash: 1.0, puffs: 14, smoke: 1, plume: 1, tracers: true }
/** Infantry assault: small quick flashes all over the target, less smoke. */
export const VOLLEY: ImpactKind = { shells: 6, period: 1.6, flight: 0, scatter: 1.1, flash: 0.5, puffs: 8, smoke: 0.75, plume: 0.62, tracers: false }

/** An explosion (a magazine, a mine): flash after flash through a tall, dense column of smoke, a plume well past a shell's. */
export const EXPLOSION: ImpactKind = { shells: 6, period: 1.5, flight: 0, scatter: 1.5, flash: 1.7, puffs: 26, smoke: 1.15, plume: 1.9, tracers: false }

/** The most shells any kind has: the size of the ground shader's list of rings. */
export const MAX_SHELLS = 6

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/** A repeatable pseudo-random number in [0, 1) for any input. */
export function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** A stable seed for one attack, so two attacks on one target do not fire in step. */
export function seedOf(key: string): number {
  let h = 7
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 9973
  return h
}

export type Shell = {
  /** How many times this slot has fired before. */
  cycle: number
  /** Seconds into the cycle: 0 is the launch. */
  phase: number
  flying: boolean
  /** How far along its flight, 0..1 (1 once landed). */
  flight: number
  /** Seconds since it landed (negative while still in the air). */
  since: number
  /** Where it lands, relative to the aim point, in effect units. */
  scatter: { x: number; z: number }
}

/** Slot `k`'s shell at `time` (seconds). Each slot launches once per period, staggered through it; its landing point changes every cycle. */
export function shellAt(kind: ImpactKind, k: number, time: number, seed: number): Shell {
  const offset = (kind.period * (k + 0.8 * hash01(seed * 13.7 + k * 3.1))) / kind.shells
  const local = time - offset
  const cycle = Math.floor(local / kind.period)
  const phase = local - cycle * kind.period
  const r1 = hash01(seed * 7.3 + k * 17.9 + cycle * 101.3)
  const r2 = hash01(r1 * 91.7 + 3.3)
  const angle = r1 * Math.PI * 2
  const radius = Math.sqrt(r2) * kind.scatter
  const flying = kind.flight > 0 && phase < kind.flight
  return {
    cycle,
    phase,
    flying,
    flight: flying ? phase / kind.flight : 1,
    since: phase - kind.flight,
    scatter: { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius },
  }
}

/** Brightness of a flash `since` seconds after it started: full at once, gone in a third of a second. */
export const flashLevel = (since: number) => (since < 0 ? 0 : Math.exp(-since / 0.11))

/** Brightness of the muzzle flash `phase` seconds after a launch. */
export const muzzleLevel = (phase: number) => (phase < 0 ? 0 : Math.exp(-phase / 0.07))

/**
 * Brightness (0..1) of one soldier's muzzle flash `time` seconds in: each rifle fires once in every `period` seconds, at a moment of its
 * own in each round (so a group sparkles, not pulses), and the flash is gone in a fifth of a second. `seed` keeps two groups out of step.
 */
export function rifleFlash(rifle: number, time: number, seed: number, period = 1.3): number {
  const local = time / period + hash01(seed * 3.1 + rifle * 7.7)
  const round = Math.floor(local)
  const since = (local - round) * period - hash01(seed * 1.3 + rifle * 5.1 + round * 13.7) * period * 0.8
  return since < 0 ? 0 : Math.exp(-since / 0.06)
}

/** How far the ring on the ground has spread (0..1) and how visible it still is, `since` seconds after the landing. */
export function ringLook(since: number): { spread: number; alpha: number } {
  if (since < 0) return { spread: 0, alpha: 0 }
  return { spread: 1 - Math.exp(-since * 2.6), alpha: Math.pow(Math.max(1 - since / 1.5, 0), 1.6) }
}

export type Puff = {
  /** 0 when the puff is born, 1 when it is gone. */
  age: number
  cycle: number
  /** A repeatable random number per puff and cycle, for its rotation and where it starts. */
  r: number
  r2: number
}

/** Puff `i` of `count` at `time`: each lives `life` seconds and is reborn at once, staggered so the plume never empties. */
export function puffAt(i: number, count: number, time: number, seed: number, life = 3.4): Puff {
  const local = time + (life * i) / count
  const cycle = Math.floor(local / life)
  return {
    age: (local - cycle * life) / life,
    cycle,
    r: hash01(seed * 5.1 + i * 19.7 + cycle * 53.9),
    r2: hash01(seed * 2.9 + i * 7.3 + cycle * 31.1 + 0.5),
  }
}

/**
 * The bang itself, `age` timeline minutes after it: the fireball (`bloom`, 0..1) swells at once and cools over some minutes,
 * and the shock ring on the ground (`spread`, 0..1 of its full radius; `ring`, how visible it still is) races out and fades.
 * In minutes of the clock, not seconds, so that scrubbing the clock plays the bang forward and back.
 */
export function blastLook(age: number): { bloom: number; spread: number; ring: number } {
  if (age < 0) return { bloom: 0, spread: 0, ring: 0 }
  const rise = clamp(age / 0.25, 0, 1)
  return {
    bloom: rise * rise * (3 - 2 * rise) * Math.exp(-age / 4),
    spread: 1 - Math.exp(-age / 3),
    ring: Math.pow(Math.max(1 - age / 12, 0), 1.5),
  }
}

/** The way the wind blows the smoke, on the ground (x, z): toward the north-east, the same everywhere on the board. */
export const WIND = { x: 0.72, z: -0.69 }

/**
 * Smoke by age: swells into a dense mass that holds for a while and then thins out as it climbs. Sizes (diameter), heights
 * and the distance blown downwind are in effect units; "warm" is how much the fire still lights it from inside (1 young, 0 cooled).
 */
export function puffLook(age: number): { alpha: number; size: number; rise: number; drift: number; warm: number } {
  const a = clamp(age, 0, 1)
  const fadeIn = clamp(a / 0.08, 0, 1)
  const fadeOut = clamp((a - 0.42) / 0.58, 0, 1)
  return {
    alpha: fadeIn * fadeIn * (3 - 2 * fadeIn) * (1 - fadeOut * fadeOut * (3 - 2 * fadeOut)),
    size: 1.05 + 1.9 * Math.pow(a, 0.6),
    rise: 0.15 + 2.1 * Math.pow(a, 0.7),
    drift: 2.2 * Math.pow(a, 0.9),
    warm: 1 - clamp(a / 0.4, 0, 1),
  }
}

/** The fire's flicker, 0.78..1: a slow wobble with a quick one on top. */
export function flicker(time: number, seed: number): number {
  return 0.89 + 0.07 * Math.sin(time * 9.3 + seed) + 0.04 * Math.sin(time * 23.1 + seed * 2.7)
}

/** The size, in world units, that the whole effect is built from: a fixed share of the screen, kept between a floor and a ceiling. */
export function effectUnit(worldPerPixel: number, pixels = 46, min = 17, max = 58): number {
  return clamp(worldPerPixel * pixels, min, max)
}
