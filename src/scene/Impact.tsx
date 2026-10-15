import { fx } from '../timeline/fxTime'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, type MutableRefObject } from 'react'
import { Color, Group, Mesh, PlaneGeometry, SpriteMaterial, type PerspectiveCamera, type Vector4 } from 'three'
import { SMOKE_VARIANTS, flashTexture, glowTexture, smokeTexture } from './effectTextures'
import { GROUND_RADIUS, groundBurstMaterial } from './groundBurstGlow'
import { useHeightMap } from './heightMap'
import { WIND, effectUnit, flashLevel, flicker, hash01, muzzleLevel, puffAt, puffLook, ringLook, shellAt, type ImpactKind } from './impactEffect'
import { worldPerPixel } from './screenScale'
import { soft } from './softSprite'
import type { LiveAttack } from './Tracers'

/** The smoke's tint: lit orange from inside while the fire is under it, a dark blue-grey once it has cooled (linear colour; the texture is neutral). */
const LIT_SMOKE = new Color(0.5, 0.2, 0.065)
const COOL_SMOKE = new Color(0.17, 0.19, 0.25)
const scratch = new Color()

/**
 * Fire and smoke where an attack lands, looping while the attack is on and scaled by its fade: a plume of layered smoke
 * (lit orange from inside near the fire, dark blue-grey as it climbs) blown downwind on a steady north-east wind, a bright
 * flickering fire core with a flash for every shell on the beat of the tracers, a soot patch on the ground under it with
 * a ring of dust racing out from each landing, and for artillery a muzzle flash at the attacker. Sizes are a fixed share
 * of the screen (kept between a floor and a ceiling), so the burst reads at any zoom. The smoke sits a little behind the
 * target so the units at the fire stay in front of it.
 */
