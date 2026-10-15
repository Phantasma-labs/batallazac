import { fx } from '../timeline/fxTime'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { BufferAttribute, BufferGeometry, Group, MeshBasicMaterial, Sprite, SpriteMaterial, type Mesh, type PerspectiveCamera } from 'three'
import type { Vec3 } from '../camera/math'
import { blobTexture, glowTexture } from './effectTextures'
import { MAX_SHELLS, effectUnit, shellAt, type ImpactKind } from './impactEffect'
import { tracerMaterial } from './tracerGlow'
import { worldPerPixel } from './screenScale'

/** What the attack the effects belong to looks like right now; the arrow's frame loop keeps it up to date. */
export type LiveAttack = { strength: number; from: Vec3; to: Vec3; /** The barrel mouths of the guns firing on the target, which the shells leave from one after another; the attacker's place when none. */ muzzles?: readonly Vec3[] }

const TRACER_PIXELS = 12
/** Muzzle height above the attacker's ground point, in effect units. */
const MUZZLE = 0.3
/** How high the shells arc, as a share of the distance (kept between a floor and a ceiling, world units), so they read above the arrow on the ground. */
const ARC = 0.17
const ARC_MIN = 14
const ARC_MAX = 120
/** The light stands north of the board and leans 30 degrees, so a shadow falls this far south of a point for each unit of its height. */
const SHADOW_SLANT = 0.58

/**
 * The shells of an artillery attack: short bright streaks that leave the attacker one after another, climb in an arc and
 * come down on the target, where `Impact` flashes at the very moment they land (both read the same `shellAt` timing).
 * Each streak is a camera-facing quad rewritten every frame, with a small fireball at its head; there are only a few.
 */
