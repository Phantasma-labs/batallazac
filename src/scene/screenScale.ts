import type { PerspectiveCamera } from 'three'
import type { Vec3 } from '../camera/math'

/** World units that one screen pixel covers at `point`, for this camera and viewport height in pixels. */
export function worldPerPixel(camera: Pick<PerspectiveCamera, 'position' | 'fov'>, point: Vec3, viewportHeight: number): number {
  const d = Math.hypot(point.x - camera.position.x, point.y - camera.position.y, point.z - camera.position.z)
  return (2 * d * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(viewportHeight, 1)
}

/**
 * Scale that makes something modelled `modelHeight` world units tall appear `pixels` tall on screen, wherever the
 * camera is, kept between `min` and `max` times its modelled size so it never vanishes or swallows a statue.
 */
export function screenScale(camera: Pick<PerspectiveCamera, 'position' | 'fov'>, point: Vec3, viewportHeight: number, modelHeight: number, pixels: number, min = 0.25, max = 6): number {
  const s = (worldPerPixel(camera, point, viewportHeight) * pixels) / modelHeight
  return Math.min(Math.max(s, min), max)
}
