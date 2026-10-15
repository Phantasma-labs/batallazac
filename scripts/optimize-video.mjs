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
