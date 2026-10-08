import styles from './ConfigError.module.css'

/** Shown instead of the app when build-time settings are missing, so it never loads blank. */
export function ConfigError({ invalid }: { invalid: string[] }) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>BRIAN can’t connect</h1>
      <p>These settings are missing or invalid in this build:</p>
      <ul className={styles.list}>
        {invalid.map((name) => (
          <li key={name}>
            <code>{name}</code>
          </li>
        ))}
      </ul>
      <p>
        <strong>Running locally:</strong> add them to <code>.env.local</code> (see{' '}
        <code>.env.example</code>), then restart <code>npm run dev</code>.
      </p>
      <p>
        <strong>On Vercel:</strong> add them under Settings → Environment Variables for this
        environment, then Redeploy. Values are built in, so changes need a new build.
      </p>
      <p className={styles.hint}>Both values are in Supabase → Project Settings → API.</p>
    </main>
  )
}
