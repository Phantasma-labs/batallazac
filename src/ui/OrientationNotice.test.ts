import { describe, expect, it } from 'vitest'
import { tooSmall } from './OrientationNotice'

describe('the landscape notice', () => {
  it('lets a small tablet in: 1024 x 600 and up', () => {
    expect(tooSmall(1024, 600)).toBe(false)
    expect(tooSmall(1024, 768)).toBe(false)
    expect(tooSmall(1180, 820)).toBe(false)
    expect(tooSmall(1280, 720)).toBe(false)
    expect(tooSmall(1920, 1080)).toBe(false)
  })
  it('turns away anything smaller than that', () => {
    expect(tooSmall(1023, 768)).toBe(true)
    expect(tooSmall(1024, 599)).toBe(true)
    expect(tooSmall(960, 600)).toBe(true)
  })
  it('turns away a portrait window, however big', () => {
    expect(tooSmall(820, 1180)).toBe(true)
    expect(tooSmall(1100, 1200)).toBe(true)
  })
})
