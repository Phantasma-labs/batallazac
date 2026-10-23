import { describe, expect, it, vi } from 'vitest'
import { createInstallPrompt } from './install'

function promptEvent() {
  return Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  })
}

describe('createInstallPrompt', () => {
  it('is not installable until the browser offers it', () => {
    const p = createInstallPrompt(new EventTarget(), () => false)
    expect(p.snapshot()).toBe(false)
  })

  it('becomes installable on beforeinstallprompt and keeps the event (default prevented)', () => {
    const target = new EventTarget()
    const p = createInstallPrompt(target, () => false)
    const e = promptEvent()
    target.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    expect(p.snapshot()).toBe(true)
  })

  it('is never installable when already running as an app', () => {
    const target = new EventTarget()
    const p = createInstallPrompt(target, () => true)
    target.dispatchEvent(promptEvent())
    expect(p.snapshot()).toBe(false)
  })

  it('install() shows the prompt once and then goes away', async () => {
    const target = new EventTarget()
    const p = createInstallPrompt(target, () => false)
    const e = promptEvent()
    target.dispatchEvent(e)
    await p.install()
    expect(e.prompt).toHaveBeenCalledTimes(1)
    expect(p.snapshot()).toBe(false)
    await p.install()
    expect(e.prompt).toHaveBeenCalledTimes(1)
  })

  it('appinstalled clears it', () => {
    const target = new EventTarget()
    const p = createInstallPrompt(target, () => false)
    target.dispatchEvent(promptEvent())
    target.dispatchEvent(new Event('appinstalled'))
    expect(p.snapshot()).toBe(false)
  })

  it('tells subscribers on each change, and stops after unsubscribe', () => {
    const target = new EventTarget()
    const p = createInstallPrompt(target, () => false)
    const seen = vi.fn()
    const off = p.subscribe(seen)
    target.dispatchEvent(promptEvent())
    expect(seen).toHaveBeenCalledTimes(1)
    off()
    target.dispatchEvent(new Event('appinstalled'))
    expect(seen).toHaveBeenCalledTimes(1)
  })
})