export function Impact({ live, kind, fire, seed }: { live: MutableRefObject<LiveAttack>; kind: ImpactKind; fire: string; seed: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const height = useThree((s) => s.size.height)
  const heights = useHeightMap()
  const parts = useMemo(() => {
    const root = new Group()
    const geometry = new PlaneGeometry(2, 2, 28, 28)
    geometry.rotateX(-Math.PI / 2)
    const material = groundBurstMaterial(fire, heights)
    const ground = new Mesh(geometry, material)
    ground.renderOrder = 3
    ground.frustumCulled = false
    const smoke = Array.from({ length: kind.puffs }, (_, i) => soft(smokeTexture(i % SMOKE_VARIANTS), 5))
    const core = soft(glowTexture(), 6)
    const flashes = Array.from({ length: kind.shells }, () => soft(flashTexture(), 7))
    const muzzle = soft(flashTexture(), 7)
    root.add(ground, ...smoke.map((s) => s.sprite), core.sprite, ...flashes.map((s) => s.sprite), muzzle.sprite)
    return { root, ground, material, geometry, smoke, core, flashes, muzzle }
  }, [kind, fire, heights])
  useEffect(
    () => () => {
      parts.geometry.dispose()
      parts.material.dispose()
      for (const s of [...parts.smoke, parts.core, ...parts.flashes, parts.muzzle]) s.sprite.material.dispose()
    },
    [parts],
  )

  useFrame((state) => {
    const { root, ground, material, smoke, core, flashes, muzzle } = parts
    const { strength, from, to } = live.current
    root.visible = strength > 0
    if (strength <= 0) return
    const time = fx.time
    const wpp = worldPerPixel(camera, to, height)
    const show = Math.min(strength * 2, 1)
    // The burst grows to its full size as the attack fades in and shrinks as it fades out.
    const P = kind.plume * (0.6 + 0.4 * show)
    const U = effectUnit(wpp)
    const fl = flicker(time, seed)

    // Ground: soot, firelight and rings.
    ground.position.set(0, 0, 0)
    material.uniforms.uCenter.value.set(to.x, to.z)
    material.uniforms.uScale.value = U * GROUND_RADIUS * P
    material.uniforms.uStrength.value = show
    material.uniforms.uCore.value = fl
    const rings = material.uniforms.uRing.value as Vector4[]
    const levels = material.uniforms.uLevel.value as number[]

    // The smoke is born a little north of the target (behind the units, seen from the south).
    const baseX = to.x, baseZ = to.z - 0.3 * U * P

    // Fire core: a bright, flickering heart under the plume.
    core.sprite.visible = true
    core.sprite.position.set(baseX + 0.05 * U, to.y + 0.34 * U * P, baseZ + 0.1 * U)
    core.sprite.scale.setScalar(1.6 * U * P * fl)
    core.push.value = 8
    ;(core.sprite.material as SpriteMaterial).opacity = Math.min(show * (0.82 + 0.18 * fl), 1)

    let muzzleBright = 0
    let muzzleShell = 0
    for (let k = 0; k < kind.shells; k++) {
      const sh = shellAt(kind, k, time, seed)
      const level = flashLevel(sh.since)
      const f = flashes[k]
      f.sprite.visible = level > 0.02
      if (f.sprite.visible) {
        f.sprite.position.set(to.x + sh.scatter.x * U * P, to.y + U * 0.45 * P, to.z + sh.scatter.z * U * P - 0.1 * U)
        f.sprite.scale.setScalar(U * kind.flash * 2.5 * P * (1.35 - 0.35 * level))
        f.push.value = 10
        const m = f.sprite.material as SpriteMaterial
        m.opacity = Math.min(level * 1.3, 1) * show
        m.rotation = hash01(sh.cycle * 3.3 + k) * Math.PI * 2
      }
      const ring = kind.tracers ? ringLook(sh.since) : { spread: 0, alpha: 0 }
      rings[k].set(ring.spread, ring.alpha, sh.scatter.x * P, sh.scatter.z * P)
      levels[k] = level
      if (kind.tracers) {
        const ml = muzzleLevel(sh.phase)
        if (ml > muzzleBright) {
          muzzleBright = ml
          muzzleShell = k
        }
      }
    }

    muzzle.sprite.visible = kind.tracers && muzzleBright > 0.02
    if (muzzle.sprite.visible) {
      // The flash is at the mouth of the gun whose shell this is (the same gun the tracer leaves from), or at the attacker's place.
      const guns = live.current.muzzles
      const gun = guns && guns.length > 0 ? guns[muzzleShell % guns.length] : null
      if (gun) muzzle.sprite.position.set(gun.x, gun.y, gun.z)
      else muzzle.sprite.position.set(from.x, from.y + U * 0.35, from.z)
      muzzle.sprite.scale.setScalar(U * 1.6)
      muzzle.push.value = 4
      const m = muzzle.sprite.material as SpriteMaterial
      m.opacity = Math.min(muzzleBright * 1.2, 1) * show
      m.rotation = Math.floor(time * 6) * 1.7
    }

    for (let i = 0; i < kind.puffs; i++) {
      const p = puffAt(i, kind.puffs, time, seed, 3.8)
      const look = puffLook(p.age)
      const s = smoke[i]
      const alpha = Math.min(look.alpha * kind.smoke * 0.92, 0.9) * show
      s.sprite.visible = alpha > 0.01
      if (!s.sprite.visible) continue
      const x = baseX + (p.r - 0.5) * kind.scatter * U * P * 0.9 + WIND.x * look.drift * U * P
      const y = to.y + (0.3 + look.rise) * U * P
      const z = baseZ + (p.r2 - 0.5) * kind.scatter * U * P * 0.9 + WIND.z * look.drift * U * P
      s.sprite.position.set(x, y, z)
      s.sprite.scale.setScalar(look.size * U * P)
      s.push.value = Math.min(Math.max((y - to.y) * 0.8, 6), 40)
      const m = s.sprite.material as SpriteMaterial
      m.opacity = alpha
      m.rotation = (p.r - 0.5) * 0.7
      m.color.copy(scratch.copy(COOL_SMOKE).lerp(LIT_SMOKE, look.warm))
    }
  })

  return <primitive object={parts.root} />
}
