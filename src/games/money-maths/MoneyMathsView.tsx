import { ChoiceGrid } from '@/components/ChoiceGrid'
import type { ItemViewProps } from '@/games/types'
import type { MoneyItem } from './generate'
import styles from './MoneyMathsView.module.css'

export function MoneyMathsView({ item, onAnswer, feedback }: ItemViewProps<MoneyItem, number>) {
  return (
    <div className={styles.view}>
      <p className={styles.prompt} data-testid="prompt">
        {item.prompt}
      </p>
      <ChoiceGrid
        options={item.options}
        correctIndex={item.correctIndex}
        feedback={feedback}
        onChoose={onAnswer}
      />
    </div>
  )
}
