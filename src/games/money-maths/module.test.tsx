import { fireEvent, render, screen } from '@testing-library/react'
import { getGameModule } from '@/games/registry'
import { createRng } from '@/lib/rng'
import type { MoneyItem } from './generate'
import { moneyMaths } from './index'
import { MoneyMathsView } from './MoneyMathsView'

const item: MoneyItem = {
  type: 'discount',
  prompt: 'A $80 jacket is 25% off. What do you pay?',
  inputs: { p: 80, d: 25 },
  options: ['$100', '$60', '$20', '$55'],
  correctIndex: 1,
}

describe('moneyMaths module', () => {
  it('checks the chosen index and labels the answer', () => {
    expect(moneyMaths.check(item, 1)).toBe(true)
    expect(moneyMaths.check(item, 0)).toBe(false)
    expect(moneyMaths.answerLabel(item)).toBe('$60')
  })

  it('generates a round of 10 and is registered', () => {
    expect(moneyMaths.generate(1, createRng(1))).toHaveLength(10)
    expect(getGameModule('money-maths')).toBe(moneyMaths)
  })
})

describe('MoneyMathsView', () => {
  it('shows the prompt and answers with the tapped index', () => {
    const onAnswer = vi.fn()
    render(<MoneyMathsView item={item} onAnswer={onAnswer} feedback={null} />)
    expect(screen.getByText(item.prompt)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '$60' }))
    expect(onAnswer).toHaveBeenCalledWith(1)
  })
})
