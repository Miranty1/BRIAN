import { useEffect, useRef, useState } from 'react'
import type { ItemFeedback } from '@/games/types'
import styles from './ChoiceGrid.module.css'

type Props = {
  options: readonly string[]
  correctIndex: number
  /** Set during feedback; input is locked. */
  feedback: ItemFeedback | null
  onChoose(index: number): void
}

type State = 'idle' | 'right' | 'wrong' | 'answer'

export function ChoiceGrid({ options, correctIndex, feedback, onChoose }: Props) {
  const [chosen, setChosen] = useState<number | null>(null)
  // A ref as well as state, so two taps in the same frame can't both get through.
  const locked = useRef(false)

  function choose(index: number) {
    if (feedback || locked.current || index < 0 || index >= options.length) return
    locked.current = true
    setChosen(index)
    onChoose(index)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (!/^[1-4]$/.test(e.key)) return
      e.preventDefault()
      choose(Number(e.key) - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function stateOf(i: number): State {
    if (!feedback) return 'idle'
    if (i === chosen) return feedback.correct ? 'right' : 'wrong'
    if (!feedback.correct && i === correctIndex) return 'answer'
    return 'idle'
  }

  return (
    <div className={styles.grid} role="group" aria-label="Answers">
      {options.map((label, i) => (
        <button
          key={label}
          type="button"
          className={styles.option}
          data-state={stateOf(i)}
          disabled={feedback !== null || chosen !== null}
          onClick={() => choose(i)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
