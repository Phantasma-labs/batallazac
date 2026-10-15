import { describe, expect, it } from 'vitest'
import { screenScale, worldPerPixel } from './screenScale'

const cam = (z: number, fov: number) => ({ position: { x: 0, y: 0, z } as never, fov })
const origin = { x: 0, y: 0, z: 0 }

describe('screen scale', () => {
  it('a 90 degree lens at distance 100 sees 200 units over the viewport height', () => {
    expect(worldPerPixel(cam(100, 90), origin, 1000)).toBeCloseTo(0.2)
  })
  it('zooming in (a narrower lens) makes a pixel cover less ground', () => {
    expect(worldPerPixel(cam(100, 20), origin, 1000)).toBeLessThan(worldPerPixel(cam(100, 90), origin, 1000))
  })
  it('keeps a fixed pixel height until clamped', () => {
    const near = screenScale(cam(100, 30), origin, 768, 10, 40)
    const far = screenScale(cam(200, 30), origin, 768, 10, 40)
    expect(far).toBeCloseTo(near * 2)
    expect(screenScale(cam(1e6, 30), origin, 768, 10, 40, 0.25, 6)).toBe(6)
    expect(screenScale(cam(0.001, 30), origin, 768, 10, 40, 0.25, 6)).toBe(0.25)
  })
})