export function Tracers({ live, kind, color, seed, ground }: { live: MutableRefObject<LiveAttack>; kind: ImpactKind; color: string; seed: number; ground: (x: number, z: number) => number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const height = useThree((s) => s.size.height)
  const mesh = useRef<Mesh>(null)
  const material = useMemo(() => tracerMaterial(color), [color])
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    const verts = kind.shells * 4
    g.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3))
    const along = new Float32Array(verts)
    const side = new Float32Array(verts)
    const index = new Uint16Array(kind.shells * 6)
    for (let k = 0; k < kind.shells; k++) {
      along.set([0, 0, 1, 1], k * 4)
      side.set([1, -1, 1, -1], k * 4)
      index.set([0, 1, 2, 1, 3, 2].map((v) => v + k * 4), k * 6)
    }
    g.setAttribute('along', new BufferAttribute(along, 1))
    g.setAttribute('side', new BufferAttribute(side, 1))
    g.setIndex(new BufferAttribute(index, 1))
    return g
  }, [kind])
  const heads = useMemo(() => {
    const group = new Group()
    const sprites = Array.from({ length: kind.shells }, () => {
      const s = new Sprite(new SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, toneMapped: false }))
      s.renderOrder = 5
      s.visible = false
      return s
    })
    group.add(...sprites)
    return { group, sprites }
  }, [kind])
  // Each shell throws a soft shadow on the terrain, which ties the streak to the ground it flies over.
  const shadows = useMemo(() => {
    const g = new BufferGeometry()
    const verts = kind.shells * 4
    g.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3))
    const uv = new Float32Array(verts * 2)
    const index = new Uint16Array(kind.shells * 6)
    for (let k = 0; k < kind.shells; k++) {
      uv.set([0, 0, 1, 0, 0, 1, 1, 1], k * 8)
      index.set([0, 2, 1, 1, 2, 3].map((v) => v + k * 4), k * 6)
    }
    g.setAttribute('uv', new BufferAttribute(uv, 2))
    g.setIndex(new BufferAttribute(index, 1))
    const m = new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.4, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
    return { g, m }
  }, [kind])
  const shadowMesh = useRef<Mesh>(null)
  useEffect(() => () => { shadows.g.dispose(); shadows.m.dispose() }, [shadows])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  useEffect(() => () => { for (const s of heads.sprites) s.material.dispose() }, [heads])

  useFrame((state) => {
    const m = mesh.current
    const { strength, from, to, muzzles } = live.current
    if (!m) return
    m.visible = heads.group.visible = strength > 0
    if (shadowMesh.current) shadowMesh.current.visible = strength > 0
    if (strength <= 0) return
    const time = fx.time
    const pos = geometry.attributes.position as BufferAttribute
    const arr = pos.array as Float32Array
    const shadowPos = shadows.g.attributes.position as BufferAttribute
    const sh4 = shadowPos.array as Float32Array
    const wpp = worldPerPixel(camera, to, height)
    const U = effectUnit(wpp)
    const half = Math.max(TRACER_PIXELS * wpp * 0.5, 1.3)
    const len = Math.hypot(to.x - from.x, to.z - from.z)
    const arc = Math.min(Math.max(len * ARC, ARC_MIN), ARC_MAX)
    const tailU = Math.min(Math.max((U * 3.2) / Math.max(len, 1), 0.07), 0.38)
    const origin = { x: from.x, y: from.y + U * MUZZLE, z: from.z }
    const point = (u: number, tx: number, tz: number, out: number[]) => {
      out[0] = origin.x + (tx - origin.x) * u
      out[1] = origin.y + (to.y + 3 - origin.y) * u + arc * 4 * u * (1 - u)
      out[2] = origin.z + (tz - origin.z) * u
    }
    const head = [0, 0, 0], tail = [0, 0, 0]
    for (let k = 0; k < MAX_SHELLS && k < kind.shells; k++) {
      const sh = shellAt(kind, k, time, seed)
      const o = k * 12
      // Each shell leaves the mouth of its own gun, when there are guns firing on the target.
      if (muzzles && muzzles.length > 0) {
        const gun = muzzles[k % muzzles.length]
        origin.x = gun.x
        origin.y = gun.y
        origin.z = gun.z
      }
      const fireball = heads.sprites[k]
      if (!sh.flying) {
        arr.fill(0, o, o + 12)
        sh4.fill(0, k * 12, k * 12 + 12)
        fireball.visible = false
        continue
      }
      const tx = to.x + sh.scatter.x * U, tz = to.z + sh.scatter.z * U
      const u = Math.pow(sh.flight, 0.85)
      point(u, tx, tz, head)
      point(Math.max(u - tailU, 0), tx, tz, tail)
      // Face the camera: the quad's width runs across both the streak and the line of sight.
      const dx = head[0] - tail[0], dy = head[1] - tail[1], dz = head[2] - tail[2]
      const vx = (head[0] + tail[0]) / 2 - camera.position.x
      const vy = (head[1] + tail[1]) / 2 - camera.position.y
      const vz = (head[2] + tail[2]) / 2 - camera.position.z
      let rx = dy * vz - dz * vy, ry = dz * vx - dx * vz, rz = dx * vy - dy * vx
      const rl = Math.hypot(rx, ry, rz) || 1
      rx /= rl
      ry /= rl
      rz /= rl
      const tw = half * 0.3
      arr.set(
        [
          tail[0] + rx * tw, tail[1] + ry * tw, tail[2] + rz * tw,
          tail[0] - rx * tw, tail[1] - ry * tw, tail[2] - rz * tw,
          head[0] + rx * half, head[1] + ry * half, head[2] + rz * half,
          head[0] - rx * half, head[1] - ry * half, head[2] - rz * half,
        ],
        o,
      )
      // Its shadow, on the terrain below and a little south of it (the light stands north).
      const onGround = ground(head[0], head[2])
      const lift = Math.max(head[1] - onGround, 0)
      const sx = head[0], sz = head[2] + SHADOW_SLANT * lift
      const sy = ground(sx, sz) + 1.2
      const shrink = 1 / (1 + lift / 160)
      const hx = U * 0.55 * shrink, hz = U * 0.3 * shrink
      sh4.set([sx - hx, sy, sz - hz, sx + hx, sy, sz - hz, sx - hx, sy, sz + hz, sx + hx, sy, sz + hz], k * 12)
      fireball.visible = true
      fireball.position.set(head[0], head[1], head[2])
      fireball.scale.setScalar(Math.max(half * 5, U * 0.5))
      ;(fireball.material as SpriteMaterial).opacity = Math.min(strength * 2, 1)
    }
    pos.needsUpdate = true
    shadowPos.needsUpdate = true
    shadows.m.opacity = 0.42 * Math.min(strength * 2, 1)
    material.uniforms.uAlpha.value = Math.min(strength * 2, 1)
  })

  return (
    <>
      <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={4} visible={false} />
      <mesh ref={shadowMesh} geometry={shadows.g} material={shadows.m} frustumCulled={false} renderOrder={3} visible={false} />
      <primitive object={heads.group} />
    </>
  )
}
