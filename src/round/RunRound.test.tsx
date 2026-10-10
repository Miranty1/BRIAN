import { act, fireEvent, render, screen } from '@testing-library/react'
import { createProgressStore, type PendingRound, type SendResult } from '@/data/progress'
import type { RunGameModule, RunViewProps } from '@/games/types'
import { RunRound } from './RunRound'

function FakeRun({ level, onFinish, onQuit }: RunViewProps) {
  return (
    <>
      <p>running at {level}</p>
      <button
        onClick={() =>
          onFinish({
            score: 80,
            accuracy: 0.75,
            avgResponseMs: 612.4,
            stats: [{ label: 'Longest', value: '5' }],
          })
        }
      >
        finish
      </button>
      <button onClick={onQuit}>quit</button>
    </>
  )
}

const fakeModule: RunGameModule = {
  kind: 'run',
  id: 'sequence-recall',
  readyHint: 'x',
  RunView: FakeRun,
}

function setup() {
  const send = vi.fn(async (_r: PendingRound): Promise<SendResult> => ({ ok: true }))
  const store = createProgressStore({ storage: null, key: 't', send, fetchServer: async () => [] })
  const onQuit = vi.fn()
  render(
    <RunRound
      gameModule={fakeModule}
      gameName="Sequence Recall"
      level={3}
      prevBest={70}
      seed={1}
      store={store}
      onQuit={onQuit}
      onPlayAgain={vi.fn()}
      onDone={vi.fn()}
    />,
  )
  return { send, store, onQuit }
}

describe('RunRound', () => {
  it('hosts the run, then shows the summary with its stats and saves once', async () => {
    const { send, store } = setup()
    expect(screen.getByText('running at 3')).toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByText('finish')))
    expect(screen.getByLabelText('Score 80 out of 100')).toBeInTheDocument()
    expect(screen.getByText('Longest')).toBeInTheDocument()
    expect(screen.getByText('3 → 4')).toBeInTheDocument()
    expect(screen.getByText('New personal best')).toBeInTheDocument()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![0]).toMatchObject({
      gameId: 'sequence-recall',
      level: 3,
      newLevel: 4,
      score: 80,
      accuracy: 0.75,
      avgResponseMs: 612,
    })
    expect(store.getGame('sequence-recall').level).toBe(4)
  })

  it('saves nothing when quit', () => {
    const { send, onQuit } = setup()
    fireEvent.click(screen.getByText('quit'))
    expect(onQuit).toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })
})
