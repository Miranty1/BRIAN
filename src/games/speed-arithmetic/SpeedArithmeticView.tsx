import { useState } from 'react'
import { NumberPad } from '@/components/NumberPad'
import type { ItemViewProps } from '@/games/types'
import type { ArithItem } from './generate'
import styles from './SpeedArithmeticView.module.css'

export function SpeedArithmeticView({
  item,
  onAnswer,
  feedback,
}: ItemViewProps<ArithItem, string>) {
  const [typed, setTyped] = useState('')
  const state = feedback ? (feedback.correct ? 'right' : 'wrong') : 'typing'

  return (
    <div className={styles.view}>
      <div className={styles.display}>
        <p className={styles.problem} data-testid="problem">
          {item.a} {item.op} {item.b}
        </p>
        <p className={styles.answer} data-testid="answer" data-state={state} aria-live="polite">
          {feedback ? feedback.answerLabel : typed || ' '}
        </p>
      </div>
      <NumberPad
        value={typed}
        onChange={setTyped}
        answerLength={String(item.answer).length}
        onSubmit={onAnswer}
        disabled={feedback !== null}
      />
    </div>
  )
}
