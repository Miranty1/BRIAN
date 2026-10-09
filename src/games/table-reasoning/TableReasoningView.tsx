import { ChoiceGrid } from '@/components/ChoiceGrid'
import type { ItemViewProps } from '@/games/types'
import { formatValue, type TableItem } from './generate'
import styles from './TableReasoningView.module.css'

export function TableReasoningView({ item, onAnswer, feedback }: ItemViewProps<TableItem, number>) {
  const { table } = item
  return (
    <div className={styles.view}>
      <div className={styles.scroll}>
        <table className={styles.table} aria-label={table.title}>
          <caption className={styles.caption}>{table.title}</caption>
          <thead>
            <tr>
              <th scope="col" />
              {table.columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.values.map((v, i) => (
                  <td key={i}>{formatValue(v, table.unit)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.prompt} data-testid="prompt">
          {item.prompt}
        </p>
      </div>
      <ChoiceGrid
        options={item.options}
        correctIndex={item.correctIndex}
        feedback={feedback}
        onChoose={onAnswer}
      />
    </div>
  )
}
