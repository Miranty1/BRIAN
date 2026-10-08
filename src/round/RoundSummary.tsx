import ui from '@/components/ui.module.css'
import type { SaveStatus } from '@/data/progress'
import styles from './RoundScreen.module.css'

type Props = {
  gameName: string
  score: number
  accuracy: number
  avgResponseMs: number
  level: number
  newLevel: number
  isPersonalBest: boolean
  saveStatus: SaveStatus | 'saving'
  onPlayAgain(): void
  onDone(): void
}

const SAVE_TEXT: Record<Props['saveStatus'], string> = {
  saving: 'Saving…',
  synced: 'Saved',
  pending: 'Saved on this phone. It’ll sync when you’re back online.',
  rejected: 'Couldn’t save this round.',
}

export function RoundSummary(p: Props) {
  const levelText = p.newLevel === p.level ? `Holds at ${p.level}` : `${p.level} → ${p.newLevel}`
  const change = p.newLevel > p.level ? 'up' : p.newLevel < p.level ? 'down' : 'same'

  return (
    <div className={styles.summary}>
      <p className={styles.summaryGame}>{p.gameName}</p>
      <p className={styles.score} aria-label={`Score ${p.score} out of 100`}>
        {p.score}
      </p>
      {p.isPersonalBest && <p className={styles.best}>New personal best</p>}
      <dl className={styles.stats}>
        <div>
          <dt>Accuracy</dt>
          <dd>{Math.round(p.accuracy * 100)}%</dd>
        </div>
        <div>
          <dt>Average time</dt>
          <dd>{(p.avgResponseMs / 1000).toFixed(1)} s</dd>
        </div>
        <div>
          <dt>Level</dt>
          <dd data-change={change}>{levelText}</dd>
        </div>
      </dl>
      <p className={styles.save} role="status">
        {SAVE_TEXT[p.saveStatus]}
      </p>
      <div className={styles.actions}>
        <button className={`${ui.button} ${ui.quiet}`} onClick={p.onDone}>
          Done
        </button>
        <button className={`${ui.button} ${styles.trackButton}`} onClick={p.onPlayAgain}>
          Play again
        </button>
      </div>
    </div>
  )
}
