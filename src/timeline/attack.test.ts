import { describe, expect, it } from 'vitest'
import { MIN_ARROW, attackLine } from './attack'

const p = (x: number, z: number) => ({ x, y: 0, z })

describe('attackLine', () => {
  it('runs from the attacker to the target when they are apart', () => {
    expect(attackLine(p(0, 0), p(200, 0))).toEqual({ from: p(0, 0), to: p(200, 0) })
  })
  it('starts back along the approach when the attacker stands on its target', () => {
    const line = attackLine(p(100, 100), p(100, 100), p(100, 400))
    expect(line.to).toEqual(p(100, 100))
    expect(line.from.x).toBeCloseTo(100)
    expect(line.from.z).toBeCloseTo(100 + MIN_ARROW)
  })
  it('still draws something with no approach', () => {
    const line = attackLine(p(0, 0), p(0, 0))
    expect(Math.hypot(line.from.x - line.to.x, line.from.z - line.to.z)).toBeCloseTo(MIN_ARROW)
  })
})
