import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import ui from '@/components/ui.module.css'
import { supabase } from '@/lib/supabase'
import styles from './Login.module.css'

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string }

export function Login() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  if (!loading && session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus({ kind: 'sending' })
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setStatus(error ? { kind: 'error', message: error.message } : { kind: 'sent', email })
  }

  return (
    <main className={styles.page}>
      <div className={styles.mark} aria-hidden="true">
        <span style={{ background: 'var(--track-math)' }} />
        <span style={{ background: 'var(--track-verbal)' }} />
        <span style={{ background: 'var(--track-memory)' }} />
        <span style={{ background: 'var(--track-focus)' }} />
      </div>
      <h1 className={styles.title}>BRIAN</h1>
      <p className={styles.lede}>Five minutes of training a day.</p>

      {status.kind === 'sent' ? (
        <p className={styles.sent} role="status">
          Check {status.email} for a sign-in link. You can close this tab once you’ve opened it.
        </p>
      ) : (
        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className={styles.input}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className={ui.button} type="submit" disabled={status.kind === 'sending'}>
            {status.kind === 'sending' ? 'Sending link…' : 'Email me a sign-in link'}
          </button>
          {status.kind === 'error' && (
            <p className={styles.error} role="alert">
              Couldn’t send the link: {status.message}
            </p>
          )}
        </form>
      )}
    </main>
  )
}
