import { useMemo } from 'react'
import { EVENTS, UNITS } from '../timeline/events'
import { Arrow } from './Arrow'
import { Blast } from './Blast'
import { Force } from './Force'
import { Trail } from './Trail'
import { colorOfUnit, marchesOf } from './marchShared'
import { useBoard } from './useBoard'

/** The units that attack with an arrow, fire and smoke where it lands: the federal army only fires back, with flashes at its rifles. */
const ARROWS = new Set(UNITS.filter((u) => u.track !== 'federal').map((u) => u.id))

/**
 * The trails of the marches, the attack arrows and the explosions, all driven by the timeline clock, and the units themselves as
 * formations of bars.
 */
export function Marching() {
  const board = useBoard()
  const marches = useMemo(() => marchesOf(board), [board])
  return (
    <>
      {marches.map((m, i) => (
        <Trail key={i} march={m} color={colorOfUnit(m.unit)} />
      ))}
      {UNITS.map((u) => <Force key={u.id} unit={u} marches={marches} board={board} />)}
      {EVENTS.flatMap((e) =>
        (e.attacks ?? []).flatMap((a, i) => (ARROWS.has(a.unit) ? [<Arrow key={`${e.id}-${i}`} attack={a} marches={marches} board={board} />] : [])),
      )}
      {EVENTS.flatMap((e) => (e.blasts ?? []).map((b, i) => <Blast key={`${e.id}-blast-${i}`} blast={b} board={board} />))}
    </>
  )
}
