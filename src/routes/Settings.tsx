import { useAuth } from '@/auth/AuthProvider'
import ui from '@/components/ui.module.css'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/theme/ThemeProvider'
import styles from './Page.module.css'

export function Settings() {
  const { theme, toggleTheme } = useTheme()
  const { session } = useAuth()

  return (
    <div>
      <h1 className={styles.title}>Settings</h1>

      <div className={styles.row}>
        <div>
          <p>Dark mode</p>
          <p className={styles.hint}>{theme === 'dark' ? 'On' : 'Off'}</p>
        </div>
        <button
          className={styles.switch}
          role="switch"
          aria-checked={theme === 'dark'}
          aria-label="Dark mode"
          onClick={toggleTheme}
        />
      </div>

      <div className={styles.row}>
        <div>
          <p>Signed in as</p>
          <p className={styles.hint}>{session?.user.email}</p>
        </div>
        <button className={`${ui.button} ${ui.quiet}`} onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
