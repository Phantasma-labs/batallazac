import type { TimelineEvent } from '../timeline/model'
import type { Vec3 } from '../camera/math'

/** The place a unit fires on between two minutes (in world coordinates, with its place id). */
export type Aim = { from: number; to: number; x: number; z: number; target?: string; /** The unit whose attack this is (the guns keep their shells apart by unit). */ unit?: string }

/**
 * The mouths of the guns that are firing, by the unit and the place they fire on (`muzzleKey`), in world coordinates. The shells and the
 * muzzle flashes of an attack on a place leave from these (see `Arrow`, `Force`). The arrays are refilled in place every frame, so they can be held on to.
 */
export const GUN_MUZZLES: Record<string, Vec3[]> = {}

/** The unit of the three Vetagrande cannons that roll to Cerro de Loreto, and the one of the two that stay at Vetagrande. */
export const GUN_UNIT = 'angeles'
export const REAR_UNIT = 'angeles-rear'

/** The key of the barrel mouths of one unit's guns that are firing on a place (see `GUN_MUZZLES`): each attack's shells leave from its own guns. */
export const muzzleKey = (unit: string, target: string) => `${unit}>${target}`

/**
 * What the Vetagrande cannons aim at, from the attacks of the timeline. The three that roll (`movers`) fire as the `angeles` unit all
 * day. The two that stay (`stayers`) fire with them as long as they all stand at Vetagrande, the attacks that begin before `setOff`
 * (the minute the guns set off for Loreto), and then, on their own, the attacks of `angeles-rear`.
 */
export function gunAims(
  events: readonly TimelineEvent[],
  place: (id: string) => { x: number; z: number },
  setOff: number,
): { movers: Aim[]; stayers: Aim[] } {
  const aims = (unit: string): Aim[] =>
    events.flatMap((e) =>
      (e.attacks ?? [])
        .filter((a) => a.unit === unit)
        .map((a) => {
          const p = place(a.target)
          return { from: a.startTime ?? e.time, to: a.endTime, x: p.x, z: p.z, target: a.target, unit }
        }),
    )
  const movers = aims(GUN_UNIT)
  return { movers, stayers: [...movers.filter((a) => a.from < setOff), ...aims(REAR_UNIT)] }
}
