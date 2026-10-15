import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'
import {
  Box3,
  Color,
  DoubleSide,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector4,
  WebGLRenderTarget,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { DRACO_PATH, FLOOR } from './sceneAssets'

/** The terrain's height seen from straight above, on the GPU, so a ribbon can be laid over any slope without ray-casting it. */
export type HeightMap = {
  /** The height (world y) of the floor in the red channel. */
  texture: Texture
  /** minX, maxZ, 1 / width, 1 / depth: `uv = ((x - minX) / width, (maxZ - z) / depth)`. */
  box: Vector4
}

const DEPTH_VERTEX = /* glsl */ `
  varying float vHeight;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vHeight = world.y;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`
const DEPTH_FRAGMENT = /* glsl */ `
  varying float vHeight;
  void main() { gl_FragColor = vec4(vHeight, 0.0, 0.0, 1.0); }
`

const SIZE = 1024

type Entry = { map: HeightMap; target: WebGLRenderTarget; floor: Object3D; drawn: boolean }
const cache = new WeakMap<Object3D, Entry>()

/** Draws the floor from above into the target: with the depth test on, the highest surface wins, which is the terrain's height. */
function draw(gl: WebGLRenderer, entry: Entry) {
  const box = new Box3().setFromObject(entry.floor)
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2
  const hw = (box.max.x - box.min.x) / 2, hd = (box.max.z - box.min.z) / 2
  const camera = new OrthographicCamera(-hw, hw, hd, -hd, 1, box.max.y - box.min.y + 100)
  camera.up.set(0, 0, -1) // north (-z) is the top of the picture
  camera.position.set(cx, box.max.y + 50, cz)
  camera.lookAt(cx, 0, cz)
  camera.updateMatrixWorld()
  const material = new ShaderMaterial({ vertexShader: DEPTH_VERTEX, fragmentShader: DEPTH_FRAGMENT, side: DoubleSide })
  // Stand-ins that share the floor's geometry at its world placement: the floor itself stays where it is in the scene.
  const scene = new Scene()
  entry.floor.updateWorldMatrix(true, true)
  entry.floor.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const proxy = new Mesh(mesh.geometry, material)
    proxy.matrixAutoUpdate = false
    proxy.matrix.copy(mesh.matrixWorld)
    proxy.frustumCulled = false
    scene.add(proxy)
  })
  const keepTarget = gl.getRenderTarget()
  const keepColor = gl.getClearColor(new Color())
  const keepAlpha = gl.getClearAlpha()
  const keepShadows = gl.shadowMap.autoUpdate
  gl.shadowMap.autoUpdate = false
  gl.setRenderTarget(entry.target)
  gl.setClearColor(0x000000, 0)
  gl.clear()
  gl.render(scene, camera)
  gl.setRenderTarget(keepTarget)
  gl.setClearColor(keepColor, keepAlpha)
  gl.shadowMap.autoUpdate = keepShadows
  material.dispose()
  entry.map.box.set(box.min.x, box.max.z, 1 / (2 * hw), 1 / (2 * hd))
  entry.drawn = true
}

/**
 * The terrain's height map, drawn once from the floor model (the same one `useBoard` ray-casts), shared by every arrow.
 * The texture exists from the first render and is filled before the first frame.
 */
export function useHeightMap(): HeightMap {
  const { scene: floor } = useGLTF(FLOOR.model, DRACO_PATH)
  const gl = useThree((s) => s.gl)
  const entry = useMemo(() => {
    const known = cache.get(floor)
    if (known) return known
    const target = new WebGLRenderTarget(SIZE, SIZE, {
      type: HalfFloatType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
      generateMipmaps: false,
    })
    const made: Entry = { map: { texture: target.texture, box: new Vector4(0, 0, 1, 1) }, target, floor, drawn: false }
    cache.set(floor, made)
    return made
  }, [floor])
  useLayoutEffect(() => {
    if (!entry.drawn) draw(gl, entry)
  }, [gl, entry])
  return entry.map
}
