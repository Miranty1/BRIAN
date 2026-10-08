import { useEffect } from 'react'
import styles from './NumberPad.module.css'

type Props = {
  value: string
  onChange(value: string): void
  /** Submits automatically once this many digits are typed. */
  answerLength: number
  onSubmit(value: string): void
  disabled?: boolean
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export function NumberPad({ value, onChange, answerLength, onSubmit, disabled = false }: Props) {
  function press(digit: string) {
    if (disabled) return
    const next = value + digit
    if (next.length >= answerLength) {
      onChange('')
      onSubmit(next)
    } else {
      onChange(next)
    }
  }

  function backspace() {
    if (!disabled) onChange(value.slice(0, -1))
  }

  // Desktop keyboard. Re-subscribes each render so the handler sees the current value.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        press(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        backspace()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className={styles.pad} role="group" aria-label="Number pad">
      {DIGITS.map((d) => (
        <button
          key={d}
          type="button"
          className={styles.key}
          onClick={() => press(d)}
          disabled={disabled}
        >
          {d}
        </button>
      ))}
      <span aria-hidden="true" />
      <button type="button" className={styles.key} onClick={() => press('0')} disabled={disabled}>
        0
      </button>
      <button
        type="button"
        className={`${styles.key} ${styles.back}`}
        onClick={backspace}
        disabled={disabled}
        aria-label="Delete"
      >
        ⌫
      </button>
    </div>
  )
}
