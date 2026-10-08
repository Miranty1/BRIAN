import { Link } from 'react-router-dom'
import { useGameProgress } from '@/data/ProgressProvider'
import { GAMES, type GameDef } from '@/games/games'
import { getGameModule } from '@/games/registry'
import { TRACKS } from '@/games/tracks'
import styles from './Play.module.css'

function GameRow({ game }: { game: GameDef }) {
  const playable = getGameModule(game.id) !== undefined
  const progress = useGameProgress(playable ? game.id : undefined)
  const content = (
    <>
      <span className={styles.swatch} style={{ background: TRACKS[game.track].colour }} />
      <span className={styles.name}>{game.name}</span>
      <span className={styles.blurb}>{game.blurb}</span>
      <span className={styles.meta}>{playable ? `Level ${progress.level}` : 'Coming soon'}</span>
    </>
  )
  return (
    <li>
      {playable ? (
        <Link to={`/play/${game.id}`} className={`${styles.row} ${styles.playable}`}>
          {content}
        </Link>
      ) : (
        <div className={`${styles.row} ${styles.soon}`}>{content}</div>
      )}
    </li>
  )
}

export function Play() {
  return (
    <div>
      <h1 className={styles.title}>Free play</h1>
      <p className={styles.lede}>
        Any game, any time. Free play doesn’t count towards your streak.
      </p>
      <ul className={styles.list}>
        {GAMES.map((g) => (
          <GameRow key={g.id} game={g} />
        ))}
      </ul>
    </div>
  )
}
