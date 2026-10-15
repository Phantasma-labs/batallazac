import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Quaternion, Raycaster, Vector2, Vector3, type PerspectiveCamera } from 'three'
import { DEPTH_OF_FIELD, macroAmount, macroLook } from '../scene/macro'
import { useBoard } from '../scene/useBoard'
import { clock } from '../timeline/clock'
import { toBar } from '../timeline/timeScale'
import { cameraBus } from './bus'
import { useFramedPoints } from './framing'
import {
  EAST_CROP,
  FOCUS_SECONDS,
  aimQuaternion,
  easeInOut,
  lerpFov,
  lockedRig,
  pickHotspot,
  wideShot,
} from './locked'
import { manual } from './manual'
import { cameraSource, centreFocusDistance, poseAngles, poseQuaternion, type ManualShot, type Shots } from './manualShots'
import { MAX_FRAME_DT, cropEast, rimOf, type Bounds, type Vec3 } from './math'
import { zoomFromSearch } from './mode'
import { shot } from './shot'
import { solveShot, type SolvedShot } from './shots'
import { FOLLOW_SECONDS, buildTrack, followFactor, trackKeys } from './track'

/** Zooming onto hotspots is off for now (the animated map is shown whole); `?zoom=on` brings it back. See `zoomFromSearch`. */
const ZOOM = zoomFromSearch(window.location.search)

/**
 * A tripod camera. Clicking a hotspot turns it (with a slight roll) and zooms the lens onto that spot; clicking elsewhere
 * or pressing Esc turns it back to the wide shot. The wide shot fits the board with the lens, so the window shape never
 * moves the camera either. A shot may name its own camera position (see `BAKED` in shots.ts), and then the camera
 * glides there; unless it does, the camera stays on the tripod. The timeline director moves the camera through `cameraBus`.
 *
 * The hand-placed shots (`manualShots.ts`, placed with the dev panel) beat all of that. They are keyframes: the camera holds the
 * shot being edited, and otherwise flows through the wide shot and the placed shots with the clock (`track.ts`), always moving
 * from one to the next, and settling on the pose the clock asks for when the clock jumps. Without a shot it is wide.
 */
