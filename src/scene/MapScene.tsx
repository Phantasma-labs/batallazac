import { useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useState } from 'react'
import { LockedCamera } from '../camera/LockedCamera'
import { MapCamera } from '../camera/MapCamera'
import { VFOV_DEG, type Bounds } from '../camera/math'
import { cameraModeFromSearch } from '../camera/mode'
import { Director } from '../timeline/Director'
import { Glows } from './Glows'
import { Lighting } from './Lighting'
import { Marching } from './March'
import { Piece } from './Piece'
import { Pins } from './Pins'
import { PostFx } from './PostFx'
import { Terrain } from './Terrain'
import { DRACO_PATH, FLOOR, PIECES } from './sceneAssets'

const BACKGROUND = '#d9cdb4' // matches the cream border of the floor texture
/** The glows move with the timeline: `Glows` draws them, not `Piece`. */
const MOVING = new Set(['glows'])
const CAMERA_MODE = cameraModeFromSearch(window.location.search) // tripod camera by default, ?cam=free for the free camera

// Start every download in parallel instead of one after another.
useGLTF.preload(FLOOR.model, DRACO_PATH)
for (const p of PIECES) useGLTF.preload(p.url, DRACO_PATH)

export function MapScene() {
  const [bounds, setBounds] = useState<Bounds | null>(null)
  return (
    <Canvas flat shadows="variance" dpr={[1, 2]} gl={{ antialias: false }} camera={{ fov: VFOV_DEG, near: 1, far: 12000 }}>
      <color attach="background" args={[BACKGROUND]} />
      <Suspense fallback={null}>
        <Lighting bounds={bounds} />
        <Terrain onBounds={setBounds} />
        {PIECES.filter((p) => !MOVING.has(p.id)).map((p) => (
          <Piece key={p.id} url={p.url} castShadow={p.shadow !== false} />
        ))}
        <Glows />
        {bounds && <Pins />}
        {bounds && <Marching />}
        {bounds && <Director />}
        {bounds && (CAMERA_MODE === 'locked' ? <LockedCamera bounds={bounds} /> : <MapCamera bounds={bounds} />)}
        <PostFx />
      </Suspense>
    </Canvas>
  )
}
