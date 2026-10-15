export type CameraMode = 'free' | 'locked'

/** The user gets the locked (tripod) camera; `?cam=free` opts into the free camera for development. */
export function cameraModeFromSearch(search: string): CameraMode {
  return new URLSearchParams(search).get('cam') === 'free' ? 'free' : 'locked'
}

/**
 * Zooming onto hotspots (by clicking one, or by the timeline director going to an event's shot) is off for now: the animated
 * map is shown whole. `?zoom=on` turns it back on; the shots, hotspots and per-shot camera data all stay in the code.
 */
export function zoomFromSearch(search: string): boolean {
  return new URLSearchParams(search).get('zoom') === 'on'
}
