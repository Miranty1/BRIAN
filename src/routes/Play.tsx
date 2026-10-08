import { GAMES } from '@/games/games'
import { TRACKS } from '@/games/tracks'
import styles from './Play.module.css'

export function Play() {
  return (
    <div>
      <h1 className={styles.title}>Free play</h1>
      <p className={styles.lede}>
        Any game, any time. Free play doesn’t count towards your streak.
      </p>
      <ul className={styles.list}>
        {GAMES.map((g) => (
          <li key={g.id} className={styles.row}>
            <span className={styles.swatch} style={{ background: TRACKS[g.track].colour }} />
            <span className={styles.name}>{g.name}</span>
            <span className={styles.blurb}>{g.blurb}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
