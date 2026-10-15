import { DAY_END } from '../timeline/model'
import { SHOT_KEYS, SHOT_MINUTES, type ManualShot, type Shots } from './manualShots'

/**
 * The hand-placed shots as keyframes: the camera is always moving from one to the next, as a pure function of the time of day
 * (`buildTrack`), never stopping or snapping at a shot it is passing through. The wide shot is the first keyframe.
 */

/**
 * A smooth curve through the points (a monotone cubic Hermite, Fritsch-Carlson): between two points it never goes beyond them
 * when the data keeps going one way, a flat stretch stays flat, and a peak is a rest rather than an overshoot. The slope is the
 * same on both sides of a point the data passes through, so there is no kink. Outside the points the end values hold.
 */
export function pchip(xs: readonly number[], ys: readonly number[]): (x: number) => number {
  const n = xs.length
  if (n === 1) return () => ys[0]
  const h: number[] = [], delta: number[] = []
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1] - xs[i])
    delta.push((ys[i + 1] - ys[i]) / h[i])
  }
  const d: number[] = new Array(n)
  if (n === 2) {
    d[0] = d[1] = delta[0]
  } else {
    for (let i = 1; i < n - 1; i++) {
      if (delta[i - 1] * delta[i] <= 0) d[i] = 0
      else {
        const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]
        d[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i])
      }
    }
    d[0] = endSlope(h[0], h[1], delta[0], delta[1])
    d[n - 1] = endSlope(h[n - 2], h[n - 3], delta[n - 2], delta[n - 3])
  }
  return (x) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (x > xs[i + 1]) i++
    const t = (x - xs[i]) / h[i]
    const t2 = t * t, t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * d[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * d[i + 1]
  }
}

/** The slope at an end of the curve: a three-point estimate, kept from pointing the wrong way or running ahead of the data. */
function endSlope(h0: number, h1: number, d0: number, d1: number): number {
  const d = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1)
  if (Math.sign(d) !== Math.sign(d0)) return 0
  if (Math.sign(d0) !== Math.sign(d1) && Math.abs(d) > 3 * Math.abs(d0)) return 3 * d0
  return d
}

export type Key = { time: number; pose: ManualShot }

/**
 * The keyframes: the wide shot at the start of the day, then each placed shot at its time. `toTime` puts a clock minute on the axis
 * the track is evaluated on (the timeline's bar, where the squeezed hours are short, so every leg takes as long on screen).
 */
export function trackKeys(wide: ManualShot, shots: Shots, toTime: (clockMinutes: number) => number): Key[] {
  const keys: Key[] = [{ time: toTime(0), pose: wide }]
  for (const k of SHOT_KEYS) {
    const pose = shots[k]
    if (pose) keys.push({ time: toTime(SHOT_MINUTES[k]), pose })
  }
  // The battle is over at the end of the day: the camera is back on the opening wide shot.
  keys.push({ time: toTime(DAY_END), pose: wide })
  return keys
}

/** Brings a compass heading into -180..180. */
const wrapDeg = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180

/**
 * The pose at any time, flowing through the keys. Each number moves on its own curve; the lens moves in log space (an even zoom) and
 * the heading takes the short way round.
 */
export function buildTrack(keys: readonly Key[]): (time: number) => ManualShot {
  const ks = [...keys].sort((a, b) => a.time - b.time)
  const times = ks.map((k) => k.time)
  const curve = (value: (p: ManualShot) => number) =>
    pchip(times, ks.map((k) => value(k.pose)))
  const yaws: number[] = []
  for (const k of ks) {
    let y = k.pose.yawDeg
    if (yaws.length) {
      const prev = yaws[yaws.length - 1]
      while (y - prev > 180) y -= 360
      while (y - prev < -180) y += 360
    }
    yaws.push(y)
  }
  const x = curve((p) => p.position.x), y = curve((p) => p.position.y), z = curve((p) => p.position.z)
  const yaw = pchip(times, yaws), pitch = curve((p) => p.pitchDeg), roll = curve((p) => p.rollDeg)
  const lnFov = curve((p) => Math.log(p.fovDeg))
  const focus = curve((p) => p.dof.focusDistance), blur = curve((p) => p.dof.blur), range = curve((p) => p.dof.range)
  return (t) => ({
    position: { x: x(t), y: y(t), z: z(t) },
    yawDeg: wrapDeg(yaw(t)),
    pitchDeg: pitch(t),
    rollDeg: roll(t),
    fovDeg: Math.exp(lnFov(t)),
    dof: { focusDistance: focus(t), blur: blur(t), range: range(t) },
  })
}

/** Seconds the camera takes to settle on the track after the clock jumps (the film ending, a click on a tick, a scrub). */
export const FOLLOW_SECONDS = 0.3

/** How far to move toward a target this frame so the glide looks the same at any frame rate (exponential smoothing with time constant `tau`). */
export const followFactor = (dt: number, tau: number) => 1 - Math.exp(-dt / tau)
