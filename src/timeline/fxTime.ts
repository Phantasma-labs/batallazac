/**
 * Seconds of effects time: the time that the cannon fire, flashes, smoke, tracers and the soldiers' sway run on. It advances only while
 * the timeline clock is playing (the Director adds each frame's seconds), so pausing freezes them mid-beat instead of letting them run on.
 */
export const fx = { time: 0 }
