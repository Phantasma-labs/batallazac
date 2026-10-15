# Video Hotspots on the Timeline — Design

Extends [2026-10-09-timeline-pins-devpanel-design.md](2026-10-09-timeline-pins-devpanel-design.md) (clock, one-lane strip, events) and the day as it
stands in `../progress/HANDOFF.md`. Status: **built (2026-10-09); see `../progress/HANDOFF.md`.**

## Goal

The viewer opens the map, presses Play and first meets **Felipe Ángeles** in a short film shown on top of the map. When it ends the map is at
**10:00** and the battle runs. Along the day, a few strip ticks are **video hotspots**: when the clock reaches one, playback pauses, its video plays
over the map, and the clock carries on. Other events are **info only**: a caption, no video.

Success looks like:
1. First load, Play: the Felipe Ángeles video plays full-frame over the map (with sound, Skip always available); on its end the clock is at 10:00 and running.
2. Playing through 12:00, 16:00, 17:00 and 19:00 opens each one's video (once their files exist); 11:00 and 18:00 never do.
3. Nothing ever sticks: a missing or broken video is skipped and the day goes on.
4. The strip says which ticks have a video (a ring with a play mark) and which are info only (a small plain dot).

## What the user said (decisions already made)

- At **10:00** three things start together: Ángeles' guns, Villa from the north-west and Pánfilo Natera from the south-west. **No more 10:05.**
- **00:00 to 10:00 is the Felipe Ángeles video.** On first load, pressing Play loads and shows it; afterwards the map is at 10:00 and running.
  Chosen from options: it plays **whenever Play is pressed before 10:00** (first load, and again after scrubbing back to the start); the strip keeps
  that stretch **one hour wide** (10 hours drawn at 1/10 scale) but **without the "×10" tag**, and Play never runs through it.
- Each hotspot plays a video **on top of the map**: **12:00** the villistas, **16:00** Natera, **17:00** the centre of Zacatecas, **19:00** La Bufa.
  Today only the Ángeles video exists: the other four are placeholders until their files are added.
- **11:00 and 18:00** are info only, no video, no hotspot. Chosen: they stay on the strip as a **small plain dot** (still a quick-jump point; the caption shows as the clock passes).
- An **optimized web version** of `Resolve/Exports/FelipeAngeles.mov` is part of the work.
- (Mine, not asked, kept small) a **Skip** button and Esc on every video, so a viewer is never trapped.

## Behaviour

| Moment | What happens |
|---|---|
| Play pressed with the clock in 00:00 to 10:00 | The intro video opens over the map. On its end or Skip: clock to 10:00, playing. |
| Clock (playing) reaches a hotspot with a video file | Clock pauses exactly at the hotspot's minute, the video opens. On its end or Skip: clock resumes from that minute, playing. |
| Click on a video tick | Clock goes to that minute and the video opens. On its end or Skip: the clock goes on playing if it was playing when clicked, else stays paused. |
| Click on an info tick, or on a hotspot with no file yet | Plain seek, as today. |
| Video fails to load or play | Treated as ended: the clock continues as above. |
| Intro file missing and Play pressed before 10:00 | The clock jumps to 10:00 and plays. |
| Play at the end of the day | Starts over at 00:00, so the intro plays again. |
| Space / arrows while a video is open | Space pauses and resumes the video; the arrows do nothing; Esc skips. |

Scrubbing, arrow-key stepping and the ×4 squeeze of 12:00 to 16:00 work as before; scrubbing never opens a video by itself (only playing across a hotspot, pressing Play, or clicking a video tick does).

## Data

- `TimelineEvent.video?: { id: string; resumeAt?: number }` (`src/timeline/model.ts`). `id` names a video; `resumeAt` (clock minutes) is where the clock goes
  when the video ends, **defaulting to the event's own time**. Only the intro sets it (10:00).
- `src/timeline/events.ts`:
  - `villa-advances` moves to **10:00** (events at 10:00 are written Natera, Villa, Ángeles, so the caption plate shows the cannon shot, the sourced beat); the Sierpe federals' answer starts at 10:00 too.
  - New first event `felipe-angeles`, 00:00, lane Ángeles, sourced: title "Felipe Ángeles" and a two-line text saying he commands the División del Norte's artillery, whose guns open the battle at 10:00. `video: { id: 'felipe-angeles', resumeAt: 10:00 }`.
  - `video` ids on `sierpe-taken` (`villistas`), `grillo-taken` (`natera`), `centro-taken` (`zacatecas-centro`), `bufa-taken` (`la-bufa`). None on the 10:00 trio, `angeles-advances` (11:00), `angeles-bombards-bufa` and `bufa-assault` (18:00).
  - The event times become 00:00, 10:00, 11:00, 12:00, 16:00, 17:00, 18:00, 19:00.
