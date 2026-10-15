import { describe, expect, it, vi } from 'vitest'
import { createManualStore } from './manual'
import type { ManualShot } from './manualShots'

const shot = (patch: Partial<ManualShot> = {}): ManualShot => ({
  position: { x: 10, y: 200, z: 300 },
  yawDeg: 0,
  pitchDeg: 30,
  rollDeg: 0,
  fovDeg: 20,
  dof: { focusDistance: 400, blur: 5, range: 80 },
  ...patch,
})

describe('createManualStore', () => {
  it('starts open, not editing, with the committed shots', () => {
    const s = createManualStore({ committed: { '10:00': shot() } })
    expect(s.snapshot()).toEqual({ shots: { '10:00': shot() }, editing: null, open: true })
  })

  it('lets saved drafts win over the committed shots', () => {
    const saved = JSON.stringify({ shots: { '10:00': shot({ fovDeg: 9 }) } })
    const s = createManualStore({ committed: { '10:00': shot(), '12:00': shot() }, load: () => saved })
    expect(s.snapshot().shots['10:00']!.fovDeg).toBe(9)
    expect(s.snapshot().shots['12:00']).toEqual(shot())
  })

  it('ignores a saved draft it cannot read', () => {
    const s = createManualStore({ committed: { '10:00': shot() }, load: () => '{{{' })
    expect(s.snapshot().shots).toEqual({ '10:00': shot() })
  })

  it('selecting an unplaced shot places it where the camera is now and edits it', () => {
    const saved: string[] = []
    const s = createManualStore({ committed: {}, save: (t) => saved.push(t) })
    s.select('11:00', shot({ fovDeg: 14 }))
    expect(s.snapshot().editing).toBe('11:00')
    expect(s.snapshot().shots['11:00']).toEqual(shot({ fovDeg: 14 }))
    expect(JSON.parse(saved.at(-1)!).shots['11:00'].fovDeg).toBe(14)
  })

  it('selecting a placed shot keeps what it has', () => {
    const s = createManualStore({ committed: { '11:00': shot({ fovDeg: 8 }) } })
    s.select('11:00', shot({ fovDeg: 14 }))
    expect(s.snapshot().shots['11:00']!.fovDeg).toBe(8)
  })

  it('updates part of a shot, leaving the rest, and makes a new object each time', () => {
    const s = createManualStore({ committed: { '12:00': shot() } })
    const before = s.snapshot().shots['12:00']
    s.update('12:00', { position: { y: 555 }, dof: { blur: 9 }, yawDeg: 45 })
    const after = s.snapshot().shots['12:00']!
    expect(after).not.toBe(before)
    expect(after.position).toEqual({ x: 10, y: 555, z: 300 })
    expect(after.dof).toEqual({ focusDistance: 400, blur: 9, range: 80 })
    expect(after.yawDeg).toBe(45)
    expect(after.pitchDeg).toBe(30)
  })

  it('does nothing when asked to update a shot that is not placed', () => {
    const s = createManualStore({ committed: {} })
    const listener = vi.fn()
    s.subscribe(listener)
    s.update('12:00', { yawDeg: 1 })
    expect(s.snapshot().shots).toEqual({})
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops editing, and closing the panel stops editing too', () => {
    const s = createManualStore({ committed: { '12:00': shot() } })
    s.select('12:00', shot())
    s.stopEditing()
    expect(s.snapshot()).toMatchObject({ editing: null, open: true })
    s.select('12:00', shot())
    s.close()
    expect(s.snapshot()).toMatchObject({ editing: null, open: false })
    s.show()
    expect(s.snapshot().open).toBe(true)
  })

  it('resets a shot to the committed one, or removes it when none was committed, and stops editing it', () => {
    const s = createManualStore({ committed: { '10:00': shot() } })
    s.select('10:00', shot())
    s.update('10:00', { fovDeg: 3 })
    s.reset('10:00')
    expect(s.snapshot().shots['10:00']).toEqual(shot())
    expect(s.snapshot().editing).toBeNull()
    s.select('11:00', shot())
    s.reset('11:00')
    expect(s.snapshot().shots['11:00']).toBeUndefined()
  })

  it('tells subscribers when something changed and gives the same snapshot when nothing did', () => {
    const s = createManualStore({ committed: { '10:00': shot() } })
    const listener = vi.fn()
    const off = s.subscribe(listener)
    const first = s.snapshot()
    s.stopEditing() // already not editing
    expect(s.snapshot()).toBe(first)
    expect(listener).not.toHaveBeenCalled()
    s.select('10:00', shot())
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    s.close()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