export function LockedCamera({ bounds }: { bounds: Bounds }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get)

  const mustSee = useFramedPoints()
  const { hotspots, shots: shotHotspots } = useBoard()

  // The opening view leaves the east of the board out; the shots below frame this part.
  const view = useMemo(() => cropEast(bounds, EAST_CROP), [bounds])

  const rig = useMemo(() => lockedRig(view, mustSee), [view, mustSee])

  // A focused shot depends on the window shape (the lens fits the hotspot, and the aim keeps the frame on the board),
  // so it is solved when the aspect or the wide lens changes, not every frame.
  const shots = useMemo(() => new Map<string, { aspect: number; wideFov: number } & SolvedShot>(), [rig, bounds, shotHotspots])
  const shotFor = useCallback(
    (id: string, aspect: number, wideFov: number) => {
      let s = shots.get(id)
      if (!s || s.aspect !== aspect || s.wideFov !== wideFov) {
        s = { aspect, wideFov, ...solveShot(rig.position, shotHotspots.get(id)!, aspect, wideFov, bounds) }
        shots.set(id, s)
      }
      return s
    },
    [shots, rig, bounds, shotHotspots],
  )

  // The wide shot depends on the window shape, so it is solved when the aspect changes, not every frame.
  const wide = useRef({ aspect: NaN, fov: 0, distance: 0, quat: new Quaternion() })
  const wideFor = useCallback(
    (aspect: number) => {
      const w = wide.current
      if (w.aspect !== aspect) {
        const wideView = wideShot(view, rig.position, aspect, mustSee)
        w.aspect = aspect
        w.fov = wideView.fov
        w.distance = distanceBetween(rig.position, wideView.target)
        w.quat.copy(aimQuaternion(rig.position, wideView.target, 0))
      }
      return w
    },
    [view, rig, mustSee],
  )

  const focused = useRef<string | null>(null)
  // The shot being left, and how far through the move to the current one we are (1 = arrived).
  const move = useRef({
    t: 1,
    fromQuat: new Quaternion(),
    fromPos: new Vector3(),
    fromFov: camera.fov,
    fromDistance: shot.focusDistance,
    fromBlur: shot.blur,
    fromRange: shot.range,
  })
  // What the camera follows ('wide', 'track' or 'edit:<time>'), the hand-placed pose it is on (null = none) and its orientation
  // (worked out when the pose changes), and the keyframe curve (rebuilt when the shots or the window shape change, not every frame).
  const placed = useRef<{
    id: string
    shot: ManualShot | null
    quat: Quaternion
    track: { shots: Shots | null; aspect: number; rig: unknown; at: ((bar: number) => ManualShot) | null }
  }>({ id: '', shot: null, quat: new Quaternion(), track: { shots: null, aspect: NaN, rig: null, at: null } })

  // Start a move from wherever the lens is right now, so a click or a new shot mid-move turns smoothly instead of snapping.
  const beginMove = useCallback(() => {
    const m = move.current
    m.fromQuat.copy(camera.quaternion)
    m.fromPos.copy(camera.position)
    m.fromFov = camera.fov
    m.fromDistance = shot.focusDistance
    m.fromBlur = shot.blur
    m.fromRange = shot.range
    m.t = 0
  }, [camera])

  const focusOn = useCallback(
    (id: string | null) => {
      if (id === focused.current || (id !== null && !shotHotspots.has(id))) return
      if (id !== null && !ZOOM) return // no zooming onto a hotspot or an event's shot while the zoom is off
      focused.current = id
      beginMove()
    },
    [beginMove, shotHotspots],
  )

  useLayoutEffect(() => {
    focused.current = null
    move.current.t = 1
    wide.current.aspect = NaN // the shot is stale whenever the board, the rig or the compass changed
    const w = wideFor(camera.aspect)
    camera.position.set(rig.position.x, rig.position.y, rig.position.z)
    camera.quaternion.copy(w.quat)
    camera.fov = w.fov
    camera.updateProjectionMatrix()
    shot.fov = shot.wideFov = w.fov
    shot.focusDistance = move.current.fromDistance = w.distance
    shot.blur = move.current.fromBlur = 0
    shot.range = move.current.fromRange = DEPTH_OF_FIELD.focusRange
    placed.current.id = '' // the hand-placed pose and the keyframe curve are stale too: the next frame picks them up again
    placed.current.track.shots = null
    cameraBus.focus = focusOn
    // For the dev panel: the pose the camera has now, as a shot, and how far the middle of the frame is (the ground at rim height).
    const readPose = (): ManualShot => ({
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      ...poseAngles(camera.quaternion),
      fovDeg: camera.fov,
      dof: { focusDistance: shot.focusDistance, blur: shot.blur, range: shot.range },
    })
    const centreDistance = () => centreFocusDistance(camera.position, camera.quaternion, rimOf(bounds))
    cameraBus.readPose = readPose
    cameraBus.centreDistance = centreDistance
    // Dev-only hook for manual checks; `advance` steps the frame loop when the tab is not being painted.
    if (import.meta.env.DEV) Object.assign(window, { __map: { camera, bounds, view, advance: get().advance, focus: focusOn, mode: 'locked', three: get, clock, bus: cameraBus, manual } })
    return () => {
      if (cameraBus.focus === focusOn) cameraBus.focus = null
      if (cameraBus.readPose === readPose) cameraBus.readPose = null
      if (cameraBus.centreDistance === centreDistance) cameraBus.centreDistance = null
    }
  }, [camera, rig, bounds, view, get, focusOn, wideFor])

  useEffect(() => {
    const el = gl.domElement
    const raycaster = new Raycaster()
    const ndc = new Vector2()
    const pick = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))
      raycaster.setFromCamera(ndc, camera)
      return pickHotspot(raycaster.ray, hotspots)
    }
    // The viewer taking the camera pauses the timeline and stops the director until they play or scrub again.
    const onClick = (e: MouseEvent) => {
      if (!ZOOM) return
      const id = pick(e)
      if (id !== null) clock.pause()
      cameraBus.directorOn = false
      focusOn(id)
    }
    const onMove = (e: MouseEvent) => {
      el.style.cursor = ZOOM && pick(e) ? 'pointer' : ''
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (e.target as HTMLElement | null)?.tagName !== 'INPUT') {
        cameraBus.directorOn = false
        manual.stopEditing()
        focusOn(null)
      }
    }
    el.addEventListener('click', onClick)
    el.addEventListener('pointermove', onMove)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('click', onClick)
      el.removeEventListener('pointermove', onMove)
      window.removeEventListener('keydown', onKey)
      el.style.cursor = ''
    }
  }, [gl, camera, focusOn, hotspots])

  useFrame((_, delta) => {
    const m = move.current
    // Resizing the window changes the aspect, which re-fits the wide shot.
    const w = wideFor(camera.aspect)

    // The hand-placed shots win. Changing what the camera follows (the wide shot, a shot held for editing, the keyframes) starts a glide.
    const state = manual.snapshot()
    const p = placed.current
    const source = cameraSource(state.shots, state.editing, cameraBus.directorOn)
    const id = source.kind === 'edit' ? `edit:${source.key}` : source.kind
    if (id !== p.id) {
      p.id = id
      beginMove()
    }
    let hand: ManualShot | null = null
    if (source.kind === 'edit') hand = state.shots[source.key]!
    else if (source.kind === 'track') {
      const tr = p.track
      if (tr.shots !== state.shots || tr.aspect !== camera.aspect || tr.rig !== rig) {
        // The keyframes: the wide shot at the start of the day, then each placed shot, on the bar's time (the squeezed hours are short there).
        const wideKey: ManualShot = {
          position: { ...rig.position },
          ...poseAngles(w.quat),
          fovDeg: w.fov,
          dof: { focusDistance: w.distance, blur: 0, range: DEPTH_OF_FIELD.focusRange },
        }
        tr.shots = state.shots
        tr.aspect = camera.aspect
        tr.rig = rig
        tr.at = buildTrack(trackKeys(wideKey, state.shots, toBar))
      }
      hand = tr.at!(toBar(clock.time))
    }
    if (hand !== p.shot) {
      p.shot = hand
      if (hand) poseQuaternion(hand.yawDeg, hand.pitchDeg, hand.rollDeg, p.quat)
    }

    const focusShot = !hand && focused.current ? shotFor(focused.current, camera.aspect, w.fov) : null
    const toFov = hand ? hand.fovDeg : focusShot ? focusShot.fov : w.fov
    const toQuat = hand ? p.quat : focusShot ? focusShot.quat : w.quat
    const toPos = hand ? hand.position : focusShot ? focusShot.position : rig.position
    const toDistance = hand ? hand.dof.focusDistance : focusShot ? focusShot.distance : w.distance
    // Without a hand-placed shot the depth of field follows the zoom (the macro look); with one it is the shot's own.
    const look = macroLook(macroAmount(w.fov, toFov))
    const toBlur = hand ? hand.dof.blur : look.bokehScale
    const toRange = hand ? hand.dof.range : look.focusRange

    const dt = Math.min(delta, MAX_FRAME_DT)
    m.t = Math.min(1, m.t + dt / FOCUS_SECONDS)
    let fov: number
    if (m.t >= 1 && source.kind === 'track') {
      // On the keyframes the pose is a function of the clock; the camera settles on it, so a jump of the clock (the film ending, a click
      // on a tick) glides instead of snapping, and playing or scrubbing is followed almost exactly.
      const f = followFactor(dt, FOLLOW_SECONDS)
      camera.quaternion.slerp(toQuat, f)
      camera.position.set(
        camera.position.x + (toPos.x - camera.position.x) * f,
        camera.position.y + (toPos.y - camera.position.y) * f,
        camera.position.z + (toPos.z - camera.position.z) * f,
      )
      fov = lerpFov(camera.fov, toFov, f)
      shot.focusDistance += (toDistance - shot.focusDistance) * f
      shot.blur += (toBlur - shot.blur) * f
      shot.range += (toRange - shot.range) * f
    } else {
      const e = easeInOut(m.t)
      camera.quaternion.copy(m.fromQuat).slerp(toQuat, e)
      camera.position.set(
        m.fromPos.x + (toPos.x - m.fromPos.x) * e,
        m.fromPos.y + (toPos.y - m.fromPos.y) * e,
        m.fromPos.z + (toPos.z - m.fromPos.z) * e,
      )
      fov = m.t < 1 ? lerpFov(m.fromFov, toFov, e) : toFov
      shot.focusDistance = m.fromDistance + (toDistance - m.fromDistance) * e
      shot.blur = m.fromBlur + (toBlur - m.fromBlur) * e
      shot.range = m.fromRange + (toRange - m.fromRange) * e
    }
    if (fov !== camera.fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    // For the post-processing: how far in the lens is, and the distance of what it is aimed at.
    shot.fov = fov
    shot.wideFov = w.fov
  })

  return null
}

const distanceBetween = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
