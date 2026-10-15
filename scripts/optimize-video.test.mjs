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
