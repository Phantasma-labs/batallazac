import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Object3D } from 'three'
import { useFramedPoints } from '../camera/framing'
import { EAST_CROP, REFERENCE_ASPECT, lockedRig, viewGroundZ, wideShot } from '../camera/locked'
import { cropEast, rimOf, type Bounds } from '../camera/math'
import { SPOT_TILT_DEG, spotRig } from './spot'

/**
 * Soft sky/ground fill (the ambient light). Raised from 0.15 to 0.6 so the statues' shaded sides (the camera looks at the
 * side facing away from the northern light) are lit; `SPOT.onGround` and the shadow intensity below were changed with it so the
 * ground keeps its brightness and the shadows their contrast. The sky colour went from blue-white to a warm cream: at this
 * strength the old one tinted the map blue (+8% blue on the ground); the cream gives back the earlier ground colours.
 */
const FILL = { sky: '#f4ece1', ground: '#8a7a5a', intensity: 0.6 }
/**
 * Warm white, as the sun was. `onGround` is how bright level ground is under the middle of the pool (no distance
 * falloff: `decay` 0); the light's own intensity is that divided by cos(tilt), so the exposure stays the same
 * whatever the elevation (it was 1.85 at a 22 degree tilt; 1.715 before the ambient light was raised, 1.27 with it).
 */
const SPOT = { color: '#fff1d6', onGround: 1.27 }
/**
 * Shadows: a variance shadow map, blurred a little. `intensity` < 1 keeps them from going black. The map is rendered
 * once, so 4096 costs memory, not frame time; `radius` is in map texels, so a smaller one is a crisper edge.
 */
const SHADOW = { mapSize: 4096, intensity: 0.9, radius: 1.5, blurSamples: 16, bias: -0.0005, normalBias: 0.4 }

/**
 * A spot light from the north (60 degrees above the horizon), centred on the middle of the ground the opening view
 * shows, with a wide soft cone: brightest in the middle of the screen, easing off toward its corners (a vignette).
 * Plus a soft sky/ground fill so nothing goes dark.
 * Until the board is known only the fill is lit.
 */
export function Lighting({ bounds }: { bounds: Bounds | null }) {
  const mustSee = useFramedPoints()
  const rig = useMemo(() => {
    if (!bounds) return null
    const view = cropEast(bounds, EAST_CROP)
    const tripod = lockedRig(view, mustSee).position
    const shot = wideShot(view, tripod, REFERENCE_ASPECT, mustSee)
    // Perspective packs the far part of the board into the top of the screen, so the middle of the screen is not the
    // middle of the ground it shows: aim at the middle of the ground between the top and the bottom edge instead.
    const { far, near } = viewGroundZ(tripod, shot, rimOf(view))
    return spotRig(view, { x: shot.target.x, z: (far + near) / 2 })
  }, [bounds, mustSee])
  // A spot light aims at a node that has to be in the scene for its position to count.
  const target = useMemo(() => new Object3D(), [])
  if (rig) target.position.set(rig.target.x, rig.target.y, rig.target.z)

  // The shadow map is rendered once (when the light and the ground are in the scene) instead of every frame: nothing that casts a
  // shadow moves.
  const shadowMap = useThree((s) => s.gl.shadowMap)
  useEffect(() => {
    if (!rig) return
    shadowMap.autoUpdate = false
    shadowMap.needsUpdate = true
  }, [shadowMap, rig])

  return (
    <>
      <hemisphereLight args={[FILL.sky, FILL.ground, FILL.intensity]} />
      {rig && (
        <>
          <primitive object={target} />
          <spotLight
            position={[rig.position.x, rig.position.y, rig.position.z]}
            target={target}
            angle={rig.angle}
            penumbra={rig.penumbra}
            decay={0}
            intensity={SPOT.onGround / Math.cos((SPOT_TILT_DEG * Math.PI) / 180)}
            color={SPOT.color}
            castShadow
            shadow-mapSize={[SHADOW.mapSize, SHADOW.mapSize]}
            shadow-intensity={SHADOW.intensity}
            shadow-radius={SHADOW.radius}
            shadow-blurSamples={SHADOW.blurSamples}
            shadow-bias={SHADOW.bias}
            shadow-normalBias={SHADOW.normalBias}
            shadow-focus={rig.shadowFocus}
            shadow-camera-near={rig.near}
            shadow-camera-far={rig.far}
          />
        </>
      )}
    </>
  )
}
