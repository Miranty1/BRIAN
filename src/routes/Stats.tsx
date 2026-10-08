import styles from './Page.module.css'

export function Stats() {
  return (
    <div>
      <h1 className={styles.title}>Stats</h1>
      <p className={styles.lede}>
        Your trends, streak calendar and personal bests will show here once you’ve played a few
        rounds.
      </p>
    </div>
  )
}
