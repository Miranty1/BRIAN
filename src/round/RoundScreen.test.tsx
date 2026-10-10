import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProgressContext } from '@/data/ProgressProvider'
import { createProgressStore, type PendingRound, type SendResult } from '@/data/progress'
import { moneyMaths } from '@/games/money-maths'
import { createRng } from '@/lib/rng'
import { RoundScreen } from './RoundScreen'

function solve(text: string) {
  const [a, op, b] = text.split(' ')
  const x = Number(a)
  const y = Number(b)
  return String(op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y)
}
/** Same length as the answer but different, so the pad auto-submits a wrong answer. */
const wrongFor = (answer: string) =>
  answer
    .split('')
    .map((d) => (d === '9' ? '8' : String(Number(d) + 1)))
    .join('')
const type = (digits: string) => {
  for (const d of digits) fireEvent.click(screen.getByRole('button', { name: d }))
}
const problem = () => screen.getByTestId('problem').textContent!
const flushPromises = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve()
  })

const tiles = () => screen.getAllByRole('button', { name: /^Tile / })
const tapTile = (i: number) => fireEvent.click(tiles()[i]!)
function watch(): number[] {
  const seen: number[] = []
  for (let t = 0; t < 20000 && !screen.queryByText('Your turn'); t += 25) {
    act(() => vi.advanceTimersByTime(25))
    const lit = tiles().findIndex((el) => el.dataset.state === 'lit')
    if (lit >= 0 && seen[seen.length - 1] !== lit) seen.push(lit)
  }
  return seen
}

function renderRound(path = '/play/speed-arithmetic') {
  const send = vi.fn(async (_round: PendingRound): Promise<SendResult> => ({ ok: true }))
  const store = createProgressStore({
    storage: null,
    key: 'test',
    send,
    fetchServer: async () => [],
  })
  render(
    <ProgressContext.Provider value={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/play" element={<p>games list</p>} />
          <Route path="/play/:gameId" element={<RoundScreen />} />
        </Routes>
      </MemoryRouter>
    </ProgressContext.Provider>,
  )
  return { store, send }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('RoundScreen', () => {
  it('plays a full round, shows the summary and saves it', async () => {
    const { store, send } = renderRound()
    expect(screen.getByText('Level 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    for (let i = 0; i < 10; i++) {
      type(solve(problem()))
      act(() => vi.advanceTimersByTime(250))
    }

    expect(screen.getByLabelText('Score 100 out of 100')).toBeInTheDocument()
    expect(screen.getByText('1 → 2')).toBeInTheDocument()
    expect(screen.getByText('New personal best')).toBeInTheDocument()
    await flushPromises()
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![0]).toMatchObject({
      gameId: 'speed-arithmetic',
      level: 1,
      newLevel: 2,
      score: 100,
      accuracy: 1,
    })
    expect(store.getGame('speed-arithmetic').level).toBe(2)
  })

  it('shows the default hint for a game without its own', () => {
    renderRound()
    expect(screen.getByText('10 questions, each against the clock.')).toBeInTheDocument()
  })

  it('does not let time spent backgrounded inflate the average response time', () => {
    renderRound()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    // The app freezes mid-item; the overdue timer fires only on return.
    act(() => vi.setSystemTime(Date.now() + 300000))
    act(() => vi.advanceTimersByTime(10000))
    act(() => vi.advanceTimersByTime(1000)) // wrong-answer pause
    for (let i = 1; i < 10; i++) {
      type(solve(problem()))
      act(() => vi.advanceTimersByTime(250))
    }
    const avg = screen.getByText('Average time').nextElementSibling!.textContent!
    expect(parseFloat(avg)).toBeLessThanOrEqual(10) // level 1 limit
  })

  it('shows the right answer after a wrong answer and after a timeout', () => {
    renderRound()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    const first = solve(problem())
    type(wrongFor(first))
    expect(screen.getByTestId('answer')).toHaveTextContent(first)
    expect(screen.getByTestId('stage')).toHaveAttribute('data-feedback', 'wrong')

    act(() => vi.advanceTimersByTime(1000))
    const second = solve(problem())
    act(() => vi.advanceTimersByTime(10000)) // level 1 limit
    expect(screen.getByTestId('answer')).toHaveTextContent(second)
    expect(screen.getByTestId('stage')).toHaveAttribute('data-feedback', 'wrong')
  })

  it('saves nothing when you quit mid-round', () => {
    const { store, send } = renderRound()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    type(solve(problem()))
    fireEvent.click(screen.getByRole('button', { name: 'Quit round' }))
    expect(screen.getByText('games list')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(20000))
    expect(send).not.toHaveBeenCalled()
    expect(store.getGame('speed-arithmetic').roundsPlayed).toBe(0)
  })

  it('sends unknown or unbuilt games back to the library', () => {
    renderRound('/play/detail-recall')
    expect(screen.getByText('games list')).toBeInTheDocument()
  })

  it('plays a full Money Maths round with the choice grid', async () => {
    vi.setSystemTime(1234)
    const items = moneyMaths.generate(1, createRng(1234)) // RoundScreen seeds with Date.now()
    const { send } = renderRound('/play/money-maths')
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    for (const it of items) {
      fireEvent.click(screen.getByRole('button', { name: moneyMaths.answerLabel(it) }))
      act(() => vi.advanceTimersByTime(250))
    }
    expect(screen.getByLabelText('Score 100 out of 100')).toBeInTheDocument()
    await flushPromises()
    expect(send.mock.calls[0]![0]).toMatchObject({ gameId: 'money-maths', accuracy: 1 })
  })

  it('plays a Sequence Recall run to the target and levels up', async () => {
    const { send } = renderRound('/play/sequence-recall')
    expect(screen.getByText(/Two mistakes ends the run/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    for (let attempt = 0; attempt < 3; attempt++) {
      watch().forEach(tapTile)
      act(() => vi.advanceTimersByTime(400))
    }
    for (let miss = 0; miss < 2; miss++) {
      const seq = watch()
      tapTile((seq[0]! + 1) % 9)
      act(() => vi.advanceTimersByTime(1000))
    }
    expect(screen.getByLabelText('Score 80 out of 100')).toBeInTheDocument()
    expect(screen.getByText('1 → 2')).toBeInTheDocument()
    await flushPromises()
    expect(send.mock.calls[0]![0]).toMatchObject({
      gameId: 'sequence-recall',
      score: 80,
      newLevel: 2,
    })
  })
})
