import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Group, Mesh, type Material, type MeshStandardMaterial } from 'three'
import { clock } from '../timeline/clock'
import { UNITS } from '../timeline/events'
import { unitPosition } from '../timeline/model'
import { discGrid } from './glowDisc'
import { tameGlow } from './Piece'
import { marchesOf, stopPoint } from './marchShared'
import { DRACO_PATH, PIECES } from './sceneAssets'
import { useBoard } from './useBoard'
import { useHeightField } from './useHeightField'

/** The glow discs stand this far above the terrain, so slopes do not cut them. */
const LIFT = 0.8
const RINGS = 14
const SEGMENTS = 32

type Spec = {
  /** The baked glow whose material (a soft blue or red disc) the glow is drawn with. */
  like: string
  radius: number
} & ({ unit: string; place?: undefined } | { place: string; unit?: undefined })

/**
 * The soft glow under each group of soldiers or guns (blue for the federals, red for the rest), as it was baked in `glows.glb` but
 * following its group: each disc is laid over the terrain again every time its group moves. The guns' disc was one big one under all five
 * cannons; now one follows the three that go to Cerro de Loreto and a smaller one stays under the two that remain.
 */
const SPECS: Spec[] = [
  { like: 'Glow_ElGrillo_Assault_Red', radius: 48, unit: 'natera' },
  { like: 'Glow_ElGrillo_Assault_Red', radius: 48, unit: 'villa' },
  { like: 'Glow_ElGrillo_Federal_Blue', radius: 48, unit: 'fed-sierpe' },
  { like: 'Glow_ElGrillo_Federal_Blue', radius: 48, unit: 'fed-grillo' },
  { like: 'Glow_Cathedral_Federal_Blue', radius: 60, unit: 'fed-center' },
  { like: 'Glow_LaBufa_Federal_Blue', radius: 60, unit: 'fed-bufa' },
  { like: 'Glow_Vetagrande_Red', radius: 78, unit: 'angeles' },
  { like: 'Glow_Vetagrande_Red', radius: 54, place: 'angeles-rear' },
]

export function Glows() {
  const board = useBoard()
  const ground = useHeightField()
  const url = PIECES.find((p) => p.id === 'glows')!.url
  const { scene } = useGLTF(url, DRACO_PATH)

  const discs = useMemo(() => {
    const marches = marchesOf(board)
    const root = new Group()
    const list = SPECS.map((spec) => {
      const source = scene.getObjectByName(spec.like) as Mesh
      const material = source.material as MeshStandardMaterial
      tameGlow(material as Material)
      const grid = discGrid(spec.radius, RINGS, SEGMENTS)
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new BufferAttribute(grid.positions, 3))
      geometry.setAttribute('uv', new BufferAttribute(grid.uv, 2))
      geometry.setAttribute('normal', new BufferAttribute(Float32Array.from({ length: grid.positions.length }, (_, i) => (i % 3 === 1 ? 1 : 0)), 3))
      geometry.setIndex(new BufferAttribute(grid.index, 1))
      const mesh = new Mesh(geometry, material)
      mesh.frustumCulled = false
      mesh.raycast = () => null
      root.add(mesh)
      const unit = spec.unit ? UNITS.find((u) => u.id === spec.unit)! : null
      return {
        mesh,
        positions: grid.positions,
        geometry,
        fixed: spec.place ? board.places.get(spec.place)! : null,
        start: unit ? stopPoint(unit.start, board.places) : null,
        marches: unit ? marches.filter((m) => m.unit === unit.id) : [],
        unit: spec.unit ?? '',
        x: NaN,
        z: NaN,
      }
    })
    return { root, list }
  }, [board, scene])
  useEffect(() => () => discs.list.forEach((d) => d.geometry.dispose()), [discs])

  useFrame(() => {
    const t = clock.time
    for (const d of discs.list) {
      const at = d.fixed ?? unitPosition(d.start!, d.marches, d.unit, t)
      // Laid over the terrain again only when the group has moved.
      if (Math.abs(at.x - d.x) < 0.05 && Math.abs(at.z - d.z) < 0.05) continue
      d.x = at.x
      d.z = at.z
      d.mesh.position.set(at.x, 0, at.z)
      const p = d.positions
      for (let i = 0; i < p.length; i += 3) p[i + 1] = ground(at.x + p[i], at.z + p[i + 2]) + LIFT
      d.geometry.attributes.position.needsUpdate = true
    }
  })

  return <primitive object={discs.root} />
}
