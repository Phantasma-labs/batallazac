import { useProgress } from '@react-three/drei'
import { t } from '../i18n'
import { usePlayback } from '../video/playback'
import { GENERALS } from './generals'
import { portraitOf } from './portraits'
import { profiles } from './profiles'
import '../ui/profile.css'

/**
 * The three generals of the winning side, bottom centre of the map: a round picture (the last frame of his clip) over his name, one
 * button each, opening his profile (see `profiles`). Hidden while a film covers the screen and while the Loader shows.
 */
export function GeneralButtons() {
  const film = usePlayback()
  const { progress } = useProgress()
  if (film || progress < 100) return null
  return (
    <nav className="pf-buttons" aria-label={t('Los tres generales', 'The three generals')}>
      {GENERALS.map((g) => {
        const thumb = portraitOf(g.id)?.thumb
        return (
          <button
            key={g.id}
            className="pf-button"
            data-general={g.id}
            onClick={() => profiles.open(g.id)}
            aria-label={t(`Perfil de ${g.name}`, `Profile of ${g.name}`)}
          >
            {thumb ? <img className="pf-thumb" src={thumb} alt="" draggable={false} /> : <span className="pf-thumb pf-thumb-none" aria-hidden>{g.name[0]}</span>}
            <span className="pf-name">{g.name.split(' ').at(-1)}</span>
          </button>
        )
      })}
    </nav>
  )
}
