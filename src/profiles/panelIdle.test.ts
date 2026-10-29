import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PANEL_IDLE_MS, watchPanelIdle } from './panelIdle'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

/** A stand-in for the profiles store: `open`/`shut` change `current` and tell the watcher, as the real store does. */
const make = () => {
  const listeners = new Set<() => void>()
  const profiles = {
    current: null as unknown,
    subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)),
    close: vi.fn(() => shut()),
  }
  const open = () => {
    profiles.current = { id: 'villa' }
    listeners.forEach((l) => l())
  }
  const shut = () => {
    profiles.current = null
    listeners.forEach((l) => l())
  }
  const source = new EventTarget()
  const stop = watchPanelIdle(profiles, source)
  return { profiles, open, shut, source, stop, listeners }
}

describe('a panel nobody is reading', () => {
  it('is closed after 90 seconds with no input', () => {
    const { profiles, open } = make()
    open()
    vi.advanceTimersByTime(PANEL_IDLE_MS - 1)
    expect(profiles.close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(profiles.close).toHaveBeenCalledTimes(1)
  })

  it('waits another 90 seconds after any input', () => {
    const { profiles, open, source } = make()
    open()
    vi.advanceTimersByTime(PANEL_IDLE_MS - 1000)
    source.dispatchEvent(new Event('pointermove'))
    vi.advanceTimersByTime(PANEL_IDLE_MS - 1)
    expect(profiles.close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(profiles.close).toHaveBeenCalledTimes(1)
  })

  it('does nothing while no panel is open, even with input', () => {
    const { profiles, source } = make()
    source.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(PANEL_IDLE_MS * 3)
    expect(profiles.close).not.toHaveBeenCalled()
  })

  it('is disarmed when the panel is closed by hand', () => {
    const { profiles, open, shut } = make()
    open()
    vi.advanceTimersByTime(PANEL_IDLE_MS / 2)
    shut()
    vi.advanceTimersByTime(PANEL_IDLE_MS * 3)
    expect(profiles.close).not.toHaveBeenCalled()
  })

  it('stops watching when disposed', () => {
    const { profiles, open, stop, listeners } = make()
    open()
    stop()
    vi.advanceTimersByTime(PANEL_IDLE_MS * 3)
    expect(profiles.close).not.toHaveBeenCalled()
    expect(listeners.size).toBe(0)
  })
})
