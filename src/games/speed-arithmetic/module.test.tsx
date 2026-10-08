import { fireEvent, render, screen } from '@testing-library/react'
import { getGameModule } from '@/games/registry'
import { createRng } from '@/lib/rng'
import type { ArithItem } from './generate'
import { speedArithmetic } from './index'
import { SpeedArithmeticView } from './SpeedArithmeticView'

const item: ArithItem = { a: 47, b: 8, op: '+', answer: 55 }
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('speedArithmetic module', () => {
  it('checks typed answers numerically', () => {
    expect(speedArithmetic.check(item, '55')).toBe(true)
    expect(speedArithmetic.check(item, '56')).toBe(false)
    expect(speedArithmetic.answerLabel(item)).toBe('55')
  })

  it('generates a round of 10', () => {
    expect(speedArithmetic.generate(1, createRng(1))).toHaveLength(10)
    expect(speedArithmetic.itemsPerRound).toBe(10)
  })

  it('is in the registry; unbuilt and unknown games are not', () => {
    expect(getGameModule('speed-arithmetic')).toBe(speedArithmetic)
    expect(getGameModule('rule-switch')).toBeUndefined()
    expect(getGameModule('nope')).toBeUndefined()
  })
})

describe('SpeedArithmeticView', () => {
  it('shows the problem and submits once enough digits are typed', () => {
    const onAnswer = vi.fn()
    render(<SpeedArithmeticView item={item} onAnswer={onAnswer} feedback={null} />)
    expect(screen.getByTestId('problem')).toHaveTextContent('47 + 8')
    press('5')
    expect(screen.getByTestId('answer')).toHaveTextContent('5')
    press('5')
    expect(onAnswer).toHaveBeenCalledWith('55')
  })

  it('shows the correct answer and locks the pad during feedback', () => {
    const onAnswer = vi.fn()
    render(
      <SpeedArithmeticView
        item={item}
        onAnswer={onAnswer}
        feedback={{ correct: false, answerLabel: '55' }}
      />,
    )
    expect(screen.getByTestId('answer')).toHaveTextContent('55')
    expect(screen.getByTestId('answer')).toHaveAttribute('data-state', 'wrong')
    expect(screen.getByRole('button', { name: '5' })).toBeDisabled()
  })
})
