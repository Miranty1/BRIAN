import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { NumberPad } from './NumberPad'

function Harness(props: { answerLength: number; onSubmit(v: string): void; disabled?: boolean }) {
  const [value, setValue] = useState('')
  return (
    <>
      <output data-testid="value">{value}</output>
      <NumberPad value={value} onChange={setValue} {...props} />
    </>
  )
}

const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('NumberPad', () => {
  it('submits once the typed length matches the answer, then clears', () => {
    const onSubmit = vi.fn()
    render(<Harness answerLength={2} onSubmit={onSubmit} />)
    press('1')
    expect(screen.getByTestId('value')).toHaveTextContent('1')
    expect(onSubmit).not.toHaveBeenCalled()
    press('5')
    expect(onSubmit).toHaveBeenCalledWith('15')
    expect(screen.getByTestId('value')).toHaveTextContent('')
  })

  it('submits a one-digit answer on the first press', () => {
    const onSubmit = vi.fn()
    render(<Harness answerLength={1} onSubmit={onSubmit} />)
    press('0')
    expect(onSubmit).toHaveBeenCalledWith('0')
  })

  it('deletes the last digit', () => {
    const onSubmit = vi.fn()
    render(<Harness answerLength={3} onSubmit={onSubmit} />)
    press('4')
    press('2')
    press('Delete')
    expect(screen.getByTestId('value')).toHaveTextContent('4')
  })

  it('accepts keyboard digits and Backspace', () => {
    const onSubmit = vi.fn()
    render(<Harness answerLength={2} onSubmit={onSubmit} />)
    fireEvent.keyDown(window, { key: '7' })
    fireEvent.keyDown(window, { key: 'Backspace' })
    fireEvent.keyDown(window, { key: '2' })
    fireEvent.keyDown(window, { key: '3' })
    expect(onSubmit).toHaveBeenCalledWith('23')
  })

  it('ignores input when disabled', () => {
    const onSubmit = vi.fn()
    render(<Harness answerLength={1} onSubmit={onSubmit} disabled />)
    press('3')
    fireEvent.keyDown(window, { key: '3' })
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
