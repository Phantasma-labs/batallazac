import type { GeneralId } from './generals'

/**
 * A general's portrait clip: the silent MP4, its first frame (the poster, the aged photo) and its last frame (the round picture on his
 * button, the restored colour face). Paths are relative to the page, like the models. Made with
 * `npm run optimize-video -- <master.mov> <id>-portrait --max-height 720`. A general with no entry here has a panel with no picture.
 * This is not `VIDEO_SOURCES`: that table is for the timeline's hotspot films, and these ids must not collide with them.
 */
export type PortraitFile = { src?: string; poster?: string; thumb?: string }

export const PORTRAIT_FILES: Partial<Record<GeneralId, PortraitFile>> = {
  angeles: { src: 'videos/angeles-portrait.mp4', poster: 'videos/angeles-portrait.jpg', thumb: 'videos/angeles-thumb.jpg' },
}

export const portraitOf = (id: GeneralId): PortraitFile | undefined => PORTRAIT_FILES[id]
