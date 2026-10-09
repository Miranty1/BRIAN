import { fireEvent, render, screen } from '@testing-library/react'
import { ChoiceGrid } from './ChoiceGrid'

const options = ['$60', '$100', '$20', '$55']

describe('ChoiceGrid', () => {
  it('reports the tapped option', () => {
    const onChoose = vi.fn()
    render(<ChoiceGrid options={options} correctIndex={0} feedback={null} onChoose={onChoose} />)
    fireEvent.click(screen.getByRole('button', { name: '$20' }))
    expect(onChoose).toHaveBeenCalledWith(2)
  })

  it('answers with keys 1–4, ignoring repeats and modifiers', () => {
    const onChoose = vi.fn()
    render(<ChoiceGrid options={options} correctIndex={0} feedback={null} onChoose={onChoose} />)
    fireEvent.keyDown(window, { key: '4', repeat: true })
    fireEvent.keyDown(window, { key: '4', metaKey: true })
    fireEvent.keyDown(window, { key: '5' })
    expect(onChoose).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: '4' })
    expect(onChoose).toHaveBeenCalledWith(3)
  })

  it('only takes the first choice', () => {
    const onChoose = vi.fn()
    render(<ChoiceGrid options={options} correctIndex={0} feedback={null} onChoose={onChoose} />)
    fireEvent.click(screen.getByRole('button', { name: '$20' }))
    fireEvent.click(screen.getByRole('button', { name: '$60' }))
    fireEvent.keyDown(window, { key: '1' })
    expect(onChoose).toHaveBeenCalledTimes(1)
  })

  it('marks a wrong choice and the right answer during feedback, and disables input', () => {
    const onChoose = vi.fn()
    const { rerender } = render(
      <ChoiceGrid options={options} correctIndex={0} feedback={null} onChoose={onChoose} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '$20' }))
    rerender(
      <ChoiceGrid
        options={options}
        correctIndex={0}
        feedback={{ correct: false, answerLabel: '$60' }}
        onChoose={onChoose}
      />,
    )
    expect(screen.getByRole('button', { name: '$20' })).toHaveAttribute('data-state', 'wrong')
    expect(screen.getByRole('button', { name: '$60' })).toHaveAttribute('data-state', 'answer')
    expect(screen.getByRole('button', { name: '$100' })).toBeDisabled()
  })

  it('shows the answer after a timeout with nothing chosen', () => {
    render(
      <ChoiceGrid
        options={options}
        correctIndex={1}
        feedback={{ correct: false, answerLabel: '$100' }}
        onChoose={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '$100' })).toHaveAttribute('data-state', 'answer')
  })

  it('marks a right choice', () => {
    const { rerender } = render(
      <ChoiceGrid options={options} correctIndex={0} feedback={null} onChoose={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '$60' }))
    rerender(
      <ChoiceGrid
        options={options}
        correctIndex={0}
        feedback={{ correct: true, answerLabel: '$60' }}
        onChoose={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '$60' })).toHaveAttribute('data-state', 'right')
  })
})