- `src/video/videos.ts`: `VIDEO_FILES: Record<string, { src: string; poster?: string }>` lists **the files that actually exist** (today `felipe-angeles` → `videos/felipe-angeles.mp4` + `.jpg`, resolved against `import.meta.env.BASE_URL`). `hotspotsOf(events, files)` returns, per event with a `video`: `{ eventId, videoId, time, resumeAt, file | null }`. A hotspot is **playable** when it has a file. Adding a video later is: optimize it, add one line here.

## Playback controller (`src/video/playback.ts`)

A small store like the clock (`subscribe`, `snapshot`, `usePlayback()`), built over a clock and a hotspot list so it can be tested with a fake clock. It owns "which video is open" (`current`: the hotspot, whether to resume playing, and a start token) and nothing else; the clock stays unaware of videos.

- `toggle()` — the Play button and Space: if a video is open do nothing here (the overlay handles keys); if the clock is playing, pause; otherwise `start()`.
- `start()` — from the clock's time (the start of the day if it is at the end): a hotspot whose window `time <= t < resumeAt` is non-empty (the intro) opens its video, or, with no file, seeks to `resumeAt` and plays; otherwise `clock.play()`.
- `afterTick(before, after)` — called by the `Director` every frame with the clock time around its tick: the first playable hotspot with `before < time <= after` pauses the clock, seeks to `time` and opens its video.
- `jump(time)` — a tick click: a playable hotspot at that time opens (resume = was playing), anything else is `clock.seek(time)`.
- `close()` — a video ended, was skipped or failed: clear `current`, `clock.seek(resumeAt)`, and `clock.play()` if it should resume.

Pure helpers (`stopCrossed(before, after, hotspots)`, `windowAt(t, hotspots)`) are tested on their own.

## Overlay (`src/video/VideoOverlay.tsx` + `src/ui/video.css`)

Mounted in `App` after `TimelineBar`; renders nothing unless a video is open. A scrim over everything (z above the timeline) dims the map; the video sits in a letterboxed 16:9 panel (widest that fits 92% of the width and 88% of the height) with a gold hairline in the app's ink-and-parchment style. Above the picture one line: the lane chip, the event's time and title (English, as the rest of the bar), and a **Skip** button (focused on open; Esc also skips). The `<video>` has `autoPlay`, `playsInline`, `poster`, sound on, no native controls; a click on it pauses and resumes; a small spinner shows until it can play. The source is set only when the overlay opens (**the video loads on the first Play**, as asked). If `play()` is refused for want of a gesture, a large play button appears over the picture. `ended` and `error` call `close()`. `role="dialog"`, `aria-modal`, focus returns to the Play button when it closes.

## Strip (`src/ui/TimelineBar.tsx`, `captions.ts`, `timeline.css`, `timeScale.ts`)

- Tick groups know whether any of their events has a `video` and whether it is playable. Video ticks: a larger gold ring with a play mark (hollow when the group is inferred, as today); a hotspot with no file yet looks the same but its tip says "video coming". Info ticks: a small solid dot.
- `SQUEEZES` gains an optional `tag`; only 12:00 to 16:00 has one ("×4") and only a tagged squeeze is hatched. 00:00 to 10:00 stays a ×10 squeeze **for the layout only** (one hour wide), untagged and unhatched.
- Play, Space and tick clicks go through `playback`; the arrow keys and Space are ignored while a video is open.

## Web video (`scripts/optimize-video.mjs`, `npm run optimize-video`)

The master `Resolve/Exports/FelipeAngeles.mov` is 1920×1080, 24 fps, 37 s, H.264 at 16 Mbps with 24-bit PCM audio and a timecode data track: 86 MB. The script (needs `ffmpeg` on the PATH) makes `public/videos/<name>.mp4` and `<name>.jpg` (a poster from the first frame):
H.264 High, yuv420p, scaled down only if taller than 1080, CRF 23 capped at about 5 Mbps, `-movflags +faststart` (starts playing before it is all downloaded), AAC 160 kbps stereo, the timecode track and metadata dropped. Expected size 15 to 20 MB. `buildArgs()` is pure and tested. The next four videos go through the same script.

## Out of scope

The other four videos themselves; warming the cache after the scene loads (a cheap follow-up if the first Play feels slow); subtitles or a Spanish title; touch gestures beyond tap; pausing the 3D loop while a video is open.

## Testing

- `events.test.ts`: 10:00 trio, new event times, the intro event and its `resumeAt`, which events carry a `video`, none at 11:00 or 18:00.
- `videos.test.ts`: `hotspotsOf` playable and placeholder cases; the files listed exist on disk.
- `playback.test.ts` (fake clock): the intro opens on Play before 10:00 and resumes at 10:00 running; crossing 12:00 while playing pauses at exactly 12:00 and resumes there; a tick click resumes only if it was playing; a hotspot with no file does nothing; a missing intro file jumps to 10:00; Play at the end restarts into the intro; `close()` on error resumes.
- `timeScale.test.ts`: the tag option; `optimize-video.test.mjs`: the argument list.
- By hand in the browser pane: first Play, Skip, the 17:00 placeholder staying inert, strip look at 1344×768.
