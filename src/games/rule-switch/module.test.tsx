import { fireEvent, render, screen } from '@testing-library/react'
import { getGameModule } from '@/games/registry'
import { createRng } from '@/lib/rng'
import type { RuleItem } from './generate'
import { ruleSwitch } from './index'
import { RuleSwitchView } from './RuleSwitchView'

const item: RuleItem = {
  rule: 'shape',
  card: { colour: 'blue', shape: 'square', fill: 'solid' },
  correct: 'right',
}

describe('ruleSwitch module', () => {
  it('checks the side and labels the answer with the rule', () => {
    expect(ruleSwitch.check(item, 'right')).toBe(true)
    expect(ruleSwitch.check(item, 'left')).toBe(false)
    expect(ruleSwitch.answerLabel(item)).toBe('Right — shape')
    expect(ruleSwitch.itemsPerRound).toBe(20)
    expect(ruleSwitch.readyHint).toMatch(/rule can change/)
    expect(ruleSwitch.generate(1, createRng(1))).toHaveLength(20)
    expect(getGameModule('rule-switch')).toBe(ruleSwitch)
  })
})

describe('RuleSwitchView', () => {
  it('shows the cue and side labels for the current rule', () => {
    render(<RuleSwitchView item={item} onAnswer={vi.fn()} feedback={null} />)
    expect(screen.getByTestId('cue')).toHaveTextContent('SHAPE')
    expect(screen.getByRole('button', { name: 'Left: circle' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Right: square' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Blue solid square' })).toBeInTheDocument()
  })

  it('answers by tap or arrow key, once, ignoring repeats', () => {
    const onAnswer = vi.fn()
    render(<RuleSwitchView item={item} onAnswer={onAnswer} feedback={null} />)
    fireEvent.keyDown(window, { key: 'ArrowLeft', repeat: true })
    expect(onAnswer).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.click(screen.getByRole('button', { name: 'Left: circle' }))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledWith('right')
  })

  it('locks input and marks the right side during feedback', () => {
    const onAnswer = vi.fn()
    render(
      <RuleSwitchView
        item={item}
        onAnswer={onAnswer}
        feedback={{ correct: false, answerLabel: 'Right — shape' }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Right: square' })).toHaveAttribute(
      'data-state',
      'answer',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Left: circle' }))
    expect(onAnswer).not.toHaveBeenCalled()
  })
})
