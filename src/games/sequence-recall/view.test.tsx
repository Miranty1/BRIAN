import { act, fireEvent, render, screen } from '@testing-library/react'
import { getGameModule } from '@/games/registry'
import { createRng } from '@/lib/rng'
import { sequenceRecall } from './index'
import { SequenceRecallView } from './SequenceRecallView'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const tiles = () => screen.getAllByRole('button', { name: /^Tile / })

/** Advances through the show, recording the order tiles light up. */
function watch(): number[] {
  const seen: number[] = []
  for (let t = 0; t < 20000 && !screen.queryByText('Your turn'); t += 25) {
    act(() => vi.advanceTimersByTime(25))
    const lit = tiles().findIndex((el) => el.dataset.state === 'lit')
    if (lit >= 0 && seen[seen.length - 1] !== lit) seen.push(lit)
  }
  return seen
}

const tap = (i: number) => fireEvent.click(tiles()[i]!)

describe('sequenceRecall module', () => {
  it('is a registered run game with a hint', () => {
    expect(sequenceRecall.kind).toBe('run')
    expect(sequenceRecall.readyHint).toMatch(/Two mistakes/)
    expect(getGameModule('sequence-recall')).toBe(sequenceRecall)
  })
})

describe('SequenceRecallView', () => {
  it('shows a 3 × 3 grid at L1, plays the sequence, then takes taps', () => {
    const onFinish = vi.fn()
    render(<SequenceRecallView level={1} rng={createRng(5)} onFinish={onFinish} onQuit={vi.fn()} />)
    expect(tiles()).toHaveLength(9)
    expect(screen.getByText('Watch…')).toBeInTheDocument()
    expect(tiles()[0]).toBeDisabled()
    const seq = watch()
    expect(seq).toHaveLength(3)
    expect(tiles()[0]).toBeEnabled()
    seq.forEach(tap)
    expect(tiles().every((t) => t.dataset.state === 'right')).toBe(true)
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByText('Watch…')).toBeInTheDocument()
    expect(watch()).toHaveLength(4)
  })

  it('finishes after two mistakes and reports the result once', () => {
    const onFinish = vi.fn()
    render(<SequenceRecallView level={1} rng={createRng(5)} onFinish={onFinish} onQuit={vi.fn()} />)
    for (let miss = 0; miss < 2; miss++) {
      const seq = watch()
      tap((seq[0]! + 1) % 9)
      expect(screen.getByLabelText(`${1 - miss} mistakes left`)).toBeInTheDocument()
      expect(tiles()[seq[0]!]!.dataset.state).toBe('answer')
      act(() => vi.advanceTimersByTime(1000))
    }
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 0, accuracy: 0 })
  })

  it('leaves no timers running after quitting mid-show', () => {
    const onQuit = vi.fn()
    const { unmount } = render(
      <SequenceRecallView level={1} rng={createRng(5)} onFinish={vi.fn()} onQuit={onQuit} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Quit round' }))
    expect(onQuit).toHaveBeenCalled()
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
