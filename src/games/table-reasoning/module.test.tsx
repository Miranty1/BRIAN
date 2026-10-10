import { fireEvent, render, screen, within } from '@testing-library/react'
import { getGameModule } from '@/games/registry'
import { createRng } from '@/lib/rng'
import type { TableItem } from './generate'
import { tableReasoning } from './index'
import { TableReasoningView } from './TableReasoningView'

const item: TableItem = {
  type: 'difference',
  prompt: 'How much higher were sales for Store A than for Store B in Feb?',
  table: {
    title: 'Sales by store ($)',
    unit: '$',
    rowNoun: 'store',
    colNoun: 'month',
    measure: 'sales',
    be: 'were',
    columns: ['Jan', 'Feb'],
    rows: [
      { label: 'Store A', values: [1200, 1500] },
      { label: 'Store B', values: [900, 1100] },
    ],
  },
  options: ['$400', '$300', '$2,600', '$350'],
  correctIndex: 0,
}

describe('tableReasoning module', () => {
  it('checks the chosen index and is registered', () => {
    expect(tableReasoning.check(item, 0)).toBe(true)
    expect(tableReasoning.answerLabel(item)).toBe('$400')
    expect(tableReasoning.generate(1, createRng(1))).toHaveLength(10)
    expect(getGameModule('table-reasoning')).toBe(tableReasoning)
  })
})

describe('TableReasoningView', () => {
  it('renders the table with headers and formatted cells', () => {
    render(<TableReasoningView item={item} onAnswer={vi.fn()} feedback={null} />)
    const table = screen.getByRole('table', { name: 'Sales by store ($)' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['', 'Jan', 'Feb'])
    expect(within(table).getByRole('rowheader', { name: 'Store A' })).toBeInTheDocument()
    expect(within(table).getByText('$1,500')).toBeInTheDocument()
  })

  it('answers with the tapped index', () => {
    const onAnswer = vi.fn()
    render(<TableReasoningView item={item} onAnswer={onAnswer} feedback={null} />)
    fireEvent.click(screen.getByRole('button', { name: '$300' }))
    expect(onAnswer).toHaveBeenCalledWith(1)
  })
})
