import { useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useState } from 'react'
import { MapCamera } from '../camera/MapCamera'
import { VFOV_DEG, type Bounds } from '../camera/math'
import { Lighting } from './Lighting'
import { Piece } from './Piece'
import { Terrain } from './Terrain'
import { DRACO_PATH, FLOOR, PIECES } from './sceneAssets'

const BACKGROUND = '#d9cdb4' // matches the cream border of the floor texture

// Start every download in parallel instead of one after another.
useGLTF.preload(FLOOR.model, DRACO_PATH)
for (const p of PIECES) useGLTF.preload(p.url, DRACO_PATH)

export function MapScene() {
  const [bounds, setBounds] = useState<Bounds | null>(null)
  return (
    <Canvas flat dpr={[1, 2]} camera={{ fov: VFOV_DEG, near: 1, far: 12000 }}>
      <color attach="background" args={[BACKGROUND]} />
      <Lighting />
      <Suspense fallback={null}>
        <Terrain onBounds={setBounds} />
        {PIECES.map((p) => (
          <Piece key={p.id} url={p.url} />
        ))}
        {bounds && <MapCamera bounds={bounds} />}
      </Suspense>
    </Canvas>
  )
}
