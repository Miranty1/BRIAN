import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import ui from '@/components/ui.module.css'
import { supabase } from '@/lib/supabase'
import styles from './Login.module.css'

type Step = 'email' | 'code'

/**
 * Email sign-in with a code as well as the magic link. The code matters on iPhone: an installed
 * home-screen app doesn't share storage with Safari, so a tapped link would sign in Safari instead.
 */
export function Login() {
  const { session, loading } = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function sendCode() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) {
      setError(`Couldn’t send the email: ${error.message}`)
      return false
    }
    return true
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault()
    if (await sendCode()) {
      setCode('')
      setResent(false)
      setStep('code')
    }
  }

  async function onResend() {
    if (await sendCode()) setResent(true)
  }

  async function onCodeSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.replace(/\s/g, ''),
      type: 'email',
    })
    setBusy(false)
    // On success, AuthProvider picks up the new session and this screen redirects home.
    if (error)
      setError('That code is wrong or has expired. Check the latest email, or send a new code.')
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

      {step === 'email' ? (
        <form className={styles.form} onSubmit={onEmailSubmit}>
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
          <button className={ui.button} type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a sign-in code'}
          </button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={onCodeSubmit}>
          <p className={styles.sent} role="status">
            We sent a code to {email}. Enter it below, or open the link in the email on this device.
          </p>
          <label className={styles.label} htmlFor="code">
            Code from the email
          </label>
          <input
            id="code"
            className={`${styles.input} ${styles.code}`}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,10}"
            maxLength={10}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className={ui.button} type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <div className={styles.secondary}>
            <button type="button" className={styles.textButton} onClick={onResend} disabled={busy}>
              Send a new code
            </button>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => {
                setError(null)
                setStep('email')
              }}
            >
              Use a different email
            </button>
          </div>
          {resent && !error && (
            <p className={styles.hint} role="status">
              New code sent. Use the one in the latest email.
            </p>
          )}
        </form>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </main>
  )
}
