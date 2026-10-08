import { useState } from 'react'
import { gameById } from '@/games/games'
import { TRACKS, TRACK_IDS } from '@/games/tracks'
import styles from './Home.module.css'

const today = new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

export function Home() {
  const wordBank = gameById('word-bank')
  const [dateLabel] = useState(() => today.format(new Date()))

  return (
    <div className={styles.page}>
      <header>
        <p className={styles.date}>{dateLabel}</p>
        <h1 className={styles.title}>Today’s workout</h1>
      </header>

      <section className={styles.workout} aria-label="Today’s workout">
        <div className={styles.tile} style={{ background: TRACKS[wordBank.track].colour }}>
          <span className={styles.tileName}>{wordBank.name}</span>
          <span className={styles.tileMeta}>{TRACKS[wordBank.track].name}</span>
        </div>
        <div className={`${styles.tile} ${styles.pending}`}>
          <span className={styles.tileName}>Picked daily</span>
          <span className={styles.tileMeta}>Weakest track first</span>
        </div>
        <div className={`${styles.tile} ${styles.pending}`}>
          <span className={styles.tileName}>Picked daily</span>
          <span className={styles.tileMeta}>Least played</span>
        </div>
      </section>
      <p className={styles.note}>Games aren’t playable yet. They’re coming in the next build.</p>

      <section aria-labelledby="skills">
        <h2 id="skills" className={styles.heading}>
          Skills
        </h2>
        <ul className={styles.skills}>
          {TRACK_IDS.map((id) => (
            <li key={id} className={styles.skill} style={{ background: TRACKS[id].soft }}>
              <span className={styles.skillDot} style={{ background: TRACKS[id].colour }} />
              <span className={styles.skillName}>{TRACKS[id].name}</span>
              <span className={styles.skillScore}>0</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
