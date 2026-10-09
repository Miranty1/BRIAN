import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import type { ProgressStore, RoundInput } from '@/data/progress'
import { useSaveRound } from './useSaveRound'

const input: RoundInput = {
  gameId: 'speed-arithmetic',
  level: 1,
  newLevel: 2,
  score: 90,
  accuracy: 1,
  avgResponseMs: 1000,
}

function Harness({ store }: { store: ProgressStore }) {
  const [ready, setReady] = useState<RoundInput | null>(null)
  const [, force] = useState(0)
  const status = useSaveRound(store, ready)
  return (
    <>
      <p data-testid="status">{status}</p>
      <button onClick={() => setReady(input)}>finish</button>
      <button onClick={() => force((n) => n + 1)}>rerender</button>
      <button onClick={() => setReady({ ...input })}>new object</button>
    </>
  )
}

const fakeStore = (impl: ProgressStore['recordRound']) =>
  ({ recordRound: vi.fn(impl) }) as unknown as ProgressStore & {
    recordRound: ReturnType<typeof vi.fn>
  }

describe('useSaveRound', () => {
  it('waits for input, saves exactly once, and reports the status', async () => {
    const store = fakeStore(async () => 'synced')
    render(<Harness store={store} />)
    expect(screen.getByTestId('status')).toHaveTextContent('saving')
    expect(store.recordRound).not.toHaveBeenCalled()

    await act(async () => screen.getByText('finish').click())
    await act(async () => screen.getByText('rerender').click())
    await act(async () => screen.getByText('new object').click())

    expect(store.recordRound).toHaveBeenCalledTimes(1)
    expect(store.recordRound).toHaveBeenCalledWith(input)
    expect(screen.getByTestId('status')).toHaveTextContent('synced')
  })

  it('shows pending when the save throws', async () => {
    const store = fakeStore(async () => {
      throw new Error('boom')
    })
    render(<Harness store={store} />)
    await act(async () => screen.getByText('finish').click())
    expect(screen.getByTestId('status')).toHaveTextContent('pending')
  })
})
