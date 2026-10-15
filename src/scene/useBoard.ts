import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import type { Object3D } from 'three'
import { useFloorLayout } from '../camera/framing'
import { HOTSPOTS } from '../camera/hotspots'
import { stretchHotspots, type Hotspot } from '../camera/locked'
import type { Vec3 } from '../camera/math'
import { eventShots } from '../camera/shots'
import { makeGroundSampler } from './ground'
import { onGround, placePoints } from './places'
import { DRACO_PATH, FLOOR } from './sceneAssets'

export type Board = {
  /** The clickable hotspots, in world coordinates. */
  hotspots: Hotspot[]
  /** Every camera shot by id: the hotspots, and the shots only events use. */
  shots: Map<string, Hotspot>
  /** Pins and march stops by id, standing on the terrain. */
  places: Map<string, Vec3>
  /** Height of the terrain at (x, z). */
  groundY: (x: number, z: number) => number
}

const cache = new WeakMap<Object3D, Map<string, Board>>()

/**
 * What the scene knows about the board's layout: hotspots and places in world coordinates (following the floor's stretch
 * and moved hills), and the ground height. Built once per floor and shared by the camera, the pins and the marching flags.
 */
export function useBoard(): Board {
  const { scene } = useGLTF(FLOOR.model, DRACO_PATH)
  const { stretch, shifts } = useFloorLayout()
  return useMemo(() => {
    const key = JSON.stringify([stretch, shifts])
    const known = cache.get(scene)?.get(key)
    if (known) return known
    const groundY = makeGroundSampler(scene)
    const hotspots = stretchHotspots(HOTSPOTS, stretch, shifts)
    const rough = placePoints(stretch, shifts, true)
    const shots = new Map([...hotspots, ...eventShots(rough)].map((h) => [h.id, h]))
    const board: Board = { hotspots, shots, places: onGround(rough, groundY), groundY }
    if (!cache.has(scene)) cache.set(scene, new Map())
    cache.get(scene)!.set(key, board)
    return board
  }, [scene, stretch, shifts])
}
