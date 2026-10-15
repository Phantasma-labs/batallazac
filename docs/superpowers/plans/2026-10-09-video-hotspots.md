# Video Hotspots on the Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Felipe Ángeles' film plays over the map on the first Play (00:00 to 10:00), four more strip ticks become video hotspots that pause the clock while their video plays, 10:00 starts all three armies together, and the master video gets an optimized web version.

**Architecture:** Events carry an optional `video` id. A small `src/video/videos.ts` lists the files that exist and the pure hotspot helpers; a playback controller (`src/video/playback.ts`, built over the clock like a store) owns "which video is open"; the `Director` tells it every frame what the clock crossed; a `VideoOverlay` component shows the video; the strip draws video ticks differently from info ticks. The clock itself stays unaware of videos.

**Tech Stack:** React 19, TypeScript (strict), vitest (node environment), Vite 8, three.js scene (untouched), ffmpeg on the PATH for the optimize script.

**Spec:** `docs/superpowers/specs/2026-10-09-video-hotspots-design.md` (read it first; the day's other rules are in `docs/superpowers/progress/HANDOFF.md`).

## Global Constraints

- Work in `L:\Projects\AIDocs_TomaZacatecas\app` (all commands run from there; the shell is Git Bash, `python` and `node` are available).
- **No git commits unless the user asks.** Nothing of the timeline work is committed (`git status` in `app/` lists about 90 changed paths); every task ends with a checkpoint (tests, typecheck) instead of a commit. `public/videos` is not git-ignored: leave `.gitignore` alone and mention the 15 to 20 MB file in the final report.
- Web video: H.264 High, `yuv420p`, scaled down only if taller than 1080, **CRF 23** capped at **5 Mbps** (`-maxrate 5M`), **`-movflags +faststart`**, **AAC 160 kbps stereo**, the timecode data track and global metadata dropped. Output `public/videos/<name>.mp4` and a poster `public/videos/<name>.jpg`; expected size 15 to 20 MB for the 86 MB master.
- Video URLs are **relative to the page** like every other asset (`videos/felipe-angeles.mp4`, `base: './'`), never absolute.
- The overlay stacks above the timeline: `.tl` is `z-index: 30`, the overlay is `40`.
- Event times after this plan: **00:00, 10:00, 11:00, 12:00, 16:00, 17:00, 18:00, 19:00**. No 10:05.
- Video hotspots: 00:00 `felipe-angeles` (resumes at 10:00), 12:00 `villistas`, 16:00 `natera`, 17:00 `zacatecas-centro`, 19:00 `la-bufa`. **No video** on 10:00, 11:00, 18:00. Only `felipe-angeles` has a file today; the other four are placeholders that show on the strip and do nothing.
- Windows is case-insensitive: new files here are `videos.ts`, `playback.ts`, `VideoOverlay.tsx`, `video.css`, `optimize-video.mjs`; none differs from another only by case.
- Keep to the code style around it (2-space indent, no semicolons, single quotes, `/** ... */` comments that say why).
- Landscape only, judged at 1344 x 768; the strip's sizes are in `--px`.

## Review Focus

The inputs and failure modes the spec implies but the happy-path tests would not hit, most likely first. Each has its test or check in the task named.

- **A video that 404s, cannot be decoded or stalls:** the viewer must not be stuck behind a dim screen; `error` is handled like `ended` (the clock resumes) — `close()` tested in Task 4, the overlay's `onError` checked by hand in Task 6.
- **The browser refuses to start a video with sound:** a big play button appears instead of a silent hang — checked in Task 6 (code path, `needsTap`).
- **Double input while a video is open** (Play, Space, a tick click, arrow keys, a hotspot crossed in the same frame): all ignored — Task 4 tests.
- **A hotspot the clock has just resumed from, or two hotspots inside one big frame:** the resumed one never re-opens, only the earliest crossed one opens — Tasks 3 and 4 tests.
- **Scrubbing back into 00:00 to 10:00 while the clock runs, or pressing Play at the end of the day:** scrubbing alone never opens the intro (Play does, also from 05:00), and Play at 19:30 starts over with the intro — Task 4 tests.

---

### Task 1: Events and model — 10:00 trio, the intro event, video ids

**Files:**
- Modify: `src/timeline/model.ts` (add `EventVideo`, `TimelineEvent.video`)
- Modify: `src/timeline/events.ts` (retime and reorder Villa's advance, new first event, `video` on four events, header comment)
- Test: `src/timeline/events.test.ts`

**Interfaces:**
- Produces: `export type EventVideo = { id: string; resumeAt?: number }` and `TimelineEvent.video?: EventVideo` in `src/timeline/model.ts`; events `felipe-angeles` (first, 00:00), and `video` on `sierpe-taken` (`villistas`), `grillo-taken` (`natera`), `centro-taken` (`zacatecas-centro`), `bufa-taken` (`la-bufa`). Tasks 3 and 5 read `event.video`.

- [ ] **Step 1: Write the failing tests**

Save this as `C:\Users\mail\AppData\Local\Temp\claude\L--Projects-AIDocs-TomaZacatecas\027aa1e4-2d8f-49f3-909b-548f190ffb1e\scratchpad\edit_events_tests.py` (shell heredocs mangle accented text; always write scripts with the Write tool, then run them) and run it with `python <that path>`:

```python
p = r'L:\Projects\AIDocs_TomaZacatecas\app\src\timeline\events.test.ts'
s = open(p, encoding='utf-8').read()


def rep(old, new):
    global s
    assert s.count(old) == 1, 'not found or not unique: ' + old[:80]
    s = s.replace(old, new)


rep("""import { TROOPS, TROOP_MODELS } from '../scene/troopModels'
""", """import { TROOPS, TROOP_MODELS } from '../scene/troopModels'
import { focusEvent } from '../ui/captions'
""")

rep("""  it('has the stops the user asked for: 10, 11, 12, 16, 17, 18 and 19 h', () => {
    const times = new Set(EVENTS.map((e) => e.time))
    for (const h of [10, 11, 12, 16, 17, 18, 19]) expect(times.has(hm(h)), `${h}:00`).toBe(true)
    // Nothing else but Villa's start five minutes after Ángeles'.
    expect([...times].sort((a, b) => a - b)).toEqual([hm(10), hm(10, 5), hm(11), hm(12), hm(16), hm(17), hm(18), hm(19)])
  })""", """  it('has the stops the user asked for: the film at 0 h, then 10, 11, 12, 16, 17, 18 and 19 h', () => {
    const times = new Set(EVENTS.map((e) => e.time))
    for (const h of [0, 10, 11, 12, 16, 17, 18, 19]) expect(times.has(hm(h)), `${h}:00`).toBe(true)
    // Nothing else: Ángeles, Villa and Natera all start at 10:00 (there is no 10:05).
    expect([...times].sort((a, b) => a - b)).toEqual([hm(0), hm(10), hm(11), hm(12), hm(16), hm(17), hm(18), hm(19)])
  })""")

rep("""  it('starts Ángeles a little before Villa, and Villa fires on La Sierpe the whole way there and until it falls', () => {
    expect(eventOf('villa-advances').time).toBe(hm(10, 5))""", """  it('starts the three armies together at 10:00, and the caption plate then shows the cannon shot', () => {
    for (const id of ['natera-opens-fire', 'villa-advances', 'angeles-opens-fire']) expect(eventOf(id).time, id).toBe(hm(10))
    // The latest event written at a minute is the one the plate shows: the sourced 10:00 cannon shot.
    expect(focusEvent(EVENTS, hm(10))?.id).toBe('angeles-opens-fire')
    expect(marchesOf('villa')[0].start).toBe(hm(10))
  })
  it('has Villa fire on La Sierpe the whole way there and until it falls', () => {
    expect(eventOf('villa-advances').time).toBe(hm(10))""")

rep("""  it('holds La Sierpe with federals who fire back at Villa from 10:05, and throws them back on El Grillo at noon', () => {""",
    """  it('holds La Sierpe with federals who fire back at Villa from 10:00, and throws them back on El Grillo at noon', () => {""")
rep("""    expect([fire.start, fire.endTime]).toEqual([hm(10, 5), hm(12)])""", """    expect([fire.start, fire.endTime]).toEqual([hm(10), hm(12)])""")

rep("""describe('soldiers on the board', () => {""", """describe('video hotspots', () => {
  const withVideo = EVENTS.filter((e) => e.video)
  it('opens the day with a film about Felipe Ángeles at 00:00 that hands over to 10:00', () => {
    const e = eventOf('felipe-angeles')
    expect(e.time).toBe(hm(0))
    expect(e.track).toBe('angeles')
    expect(e.video).toEqual({ id: 'felipe-angeles', resumeAt: hm(10) })
    expect(EVENTS[0].id).toBe('felipe-angeles')
  })
  it('puts a video on 12:00, 16:00, 17:00 and 19:00, and none on 10:00, 11:00 or 18:00', () => {
    expect(withVideo.map((e) => [e.time, e.video!.id])).toEqual([
      [hm(0), 'felipe-angeles'],
      [hm(12), 'villistas'],
      [hm(16), 'natera'],
      [hm(17), 'zacatecas-centro'],
      [hm(19), 'la-bufa'],
    ])
    for (const h of [10, 11, 18]) for (const e of EVENTS.filter((x) => x.time === hm(h))) expect(e.video, e.id).toBeUndefined()
  })
  it('resumes every video inside the day, never before it began', () => {
    for (const e of withVideo) {
      const at = e.video!.resumeAt ?? e.time
      expect(at, e.id).toBeGreaterThanOrEqual(e.time)
      expect(at, e.id).toBeLessThanOrEqual(DAY_END)
    }
  })
})

describe('soldiers on the board', () => {""")

open(p, 'w', encoding='utf-8').write(s)
print('ok')
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/timeline/events.test.ts`
Expected: FAIL (the `video` field and the 00:00 event do not exist yet, Villa is still at 10:05); TypeScript is not checked by vitest, so the failures are assertion failures.

- [ ] **Step 3: Add the type**

In `src/timeline/model.ts`, after the `Blast` type, add:

```ts
/**
 * A video the event is a hotspot for (the files that exist are listed in src/video/videos.ts): `id` names it, and `resumeAt` is the
 * clock minute the day carries on from once it has played, the event's own `time` when absent (the 00:00 film resumes at 10:00).
 */
export type EventVideo = { id: string; resumeAt?: number }
```

and in `TimelineEvent`, after `blasts?: Blast[]`, add `video?: EventVideo`.

- [ ] **Step 4: Change the events**

Save as `...\scratchpad\edit_events_video.py` and run with `python`:

```python
p = r'L:\Projects\AIDocs_TomaZacatecas\app\src\timeline\events.ts'
s = open(p, encoding='utf-8').read()


def rep(old, new):
    global s
    assert s.count(old) == 1, 'not found or not unique: ' + old[:80]
    s = s.replace(old, new)


# Villa's advance joins the other two at 10:00, and is written before the cannon shot so the caption plate shows the shot.
i_ang = s.index("  {\n    id: 'angeles-opens-fire',")
i_vil = s.index("  {\n    id: 'villa-advances',")
i_adv = s.index("  {\n    id: 'angeles-advances',")
assert i_ang < i_vil < i_adv
angeles = s[i_ang:i_vil]
villa = s[i_vil:i_adv]
s = s[:i_ang] + villa + angeles + s[i_adv:]
rep("    time: hm(10, 5),\n", "    time: hm(10),\n")

rep(""" * the south-west) opens fire on El Grillo, and Villa's column (in the north-west camp) fires on La Sierpe as it advances from
 * 10:05, the federals on the hill answering;""", """ * the south-west) opens fire on El Grillo, and Villa's column (in the north-west camp) fires on La Sierpe as it advances, all
 * three from 10:00, the federals on the hill answering;""")
rep("""the federal army only ever fires back (its attacks are flashes at the soldiers' rifles, no arrows).
 */""", """the federal army only ever fires back (its attacks are flashes at the soldiers' rifles, no arrows).
 *
 * An event with a `video` is a hotspot on the strip: the 00:00 film about Felipe Ángeles plays when Play is pressed before 10:00, and
 * the clock stops at 12:00, 16:00, 17:00 and 19:00 while their videos play (the files that exist are in src/video/videos.ts).
 * 10:00, 11:00 and 18:00 are information only.
 */""")

rep("""export const EVENTS: TimelineEvent[] = [
  {
    id: 'natera-opens-fire',""", """export const EVENTS: TimelineEvent[] = [
  {
    id: 'felipe-angeles',
    track: 'angeles',
    time: hm(0),
    title: { es: 'Felipe Ángeles', en: 'Felipe Ángeles' },
    text: {
      es: 'El general Felipe Ángeles manda la artillería de la División del Norte; sus cañones abrirán la batalla a las 10:00.',
      en: "General Felipe Ángeles commands the División del Norte's artillery; his guns will open the battle at 10:00.",
    },
    video: { id: 'felipe-angeles', resumeAt: hm(10) },
    source: 'sourced',
  },
  {
    id: 'natera-opens-fire',""")

rep("""    marches: [{ unit: 'fed-sierpe', path: ['sierpe-federales', 'grillo-sierpe'], endTime: hm(12, 30) }],
""", """    marches: [{ unit: 'fed-sierpe', path: ['sierpe-federales', 'grillo-sierpe'], endTime: hm(12, 30) }],
    video: { id: 'villistas' },
""")
rep("""    shot: 'elgrillo',
""", """    shot: 'elgrillo',
    video: { id: 'natera' },
""")
rep("""    shot: 'cathedral',
""", """    shot: 'cathedral',
    video: { id: 'zacatecas-centro' },
""")
rep("""    shot: 'labufa',
    marches: [
      { unit: 'fed-bufa', path: ['bufa-federales', 'salida-1'], endTime: hm(19, 30) },""", """    shot: 'labufa',
    video: { id: 'la-bufa' },
    marches: [
      { unit: 'fed-bufa', path: ['bufa-federales', 'salida-1'], endTime: hm(19, 30) },""")

open(p, 'w', encoding='utf-8').write(s)
print('ok')
```

- [ ] **Step 5: Run the tests and the typecheck**

Run: `npx vitest run src/timeline && npx tsc --noEmit`
Expected: all timeline tests PASS (the `events.test.ts` suite included), `tsc` prints nothing.

- [ ] **Step 6: Checkpoint**

Run: `npx vitest run`
Expected: every test file passes. (No commit: see Global Constraints.)

---

### Task 2: The web version of the video (optimize script and the first file)

**Files:**
- Create: `scripts/optimize-video.mjs`
- Create: `scripts/optimize-video.test.mjs`
- Modify: `package.json` (script `optimize-video`)
- Create (by running the script): `public/videos/felipe-angeles.mp4`, `public/videos/felipe-angeles.jpg`

**Interfaces:**
- Produces: `parseArgs(argv)`, `videoArgs(opts)`, `posterArgs(opts)`, `optimizeVideo(opts)` and `DEFAULTS` from `scripts/optimize-video.mjs`; the files `public/videos/felipe-angeles.mp4` and `.jpg`, which Task 3's test checks exist on disk and Task 6 plays.

- [ ] **Step 1: Write the failing test**

`scripts/optimize-video.test.mjs`:

```js
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULTS, optimizeVideo, parseArgs, posterArgs, videoArgs } from './optimize-video.mjs'

/** The argument that follows `flag` in an ffmpeg argument list. */
const after = (args, flag) => args[args.indexOf(flag) + 1]

describe('parseArgs', () => {
  it('reads the input, the name and the defaults', () => {
    expect(parseArgs(['master.mov', 'felipe-angeles'])).toEqual({ input: 'master.mov', name: 'felipe-angeles', ...DEFAULTS })
  })
  it('reads the options', () => {
    const o = parseArgs(['a.mov', 'x', '--crf', '20', '--maxrate', '8M', '--max-height', '720', '--poster-time', '3.5'])
    expect(o).toMatchObject({ crf: 20, maxrate: '8M', maxHeight: 720, posterTime: 3.5 })
  })
  it('refuses a missing name, an unknown option, a bad number or a bad name', () => {
    expect(() => parseArgs(['a.mov'])).toThrow(/usage/)
    expect(() => parseArgs(['a.mov', 'x', '--speed', '2'])).toThrow(/unknown option/)
    expect(() => parseArgs(['a.mov', 'x', '--crf', 'high'])).toThrow(/--crf/)
    expect(() => parseArgs(['a.mov', 'x', '--maxrate', 'fast'])).toThrow(/--maxrate/)
    expect(() => parseArgs(['a.mov', 'x', '--crf'])).toThrow(/needs a value/)
    expect(() => parseArgs(['a.mov', 'Bad Name'])).toThrow(/name/)
  })
})

describe('videoArgs', () => {
  const args = videoArgs({ input: 'in.mov', output: 'out.mp4', crf: 23, maxrate: '5M', maxHeight: 1080 })
  it('encodes H.264 High, 8-bit 4:2:0, at CRF 23 capped at 5 Mbps', () => {
    expect(after(args, '-c:v')).toBe('libx264')
    expect(after(args, '-profile:v')).toBe('high')
    expect(after(args, '-pix_fmt')).toBe('yuv420p')
    expect(after(args, '-crf')).toBe('23')
    expect(after(args, '-maxrate')).toBe('5M')
    expect(after(args, '-bufsize')).toBe('10M')
  })
  it('starts playing before the whole file has arrived (index at the front)', () => {
    expect(after(args, '-movflags')).toBe('+faststart')
  })
  it('keeps the first video and the first audio stream only, as AAC 160 kbps stereo, and drops the metadata', () => {
    expect(args.filter((a, i) => args[i - 1] === '-map')).toEqual(['0:v:0', '0:a:0?'])
    expect(after(args, '-c:a')).toBe('aac')
    expect(after(args, '-b:a')).toBe('160k')
    expect(after(args, '-ac')).toBe('2')
    expect(after(args, '-map_metadata')).toBe('-1')
  })
  it('scales down only if taller than the limit, keeping the width even', () => {
    expect(after(args, '-vf')).toBe("scale=-2:'min(1080,ih)'")
    expect(after(videoArgs({ input: 'a', output: 'b', crf: 23, maxrate: '5M', maxHeight: 720 }), '-vf')).toBe("scale=-2:'min(720,ih)'")
  })
  it('reads the input and ends with the output', () => {
    expect(after(args, '-i')).toBe('in.mov')
    expect(args.at(-1)).toBe('out.mp4')
    expect(args[0]).toBe('-y')
  })
})

describe('posterArgs', () => {
  it('takes one frame at the asked time, scaled like the video', () => {
    const args = posterArgs({ input: 'in.mov', output: 'out.jpg', posterTime: 2, maxHeight: 1080 })
    expect(after(args, '-ss')).toBe('2')
    expect(after(args, '-frames:v')).toBe('1')
    expect(after(args, '-vf')).toBe("scale=-2:'min(1080,ih)'")
    expect(args.at(-1)).toBe('out.jpg')
  })
})

describe('optimizeVideo', () => {
  let dir
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))
  it('runs ffmpeg for the video and for the poster, into <outDir>/<name>.mp4 and .jpg', () => {
    dir = mkdtempSync(join(tmpdir(), 'optimize-video-'))
    const calls = []
    const out = optimizeVideo({ input: 'in.mov', name: 'x', outDir: join(dir, 'videos'), run: (cmd, args) => calls.push([cmd, args]) })
    expect(out).toEqual({ video: join(dir, 'videos', 'x.mp4'), poster: join(dir, 'videos', 'x.jpg') })
    expect(calls.map(([cmd]) => cmd)).toEqual(['ffmpeg', 'ffmpeg'])
    expect(calls[0][1].at(-1)).toBe(out.video)
    expect(calls[1][1].at(-1)).toBe(out.poster)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run scripts/optimize-video.test.mjs`
Expected: FAIL, "Failed to resolve import ./optimize-video.mjs".

- [ ] **Step 3: Write the script**

`scripts/optimize-video.mjs`:

```js
import { execFileSync } from 'node:child_process'
import { mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const USAGE = 'usage: npm run optimize-video -- <master.mov> <name> [--crf 23] [--maxrate 5M] [--max-height 1080] [--poster-time 0]'

/** The web version: H.264 at CRF 23 capped at 5 Mbps, nothing taller than 1080, the poster from the first frame. */
export const DEFAULTS = { crf: 23, maxrate: '5M', maxHeight: 1080, posterTime: 0 }

const RATE = /^(\d+(?:\.\d+)?)([kKmM])$/
const OPTIONS = { '--crf': 'crf', '--maxrate': 'maxrate', '--max-height': 'maxHeight', '--poster-time': 'posterTime' }

/** `<input> <name>` and the options of `OPTIONS`, as an options object. Throws a readable error on anything else. */
export function parseArgs(argv) {
  const opts = { ...DEFAULTS }
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      positional.push(arg)
      continue
    }
    const key = OPTIONS[arg]
    if (!key) throw new Error(`unknown option ${arg}\n${USAGE}`)
    const value = argv[++i]
    if (value === undefined) throw new Error(`${arg} needs a value\n${USAGE}`)
    opts[key] = key === 'maxrate' ? value : Number(value)
    if (key === 'maxrate' ? !RATE.test(value) : !Number.isFinite(opts[key])) throw new Error(`bad value for ${arg}: ${value}`)
  }
  if (positional.length !== 2) throw new Error(USAGE)
  const [input, name] = positional
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`the name is lower-case letters, digits and dashes: ${name}`)
  return { input, name, ...opts }
}

/** Scales down to `maxHeight` only when the picture is taller, keeping the width even (H.264 needs it). */
const scale = (maxHeight) => `scale=-2:'min(${maxHeight},ih)'`

/** The ffmpeg arguments of the web video: one video and the first audio stream, no timecode track, the index at the front. */
export function videoArgs({ input, output, crf, maxrate, maxHeight }) {
  const [, amount, unit] = RATE.exec(maxrate)
  return [
    '-y', '-i', input,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', scale(maxHeight),
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', String(crf),
    '-maxrate', maxrate, '-bufsize', `${Number(amount) * 2}${unit}`, '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ac', '2',
    '-map_metadata', '-1',
    '-movflags', '+faststart',
    output,
  ]
}

/** The ffmpeg arguments of the poster: one frame at `posterTime` seconds. */
export function posterArgs({ input, output, posterTime, maxHeight }) {
  return ['-y', '-ss', String(posterTime), '-i', input, '-frames:v', '1', '-vf', scale(maxHeight), '-q:v', '3', output]
}

/** Makes `<outDir>/<name>.mp4` and `.jpg` from `input`. `run` is injectable so tests need no ffmpeg. */
export function optimizeVideo({
  input,
  name,
  outDir,
  crf = DEFAULTS.crf,
  maxrate = DEFAULTS.maxrate,
  maxHeight = DEFAULTS.maxHeight,
  posterTime = DEFAULTS.posterTime,
  run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' }),
}) {
  mkdirSync(outDir, { recursive: true })
  const video = join(outDir, `${name}.mp4`)
  const poster = join(outDir, `${name}.jpg`)
  run('ffmpeg', videoArgs({ input, output: video, crf, maxrate, maxHeight }))
  run('ffmpeg', posterArgs({ input, output: poster, posterTime, maxHeight }))
  return { video, poster }
}

const thisFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  const appRoot = resolve(dirname(thisFile), '..')
  try {
    const opts = parseArgs(process.argv.slice(2))
    // npm runs scripts from the package folder: a relative master path is the one typed in the folder the command was typed in.
    const input = resolve(process.env.INIT_CWD ?? process.cwd(), opts.input)
    const { video, poster } = optimizeVideo({ ...opts, input, outDir: join(appRoot, 'public', 'videos') })
    const mb = (path) => (statSync(path).size / 1e6).toFixed(1)
    console.log(`\n${video}  ${mb(video)} MB\n${poster}  ${mb(poster)} MB\nNow list it in VIDEO_FILES (src/video/videos.ts).`)
  } catch (err) {
    console.error(`optimize-video failed: ${err.message}`)
    process.exit(1)
  }
}
```

In `package.json`, in `"scripts"`, after the `"sync-assets"` line, add `"optimize-video": "node scripts/optimize-video.mjs",`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run scripts/optimize-video.test.mjs`
Expected: all PASS.

- [ ] **Step 5: Make the Felipe Ángeles web video**

Run (about one to two minutes): `npm run optimize-video -- ../Resolve/Exports/FelipeAngeles.mov felipe-angeles`
Expected: it ends printing both file paths with their sizes, the video between 8 and 30 MB.

- [ ] **Step 6: Check the result**

Run:

```bash
ffprobe -v error -show_entries format=duration,size:stream=codec_type,codec_name,profile,width,height,pix_fmt -of default=nw=1 public/videos/felipe-angeles.mp4
node -e "const b=require('fs').readFileSync('public/videos/felipe-angeles.mp4');const m=b.indexOf('moov'),d=b.indexOf('mdat');console.log(m>0&&m<d?'faststart ok':'NOT faststart')"
```

Expected: h264 `High` 1920x1080 `yuv420p`, one aac audio stream, no data stream, duration about 37.2 s, `faststart ok`. Then open `public/videos/felipe-angeles.jpg` with the Read tool: it must be a sensible first frame (not black is not required; it must be a valid picture).

- [ ] **Step 7: Checkpoint**

Run: `npx vitest run`
Expected: all test files pass.

---

### Task 3: The hotspot list and its pure helpers

**Files:**
- Create: `src/video/videos.ts`
- Test: `src/video/videos.test.ts`

**Interfaces:**
- Consumes: `EVENTS` (`src/timeline/events.ts`), `TimelineEvent` (`src/timeline/model.ts`, Task 1 added `video`), the files from Task 2.
- Produces (all from `src/video/videos.ts`):
  - `type VideoFile = { src: string; poster?: string }`
  - `const VIDEO_FILES: Record<string, VideoFile>`
  - `type Hotspot = { eventId: string; videoId: string; time: number; resumeAt: number; file: VideoFile | null }`
  - `hotspotsOf(events: readonly TimelineEvent[], files?: Readonly<Record<string, VideoFile>>): Hotspot[]`
  - `const HOTSPOTS: readonly Hotspot[]` (the real day)
  - `stopCrossed(before: number, after: number, hotspots: readonly Hotspot[]): Hotspot | null`
  - `windowAt(t: number, hotspots: readonly Hotspot[]): Hotspot | null`

- [ ] **Step 1: Write the failing test**

`src/video/videos.test.ts`:

```ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EVENTS } from '../timeline/events'
import { hm, type TimelineEvent } from '../timeline/model'
import { HOTSPOTS, VIDEO_FILES, hotspotsOf, stopCrossed, windowAt, type Hotspot, type VideoFile } from './videos'

const file: VideoFile = { src: 'videos/x.mp4' }
const hotspot = (time: number, f: VideoFile | null = file, resumeAt = time): Hotspot => ({ eventId: `e${time}`, videoId: `v${time}`, time, resumeAt, file: f })
const ev = (id: string, time: number, video?: TimelineEvent['video']): TimelineEvent => ({
  id,
  track: 'villa',
  time,
  title: { es: id, en: id },
  text: { es: '', en: '' },
  source: 'inferred',
  video,
})

describe('hotspotsOf', () => {
  it('makes one hotspot per event that names a video, resuming where the event says or at its own minute', () => {
    const spots = hotspotsOf([ev('a', 0, { id: 'one', resumeAt: 600 }), ev('b', 100), ev('c', 720, { id: 'two' })], { one: file, two: file })
    expect(spots).toEqual([
      { eventId: 'a', videoId: 'one', time: 0, resumeAt: 600, file },
      { eventId: 'c', videoId: 'two', time: 720, resumeAt: 720, file },
    ])
  })
  it('keeps a placeholder (no file yet) as a hotspot with no file, and never mistakes an object key for a file', () => {
    const [none, odd] = hotspotsOf([ev('a', 720, { id: 'missing' }), ev('b', 960, { id: 'constructor' })], {})
    expect(none.file).toBeNull()
    expect(odd.file).toBeNull()
  })
  it('in the real day: the film at 00:00 plays, the other four are placeholders until their files are listed', () => {
    expect(HOTSPOTS.map((h) => [h.time, h.resumeAt, h.videoId, h.file !== null])).toEqual([
      [hm(0), hm(10), 'felipe-angeles', true],
      [hm(12), hm(12), 'villistas', false],
      [hm(16), hm(16), 'natera', false],
      [hm(17), hm(17), 'zacatecas-centro', false],
      [hm(19), hm(19), 'la-bufa', false],
    ])
    expect(HOTSPOTS.map((h) => h.eventId)).toEqual(EVENTS.filter((e) => e.video).map((e) => e.id))
  })
  it('lists only files that exist in public/', () => {
    for (const [id, f] of Object.entries(VIDEO_FILES)) {
      expect(existsSync(join(process.cwd(), 'public', f.src)), `${id} video`).toBe(true)
      if (f.poster) expect(existsSync(join(process.cwd(), 'public', f.poster)), `${id} poster`).toBe(true)
    }
  })
})

describe('stopCrossed', () => {
  const spots = [hotspot(720), hotspot(960, null), hotspot(1020), hotspot(1140)]
  it('finds a playable hotspot the clock went past or reached, not one it started from', () => {
    expect(stopCrossed(700, 720, spots)?.time).toBe(720)
    expect(stopCrossed(700, 730, spots)?.time).toBe(720)
    expect(stopCrossed(720, 730, spots)).toBeNull()
  })
  it('opens only the earliest of several crossed in one big step', () => {
    expect(stopCrossed(0, 2000, spots)?.time).toBe(720)
    expect(stopCrossed(730, 2000, spots)?.time).toBe(1020)
  })
  it('skips placeholders and finds nothing in an empty or backwards step', () => {
    expect(stopCrossed(900, 1000, spots)).toBeNull()
    expect(stopCrossed(5, 5, spots)).toBeNull()
    expect(stopCrossed(800, 700, spots)).toBeNull()
    expect(stopCrossed(0, 10, [])).toBeNull()
  })
  it('never finds a hotspot at 00:00: nothing can cross the start of the day', () => {
    expect(stopCrossed(0, 100, [hotspot(0, file, 600)])).toBeNull()
    expect(stopCrossed(-1, 100, [hotspot(0, file, 600)])?.time).toBe(0)
  })
})

describe('windowAt', () => {
  const spots = [hotspot(0, file, 600), hotspot(720), hotspot(960, null, 960), hotspot(1100, null, 1130)]
  it('finds the film whose stretch the time is in, from its start up to where it resumes', () => {
    expect(windowAt(0, spots)?.time).toBe(0)
    expect(windowAt(300, spots)?.time).toBe(0)
    expect(windowAt(599.9, spots)?.time).toBe(0)
  })
  it('finds nothing at or after the resume point, nor at a hotspot that resumes where it plays', () => {
    expect(windowAt(600, spots)).toBeNull()
    expect(windowAt(720, spots)).toBeNull()
    expect(windowAt(960, spots)).toBeNull()
  })
  it('finds a stretch even when its file is missing (the caller then skips ahead)', () => {
    expect(windowAt(1110, spots)?.file).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/video/videos.test.ts`
Expected: FAIL, "Failed to resolve import ./videos".

- [ ] **Step 3: Write the module**

`src/video/videos.ts`:

```ts
import { EVENTS } from '../timeline/events'
import type { TimelineEvent } from '../timeline/model'

/** A video in public/, by path relative to the page (like the models), and its poster picture shown until it can play. */
export type VideoFile = { src: string; poster?: string }

/**
 * The videos that exist, by the id events name (`event.video.id`). A hotspot whose video is not listed here is a placeholder: it shows
 * on the strip and does nothing. To add one: `npm run optimize-video -- <master.mov> <id>`, then list `<id>` here.
 */
export const VIDEO_FILES: Record<string, VideoFile> = {
  'felipe-angeles': { src: 'videos/felipe-angeles.mp4', poster: 'videos/felipe-angeles.jpg' },
}

/**
 * An event with a video, seen from the playback side: when it is, where the clock goes once its video has played, and the file (null
 * for a placeholder).
 */
export type Hotspot = { eventId: string; videoId: string; time: number; resumeAt: number; file: VideoFile | null }

export function hotspotsOf(events: readonly TimelineEvent[], files: Readonly<Record<string, VideoFile>> = VIDEO_FILES): Hotspot[] {
  const out: Hotspot[] = []
  for (const e of events) {
    if (!e.video) continue
    out.push({
      eventId: e.id,
      videoId: e.video.id,
      time: e.time,
      resumeAt: e.video.resumeAt ?? e.time,
      file: Object.hasOwn(files, e.video.id) ? files[e.video.id] : null,
    })
  }
  return out
}

/** The hotspots of the day. */
export const HOTSPOTS: readonly Hotspot[] = hotspotsOf(EVENTS)

/**
 * The playable hotspot the clock went past or reached between `before` (not included: a clock that sets off from a hotspot does not meet
 * it again) and `after`, the earliest when a long frame crossed several; null when none.
 */
export function stopCrossed(before: number, after: number, hotspots: readonly Hotspot[]): Hotspot | null {
  let best: Hotspot | null = null
  for (const h of hotspots) if (h.file && h.time > before && h.time <= after && (!best || h.time < best.time)) best = h
  return best
}

/**
 * The hotspot whose stretch `time` is in, from its start up to (not including) where it resumes: Play pressed there opens it (the film
 * at 00:00 covers 00:00 to 10:00). Hotspots that resume where they play have an empty stretch. Placeholders count: the caller skips them.
 */
export function windowAt(time: number, hotspots: readonly Hotspot[]): Hotspot | null {
  return hotspots.find((h) => h.time <= time && time < h.resumeAt) ?? null
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run src/video && npx tsc --noEmit`
Expected: PASS, `tsc` prints nothing. (If the "lists only files that exist" test fails, Task 2's files are missing: redo its Step 5.)

- [ ] **Step 5: Checkpoint**

Run: `npx vitest run`
Expected: all pass.

---

### Task 4: The playback controller

**Files:**
- Create: `src/video/playback.ts`
- Test: `src/video/playback.test.ts`

**Interfaces:**
- Consumes: `createClock`, `clock`, `type Clock` (`src/timeline/clock.ts`: `time`, `playing`, `seek(minutes)`, `play()`, `pause()`, `tick(seconds)`), `DAY_END`, `DAY_START` (`src/timeline/model.ts`), `HOTSPOTS`, `stopCrossed`, `windowAt`, `type Hotspot` (Task 3).
- Produces (from `src/video/playback.ts`):
  - `type Open = { hotspot: Hotspot; resume: boolean; token: number }`
  - `createPlayback(clock: Clock, hotspots: readonly Hotspot[])` returning `{ current: Open | null; snapshot(): Open | null; subscribe(l): () => void; toggle(): void; afterTick(before: number, after: number): void; jump(time: number): void; close(): void }`
  - `const playback` (the app's, over the app's clock and `HOTSPOTS`) and `usePlayback(): Open | null` (React hook).
  - Tasks 5 and 6 call `playback.toggle()`, `playback.jump(time)`, `playback.afterTick(before, after)`, `playback.close()`, `playback.current`, `usePlayback()`.

- [ ] **Step 1: Write the failing tests**

`src/video/playback.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createClock } from '../timeline/clock'
import { DAY_END, hm } from '../timeline/model'
import { createPlayback } from './playback'
import type { Hotspot } from './videos'

const file = { src: 'videos/x.mp4' }
/** The film at 00:00 (resumes at 10:00), a video at noon and a placeholder at 16:00. */
const SPOTS: Hotspot[] = [
  { eventId: 'intro', videoId: 'intro', time: 0, resumeAt: hm(10), file },
  { eventId: 'noon', videoId: 'noon', time: hm(12), resumeAt: hm(12), file },
  { eventId: 'four', videoId: 'four', time: hm(16), resumeAt: hm(16), file: null },
]
const make = (start = 0, spots: readonly Hotspot[] = SPOTS) => {
  const clock = createClock(start)
  return { clock, playback: createPlayback(clock, spots) }
}
type Rig = ReturnType<typeof make>
/** One frame of the Director: tick the clock, then tell playback what it went across. */
const frame = ({ clock, playback }: Rig, seconds: number) => {
  const before = clock.time
  clock.tick(seconds)
  playback.afterTick(before, clock.time)
}

describe('the film at the start of the day', () => {
  it('opens when Play is pressed anywhere in 00:00 to 10:00, with the clock stopped', () => {
    const { clock, playback } = make()
    playback.toggle()
    expect(playback.current?.hotspot.videoId).toBe('intro')
    expect(playback.current?.resume).toBe(true)
    expect(clock.playing).toBe(false)
    expect(clock.time).toBe(0)
    const mid = make(hm(5))
    mid.playback.toggle()
    expect(mid.playback.current?.hotspot.videoId).toBe('intro')
  })
  it('hands over to 10:00 with the clock running when it ends or is skipped or fails (all close it)', () => {
    const { clock, playback } = make()
    playback.toggle()
    playback.close()
    expect(playback.current).toBeNull()
    expect(clock.time).toBe(hm(10))
    expect(clock.playing).toBe(true)
  })
  it('is not opened by scrubbing into its stretch, nor by the clock running through it', () => {
    const rig = make(hm(3))
    rig.clock.play()
    frame(rig, 1)
    expect(rig.playback.current).toBeNull()
    expect(rig.clock.playing).toBe(true)
  })
  it('is skipped to 10:00 when its file is missing', () => {
    const { clock, playback } = make(0, [{ ...SPOTS[0], file: null }, ...SPOTS.slice(1)])
    playback.toggle()
    expect(playback.current).toBeNull()
    expect(clock.time).toBe(hm(10))
    expect(clock.playing).toBe(true)
  })
  it('plays again when Play is pressed at the end of the day, which starts over', () => {
    const { clock, playback } = make()
    clock.seek(DAY_END)
    playback.toggle()
    expect(playback.current?.hotspot.videoId).toBe('intro')
    expect(clock.time).toBe(0)
  })
})

describe('Play and pause', () => {
  it('plays plainly from 10:00 on, and pauses when pressed while running', () => {
    const { clock, playback } = make(hm(10))
    playback.toggle()
    expect(playback.current).toBeNull()
    expect(clock.playing).toBe(true)
    playback.toggle()
    expect(clock.playing).toBe(false)
  })
})

describe('a hotspot the clock runs into', () => {
  it('stops exactly at its minute, opens its video, and carries on from there when it ends', () => {
    const rig = make(hm(11, 59))
    rig.clock.play()
    frame(rig, 1) // would reach 12:12
    expect(rig.playback.current?.hotspot.videoId).toBe('noon')
    expect(rig.clock.time).toBe(hm(12))
    expect(rig.clock.playing).toBe(false)
    rig.playback.close()
    expect(rig.clock.time).toBe(hm(12))
    expect(rig.clock.playing).toBe(true)
    frame(rig, 1)
    expect(rig.playback.current).toBeNull()
    expect(rig.clock.time).toBeGreaterThan(hm(12))
  })
  it('is ignored when it is a placeholder with no video yet', () => {
    const rig = make(hm(15, 59))
    rig.clock.play()
    frame(rig, 1)
    expect(rig.playback.current).toBeNull()
    expect(rig.clock.playing).toBe(true)
    expect(rig.clock.time).toBeGreaterThan(hm(16))
  })
})

describe('a click on a tick', () => {
  it('opens a video tick and afterwards leaves the clock as it was: stopped if it was stopped', () => {
    const { clock, playback } = make(hm(5))
    playback.jump(hm(12))
    expect(playback.current?.hotspot.videoId).toBe('noon')
    expect(playback.current?.resume).toBe(false)
    expect(clock.time).toBe(hm(12))
    playback.close()
    expect(clock.time).toBe(hm(12))
    expect(clock.playing).toBe(false)
  })
  it('keeps running afterwards if the clock was running', () => {
    const { clock, playback } = make(hm(11))
    clock.play()
    playback.jump(hm(12))
    expect(clock.playing).toBe(false)
    playback.close()
    expect(clock.playing).toBe(true)
  })
  it('only moves the clock for an info tick or a placeholder', () => {
    const { clock, playback } = make(hm(5))
    playback.jump(hm(11))
    expect(playback.current).toBeNull()
    expect(clock.time).toBe(hm(11))
    playback.jump(hm(16))
    expect(playback.current).toBeNull()
    expect(clock.time).toBe(hm(16))
  })
  it('opens the film from its own tick at 00:00', () => {
    const { clock, playback } = make(hm(11))
    playback.jump(0)
    expect(playback.current?.hotspot.videoId).toBe('intro')
    expect(clock.time).toBe(0)
    playback.close()
    expect(clock.time).toBe(hm(10))
  })
})

describe('while a video is open', () => {
  it('ignores Play, a tick click and the clock crossing another hotspot', () => {
    const rig = make(hm(5))
    rig.playback.jump(hm(12))
    const open = rig.playback.current
    rig.playback.toggle()
    rig.playback.jump(hm(11))
    rig.playback.jump(0)
    rig.playback.afterTick(hm(11), hm(13))
    expect(rig.playback.current).toBe(open)
    expect(rig.clock.time).toBe(hm(12))
    expect(rig.clock.playing).toBe(false)
  })
  it('does nothing when closed with nothing open', () => {
    const { clock, playback } = make(hm(11))
    playback.close()
    expect(clock.time).toBe(hm(11))
    expect(clock.playing).toBe(false)
  })
  it('gives each opening its own token, so the same video can run twice', () => {
    const { playback } = make(hm(5))
    playback.jump(hm(12))
    const first = playback.current!.token
    playback.close()
    playback.jump(hm(12))
    expect(playback.current!.token).not.toBe(first)
  })
})

describe('subscribers', () => {
  it('hear when a video opens and when it closes, and the snapshot is the open one', () => {
    const { playback } = make()
    const heard = vi.fn()
    const off = playback.subscribe(heard)
    playback.toggle()
    expect(heard).toHaveBeenCalledTimes(1)
    expect(playback.snapshot()).toBe(playback.current)
    playback.close()
    expect(heard).toHaveBeenCalledTimes(2)
    expect(playback.snapshot()).toBeNull()
    off()
    playback.jump(hm(12))
    expect(heard).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/video/playback.test.ts`
Expected: FAIL, "Failed to resolve import ./playback".

- [ ] **Step 3: Write the controller**

`src/video/playback.ts`:

```ts
import { useSyncExternalStore } from 'react'
import { clock as appClock, type Clock } from '../timeline/clock'
import { DAY_END, DAY_START } from '../timeline/model'
import { HOTSPOTS, stopCrossed, windowAt, type Hotspot } from './videos'

/**
 * The video that is open: its hotspot, whether the clock runs on when it ends, and a number that changes with every opening (so the
 * same video can be shown twice running).
 */
export type Open = { hotspot: Hotspot; resume: boolean; token: number }

/**
 * Which video is open over the map, and the rules for opening and closing it, over a clock (the clock itself knows nothing about
 * videos). The Director calls `afterTick` every frame; Play, Space and clicks on the strip go through `toggle` and `jump`; the overlay
 * calls `close` when the video ends, is skipped or fails. While a video is open everything else is ignored.
 */
export function createPlayback(clock: Clock, hotspots: readonly Hotspot[]) {
  let current: Open | null = null
  let tokens = 0
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  const show = (hotspot: Hotspot, resume: boolean) => {
    current = { hotspot, resume, token: ++tokens }
    emit()
  }

  /** Play from a stopped clock: the film of the stretch the clock is in (or a jump past it when it has no file), else just play. */
  const start = () => {
    if (clock.time >= DAY_END) clock.seek(DAY_START)
    const stretch = windowAt(clock.time, hotspots)
    if (!stretch) clock.play()
    else if (stretch.file) show(stretch, true)
    else {
      clock.seek(stretch.resumeAt)
      clock.play()
    }
  }

  return {
    get current() {
      return current
    },
    snapshot: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** The Play button and Space. */
    toggle() {
      if (current) return
      if (clock.playing) clock.pause()
      else start()
    },
    /** Called every frame with the clock's time before and after its tick: stops at a playable hotspot the tick went across. */
    afterTick(before: number, after: number) {
      if (current) return
      const hit = stopCrossed(before, after, hotspots)
      if (!hit) return
      clock.pause()
      clock.seek(hit.time)
      show(hit, true)
    },
    /** A click on the tick at `time`: its video if it has one (the clock then goes on as it was), else just a move of the clock. */
    jump(time: number) {
      if (current) return
      const hit = hotspots.find((h) => h.file && h.time === time)
      if (!hit) {
        clock.seek(time)
        return
      }
      const resume = clock.playing
      clock.pause()
      clock.seek(hit.time)
      show(hit, resume)
    },
    /** The video ended, was skipped or failed: the clock goes to where the hotspot resumes, and runs on if it should. */
    close() {
      const open = current
      if (!open) return
      current = null
      emit()
      clock.seek(open.hotspot.resumeAt)
      if (open.resume) clock.play()
    },
  }
}

/** The app's playback, over the app's clock and the day's hotspots. */
export const playback = createPlayback(appClock, HOTSPOTS)

/** The open video for React: re-renders when one opens or closes. */
export function usePlayback(): Open | null {
  return useSyncExternalStore(playback.subscribe, playback.snapshot)
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run src/video && npx tsc --noEmit`
Expected: PASS, `tsc` prints nothing.

- [ ] **Step 5: Checkpoint**

Run: `npx vitest run`
Expected: all pass.

---

### Task 5: The strip, the keys and the Director

**Files:**
- Modify: `src/timeline/timeScale.ts` (optional `tag` on a squeeze; only 12:00 to 16:00 has one)
- Modify: `src/ui/captions.ts` (`VideoKind`, `TickGroup.video`, `tickGroups(events, ready)`, `tickTip`)
- Modify: `src/ui/TimelineBar.tsx`, `src/ui/timeline.css`
- Modify: `src/timeline/Director.tsx`
- Test: `src/timeline/timeScale.test.ts`, `src/ui/captions.test.ts`

**Interfaces:**
- Consumes: `playback` (`toggle()`, `jump(time)`, `afterTick(before, after)`, `current`) from Task 4; `VIDEO_FILES` from Task 3; `EventVideo` events from Task 1.
- Produces: `Squeeze.tag?: string`; `type VideoKind = 'ready' | 'coming' | 'none'`; `TickGroup.video: VideoKind`; `tickGroups(events, ready?: (videoId: string) => boolean)`.

- [ ] **Step 1: Write the failing tests**

In `src/timeline/timeScale.test.ts`, replace the first test (`squeezes the hours before the first shot ...`) with:

```ts
  it('squeezes the stretch before the first shot (x10, laid out only) and 12:00 to 16:00 (x4, tagged) into one hour of bar each', () => {
    expect(SQUEEZES).toEqual([
      { from: hm(0), to: hm(10), factor: 10 },
      { from: hm(12), to: hm(16), factor: 4, tag: '×4' },
    ])
    expect(toBar(hm(10)) - toBar(hm(0))).toBe(60)
    expect(toBar(hm(16)) - toBar(hm(12))).toBe(60)
  })
  it('tags only the squeeze the clock plays through (00:00 to 10:00 is the film, so it has no tag)', () => {
    expect(SQUEEZES.filter((s) => s.tag).map((s) => s.tag)).toEqual(['×4'])
  })
```

At the end of `src/ui/captions.test.ts` append:

```ts
describe('tickGroups and videos', () => {
  const film = (id: string, time: number, videoId?: string) => ev(id, 'villa', time, videoId ? { video: { id: videoId } } : {})
  const ready = (id: string) => id === 'here'
  it('marks a tick with a video that exists as ready, one whose file is missing as coming, and the rest as none', () => {
    const groups = tickGroups([film('a', 100, 'here'), film('b', 200, 'later'), film('c', 300)], ready)
    expect(groups.map((g) => g.video)).toEqual(['ready', 'coming', 'none'])
  })
  it('has no video anywhere when nothing is said to be ready or planned', () => {
    expect(tickGroups([film('a', 100), film('b', 200)]).map((g) => g.video)).toEqual(['none', 'none'])
    expect(tickGroups([film('a', 100, 'x')]).map((g) => g.video)).toEqual(['coming'])
  })
  it('lets a ready video win over a planned one in the same minute, and a planned one over none', () => {
    expect(tickGroups([film('a', 100, 'later'), film('b', 100, 'here')], ready)[0].video).toBe('ready')
    expect(tickGroups([film('a', 100), film('b', 100, 'later')], ready)[0].video).toBe('coming')
    expect(tickGroups([film('a', 100, 'here'), film('b', 100)], ready)[0].video).toBe('ready')
  })
  it('says so in the tip', () => {
    const [r] = tickGroups([film('a', 100, 'here')], ready)
    const [c] = tickGroups([film('a', 100, 'later')], ready)
    expect(tickTip(r, '01:40')).toBe('01:40\na\n▶ Video')
    expect(tickTip(c, '01:40')).toBe('01:40\na\nVideo coming soon')
  })
  it('in the real day, makes the film at 00:00 ready and the info ticks plain', () => {
    const groups = tickGroups(EVENTS, (id) => id === 'felipe-angeles')
    expect(groups.map((g) => [g.time, g.video])).toEqual([
      [0, 'ready'],
      [600, 'none'],
      [660, 'none'],
      [720, 'coming'],
      [960, 'coming'],
      [1020, 'coming'],
      [1080, 'none'],
      [1140, 'coming'],
    ])
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/timeline/timeScale.test.ts src/ui/captions.test.ts`
Expected: FAIL (`tag` is missing from `SQUEEZES`, `tickGroups` returns no `video`).

- [ ] **Step 3: Tag the squeezes**

In `src/timeline/timeScale.ts` replace the `Squeeze` type and the `SQUEEZES` constant (with its doc comments) by:

```ts
/**
 * A stretch of the day that plays, and is drawn on the strip, `factor` times shorter than it is on the clock. A squeeze with a `tag`
 * is one the clock plays through at that speed: the strip hatches it and writes the tag over it.
 */
export type Squeeze = { from: number; to: number; factor: number; tag?: string }

/**
 * Where the day is squeezed (minutes after midnight): the stretch before the first shot, which is the film about Felipe Ángeles (the clock
 * does not play through it: Play shows the film, then goes to 10:00; the squeeze only keeps it one hour wide on the strip), and the long
 * middle of the day, between La Sierpe falling and the attack on El Grillo, when the lines hold and the clock does run faster. Each is one
 * hour of the strip.
 */
export const SQUEEZES: readonly Squeeze[] = [
  { from: hm(0), to: hm(10), factor: 10 },
  { from: hm(12), to: hm(16), factor: 4, tag: '×4' },
]
```

- [ ] **Step 4: Mark the ticks**

In `src/ui/captions.ts` replace everything from `/** Events that share a minute are one tick on the strip` to the end of the file with:

```ts
/** What a tick offers beyond its caption: a video that exists (`ready`), one that is planned but has no file yet (`coming`), or nothing (`none`). */
export type VideoKind = 'ready' | 'coming' | 'none'

/** Events that share a minute are one tick on the strip (they would sit on top of each other). */
export type TickGroup = { time: number; events: TimelineEvent[]; inferred: boolean; video: VideoKind }

/**
 * `inferred` is true only when every event in the group is: a tick is hollow only if nothing in it is sourced. `video` is the best of the
 * group's events (ready over coming over none); `ready` says whether the file of a video id exists.
 */
export function tickGroups(events: readonly TimelineEvent[], ready: (videoId: string) => boolean = () => false): TickGroup[] {
  const groups: TickGroup[] = []
  for (const e of events) {
    const video: VideoKind = !e.video ? 'none' : ready(e.video.id) ? 'ready' : 'coming'
    const g = groups.find((x) => x.time === e.time)
    if (g) {
      g.events.push(e)
      g.inferred = g.inferred && e.source === 'inferred'
      if (video === 'ready' || (video === 'coming' && g.video === 'none')) g.video = video
    } else groups.push({ time: e.time, events: [e], inferred: e.source === 'inferred', video })
  }
  return groups
}

/** The tooltip text of a tick: the time, then one line per event (inferred ones say so), then what its video is. */
export function tickTip(g: TickGroup, clockText: string): string {
  const lines = [clockText, ...g.events.map((e) => (e.source === 'inferred' ? `${e.title.en} (inferred)` : e.title.en))]
  if (g.video === 'ready') lines.push('▶ Video')
  if (g.video === 'coming') lines.push('Video coming soon')
  return lines.join('\n')
}
```

- [ ] **Step 5: Run the unit tests**

Run: `npx vitest run src/timeline src/ui && npx tsc --noEmit`
Expected: the new tests PASS; `tsc` will now report errors in `src/ui/TimelineBar.tsx` only if it used the changed signatures wrongly. It should still compile (the new `TickGroup.video` is only added).

- [ ] **Step 6: Wire the Director**

In `src/timeline/Director.tsx` add `import { playback } from '../video/playback'` after the `activeShotEvent` import, and replace `clock.tick(Math.min(delta, MAX_FRAME_DT))` by:

```tsx
    const before = clock.time
    clock.tick(Math.min(delta, MAX_FRAME_DT))
    // A playable hotspot the clock went across stops it there and opens its video.
    playback.afterTick(before, clock.time)
```

- [ ] **Step 7: Wire the strip**

In `src/ui/TimelineBar.tsx`:

1. After `import { captionText, ... } from './captions'` add:
   ```tsx
   import { playback } from '../video/playback'
   import { VIDEO_FILES } from '../video/videos'
   ```
2. Replace `const TICKS = tickGroups(EVENTS)` (and its comment line above) by:
   ```tsx
   // One lane: events that share a minute are one tick. A tick is a video hotspot when one of its events names a video, ready when the file exists.
   const TICKS = tickGroups(EVENTS, (id) => Object.hasOwn(VIDEO_FILES, id))
   ```
3. In the key handler `onKey`, first line inside the function: add `if (playback.current) return // a video is open: the overlay owns the keys`, and replace `clock.toggle()` there by `playback.toggle()`.
4. In the Play button replace `onClick={() => clock.toggle()}` by `onClick={() => playback.toggle()}`.
5. Replace the two squeeze renderings (`{SQUEEZES.map((s) => (<i key={s.from} className="tl-squeeze" .../>))}` in the lane, and the `<b>` ones in `.tl-hours`) so that only tagged squeezes draw: in the lane use `SQUEEZES.filter((s) => s.tag).map(...)` with the same `<i>`; in the hours use `SQUEEZES.filter((s) => s.tag).map(...)` with the same `<b>` but with `{s.tag}` instead of `×{s.factor}`.
6. Replace the tick `<button ...>` block by:
   ```tsx
   <button
     key={g.time}
     className={`tl-tick${g.video === 'none' ? ' is-info' : ' is-video'}${g.video === 'coming' ? ' is-coming' : ''}${g.inferred ? ' is-inferred' : ''}${isNow ? ' is-now is-focus' : ''}`}
     style={{ left: pct(g.time) }}
     data-tip={tickTip(g, formatClock(g.time))}
     aria-label={`${formatClock(g.time)} ${text}${g.inferred ? ' (inferred)' : ''}${g.video === 'ready' ? ' (video)' : g.video === 'coming' ? ' (video coming soon)' : ''}`}
     onClick={() => playback.jump(g.time)}
   >
     {g.video !== 'none' && <i className="tl-mark" aria-hidden />}
   </button>
   ```

In `src/ui/timeline.css`, right after the line `.tl-tick.is-inferred::before { background: var(--plate-solid); }` add:

```css
/* Video hotspots: a bigger ring with a play mark. Information-only ticks: a small plain dot. A video still to come is dimmer. */
.tl-tick.is-info::before { width: calc(8 * var(--px)); height: calc(8 * var(--px)); margin: calc(-4 * var(--px)) 0 0 calc(-4 * var(--px)); border-width: calc(1.5 * var(--px)); }
.tl-tick.is-video::before { width: calc(20 * var(--px)); height: calc(20 * var(--px)); margin: calc(-10 * var(--px)) 0 0 calc(-10 * var(--px)); }
.tl-tick.is-coming::before { opacity: 0.55; }
.tl-mark { position: absolute; left: 50%; top: 50%; width: 0; height: 0; margin: calc(-5 * var(--px)) 0 0 calc(-3 * var(--px)); border-style: solid; border-width: calc(5 * var(--px)) 0 calc(5 * var(--px)) calc(8 * var(--px)); border-color: transparent transparent transparent var(--ink); pointer-events: none; }
.tl-tick.is-inferred .tl-mark { border-left-color: var(--lane); }
.tl-tick.is-coming .tl-mark { opacity: 0.55; }
```

- [ ] **Step 8: Typecheck, test, and look at the strip**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both clean.

Then in the browser pane (`navigate` to `http://localhost:5173/`; the dev server is the user's own on 5173; wait about 30 s for the models, take a small screenshot first to force a paint): take a screenshot and `read_page` the strip. Expected: a gold ring with a play mark at the far left (00:00), small plain dots at 10:00, 11:00 and 18:00, dimmer rings with a play mark at 12:00, 16:00, 17:00 and 19:00, the "×4" tag between 12:00 and 16:00 and **no** "×10" tag and no hatching over 00:00 to 10:00. If it looks wrong, fix the CSS before going on.

- [ ] **Step 9: Checkpoint**

Run: `npx vitest run`
Expected: all pass.

---

### Task 6: The video overlay, the first real run, and the notes

**Files:**
- Create: `src/video/VideoOverlay.tsx`, `src/ui/video.css`
- Modify: `src/App.tsx`
- Modify: `docs/superpowers/progress/HANDOFF.md`, the spec's status line, memory file `timeline-feature.md`

**Interfaces:**
- Consumes: `playback`, `usePlayback()`, `type Open` (Task 4); `EVENTS`; `formatClock`; `laneOf` (`src/ui/captions.ts`); the file `videos/felipe-angeles.mp4` (Task 2).
- Produces: `VideoOverlay` (no props), mounted in `App`.

- [ ] **Step 1: Write the component**

`src/video/VideoOverlay.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { EVENTS } from '../timeline/events'
import { formatClock } from '../timeline/model'
import { laneOf } from '../ui/captions'
import { playback, usePlayback, type Open } from './playback'
import '../ui/video.css'

/** The video that is open (see `playback`), over the map: a dimmed screen, the film in a letterboxed panel, and a way out. */
export function VideoOverlay() {
  const open = usePlayback()
  // A new key per opening: the same video shown twice running starts again from its first frame.
  return open?.hotspot.file ? <Player key={open.token} open={open} /> : null
}

function Player({ open }: { open: Open }) {
  const file = open.hotspot.file!
  const event = EVENTS.find((e) => e.id === open.hotspot.eventId)!
  const panel = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [paused, setPaused] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)

  const toggle = () => {
    const v = video.current
    if (!v) return
    if (v.paused) v.play().catch(() => setNeedsTap(true))
    else v.pause()
  }

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null
    panel.current?.focus()
    // Sound is on: the browser may refuse to start it without a gesture, and then a big play button asks for one.
    video.current?.play().catch(() => setNeedsTap(true))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        playback.close()
      } else if (e.code === 'Space' && (e.target as HTMLElement | null)?.tagName !== 'BUTTON') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      back?.focus?.()
    }
  }, [])

  return (
    <div className="vo" role="dialog" aria-modal="true" aria-label={event.title.en}>
      <div className="vo-panel" ref={panel} tabIndex={-1}>
        <div className="vo-head">
          <span className={`vo-chip is-${event.track}`}>{laneOf(event.track).name}</span>
          <time>{formatClock(event.time)}</time>
          <span className="vo-title">{event.title.en}</span>
          <button className="vo-skip" onClick={() => playback.close()}>
            Skip <kbd>Esc</kbd>
          </button>
        </div>
        <div className="vo-stage">
          <video
            ref={video}
            className="vo-video"
            src={file.src}
            poster={file.poster}
            playsInline
            preload="auto"
            onCanPlay={() => setReady(true)}
            onWaiting={() => setReady(false)}
            onPlaying={() => {
              setReady(true)
              setPaused(false)
              setNeedsTap(false)
            }}
            onPause={() => setPaused(true)}
            onEnded={() => playback.close()}
            onError={() => playback.close()}
            onClick={toggle}
          />
          {!ready && !needsTap && <div className="vo-spin" role="status" aria-label="Loading video" />}
          {(needsTap || paused) && (
            <button className="vo-big" onClick={toggle} aria-label="Play video">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M7 3.5v17l14-8.5z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

`src/ui/video.css`:

```css
/* The video over the map: a dimmed screen above the timeline (.tl is 30), the film in a letterboxed panel. */
.vo {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  color: var(--paper);
  font-family: var(--sans);
  background: rgba(12, 8, 4, 0.84);
  backdrop-filter: blur(3px);
}
/* The widest 16:9 picture that fits 92% of the width and 88% of the height, with the 52px header above it. */
.vo-panel {
  width: min(92vw, calc((88vh - 52px) * 16 / 9));
  overflow: hidden;
  outline: none;
  background: #0c0804;
  border: 1px solid rgba(242, 180, 65, 0.6);
  border-radius: 6px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.65);
}
.vo-head { display: flex; align-items: center; gap: 12px; height: 52px; padding: 0 14px; box-sizing: border-box; }
.vo-head time { font: 600 14px/1 var(--sans); font-variant-numeric: tabular-nums; color: var(--paper-dim); }
.vo-chip { padding: 3px 9px; font: 700 12px/1.2 var(--sans); letter-spacing: 0.06em; text-transform: uppercase; border-radius: 3px; }
.vo-chip.is-angeles { background: var(--gold); color: var(--ink); }
.vo-chip.is-villa { background: #c23a2d; color: #fff7ea; }
.vo-chip.is-federal { background: #3f6fb2; color: #f4f8ff; }
.vo-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 20px/1.1 var(--serif); }
.vo-skip {
  padding: 6px 12px;
  font: 600 14px/1 var(--sans);
  color: var(--paper);
  cursor: pointer;
  background: rgba(243, 233, 210, 0.08);
  border: 1px solid rgba(243, 233, 210, 0.35);
  border-radius: 4px;
}
.vo-skip:hover { background: rgba(243, 233, 210, 0.18); }
.vo-skip:focus-visible, .vo-big:focus-visible { outline: 2px solid #fffaf0; outline-offset: 2px; }
.vo-skip kbd { margin-left: 6px; font: 600 11px var(--sans); opacity: 0.7; }
.vo-stage { position: relative; aspect-ratio: 16 / 9; background: #000; }
.vo-video { display: block; width: 100%; height: 100%; object-fit: contain; cursor: pointer; }
.vo-spin {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 38px;
  height: 38px;
  margin: -19px 0 0 -19px;
  border: 3px solid rgba(243, 233, 210, 0.25);
  border-top-color: var(--gold);
  border-radius: 50%;
  animation: vo-spin 0.9s linear infinite;
  pointer-events: none;
}
@keyframes vo-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .vo-spin { animation-duration: 3s; } }
.vo-big {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  margin: -38px 0 0 -38px;
  padding: 0;
  cursor: pointer;
  background: var(--gold);
  border: 0;
  border-radius: 50%;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.5);
}
.vo-big svg { width: 30px; height: 30px; margin-left: 4px; fill: var(--ink); }
```

In `src/App.tsx` add `import { VideoOverlay } from './video/VideoOverlay'` and `<VideoOverlay />` right after `<TimelineBar />`.

- [ ] **Step 2: Typecheck and test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean, all pass.

- [ ] **Step 3: First real run in the browser pane**

The pane is hidden, so requestAnimationFrame does not run; drive frames by hand (see HANDOFF "How to drive and verify"). Reload `http://localhost:5173/`, force a paint with a small screenshot, wait for `window.__map`, then define `window.__drive` as the handoff says. Also define a helper that runs frames without moving the clock: `window.__run = async (n = 120) => { for (let i = 0; i < n; i++) { await new Promise(r => setTimeout(r, 16)); window.__map.advance(performance.now()) } }`. Then check, in this order:

1. **Play opens the film.** Click the Play button (`find` "Play", `computer left_click` with its ref). Expected: `document.querySelector('.vo')` exists, `document.querySelector('video').src` ends with `videos/felipe-angeles.mp4`, the header reads "Ángeles 00:00 Felipe Ángeles" with a Skip button; `window.__map.clock.time === 0` and `window.__map.clock.playing === false`. Take a screenshot (two: it lags a step) and look at it: dimmed map behind a letterboxed panel.
2. **It plays.** After a few seconds `video.readyState >= 3`, `video.duration` about 37.2, `video.currentTime > 0` (if the hidden pane will not run media, say so and verify the rest with the video element's `currentTime` set by hand).
3. **Its end returns to the map at 10:00, running.** Run `const v = document.querySelector('video'); v.currentTime = v.duration - 0.3`, wait two seconds. Expected: `.vo` is gone, `window.__map.clock.time === 600`, `window.__map.clock.playing === true`. Then `await window.__drive(600, 30)` and check the plate says 10:00 and the guns, Villa and Natera all show activity (arrows to Bufa and Sierpe and El Grillo).
4. **Skip and Esc.** Press Play after `__map.clock.seek(0); __map.clock.pause()`: the film opens again; click Skip: back at 10:00 running. Repeat and press Esc: same. While the film is open press Space: the video pauses and a big play button shows; Space again: it resumes. Arrow keys do nothing.
5. **Placeholders are inert.** `window.__map.clock.seek(719); window.__map.clock.play(); await window.__run(200)`. Expected: `clock.time` is past 12:00 (720), no overlay, the clock still running.
6. **A real crossing, temporarily.** Temporarily add `villistas: { src: 'videos/felipe-angeles.mp4' },` to `VIDEO_FILES` in `src/video/videos.ts`, reload, and repeat check 5 (`__run`). Expected: the clock stops at exactly 12:00 (`clock.time === 720`), the overlay shows "Villa 12:00 Cerro de la Sierpe falls", and after Skip the clock is at 12:00 and running. Click the 12:00 tick while paused: it opens, and after Skip the clock is still paused at 12:00. **Remove the temporary line again.**
7. **A broken video is skipped.** Temporarily change the `felipe-angeles` `src` to `videos/missing.mp4`, reload, press Play. Expected: the overlay vanishes within a second or two and the clock is at 10:00 and running. **Restore the real path.**
8. **Sound refused.** Before pressing Play run `HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('no gesture', 'NotAllowedError'))` (reload afterwards to undo it). Expected: the overlay opens with a **big gold play button** over the picture and no spinner; the page does not hang.
9. **No console errors** (`read_console_messages` with `onlyErrors`).

If any check fails, fix the cause (the tests in Tasks 3 and 4 say what the rules are) before going on. Restore every temporary edit and confirm with `git diff --stat src/video/videos.ts` that `VIDEO_FILES` lists only `felipe-angeles` with its real paths (the file is untracked, so instead re-read it).

- [ ] **Step 4: Full checks**

Run:

```bash
npx tsc --noEmit && echo TSC-OK
npx vitest run
npx vite build --outDir "C:/Users/mail/AppData/Local/Temp/claude/L--Projects-AIDocs-TomaZacatecas/027aa1e4-2d8f-49f3-909b-548f190ffb1e/scratchpad/dist-check" --emptyOutDir
```

Expected: `TSC-OK`, every test passes, the build succeeds (the chunk-size warning is old) and `dist-check/videos/felipe-angeles.mp4` exists.

- [ ] **Step 5: Notes**

1. `docs/superpowers/progress/HANDOFF.md`: in "What exists and works" change the clock/bar bullets for the 00:00 film (Play before 10:00 opens it; the strip's 00:00 to 10:00 is one hour wide, untagged), the day section (**10:00** now holds Ángeles' guns, Villa's advance and Natera together, **no 10:05**; the 12:00 Villa arrival text becomes "10:00 to 12:00"), and add a section **Video hotspots** with: the file map (`src/video/videos.ts` the list of files that exist and the pure helpers, `playback.ts` the controller, `VideoOverlay.tsx` + `ui/video.css`, `Director` calls `playback.afterTick`, `scripts/optimize-video.mjs`), the behaviour table from the spec in one short paragraph, **how to add a video** (`npm run optimize-video -- <master.mov> <id>`, where the ids are `villistas`, `natera`, `zacatecas-centro`, `la-bufa`, then one line in `VIDEO_FILES`), the test count, and the open item that `public/videos` is not git-ignored (about 15 to 20 MB). Fix the "380/398 tests" sentence to the real count from Step 4.
2. `docs/superpowers/specs/2026-10-09-video-hotspots-design.md`: change the status line to "built (2026-10-09); see HANDOFF.md".
3. Update the memory file `C:\Users\mail\.claude\projects\L--Projects-AIDocs-TomaZacatecas\memory\timeline-feature.md` (edit in place: description, a "Later" paragraph for the video work, the 10:00 trio, the real test count) and its one-line entry in `MEMORY.md`.

- [ ] **Step 6: Checkpoint**

Run: `npx vitest run`
Expected: all pass. Tell the user what was built, what was and was not verified (hidden-pane limits), that nothing is committed, and the size of `public/videos/felipe-angeles.mp4`.
