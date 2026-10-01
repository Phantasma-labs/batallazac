import { useGLTF } from '@react-three/drei'
import { DRACO_PATH } from './sceneAssets'

/** Renders a piece GLB exactly as exported: node transforms already hold the world positions. */
export function Piece({ url }: { url: string }) {
  const { scene } = useGLTF(url, DRACO_PATH)
  return <primitive object={scene} />
}
