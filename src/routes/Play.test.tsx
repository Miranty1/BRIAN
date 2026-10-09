import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProgressContext } from '@/data/ProgressProvider'
import { createProgressStore } from '@/data/progress'
import { Play } from './Play'

function renderPlay() {
  const saved = JSON.stringify({
    games: {
      'speed-arithmetic': { level: 3, bestScore: 80, roundsPlayed: 4, lastPlayedAt: null },
    },
    outbox: [],
  })
  const store = createProgressStore({
    storage: { getItem: () => saved, setItem: () => {} },
    key: 'test',
    send: async () => ({ ok: true }),
    fetchServer: async () => [],
  })
  render(
    <ProgressContext.Provider value={store}>
      <MemoryRouter>
        <Play />
      </MemoryRouter>
    </ProgressContext.Provider>,
  )
}

describe('Play', () => {
  it('links playable games with their level', () => {
    renderPlay()
    const link = screen.getByRole('link', { name: /Speed Arithmetic/ })
    expect(link).toHaveAttribute('href', '/play/speed-arithmetic')
    expect(link).toHaveTextContent('Level 3')
  })

  it('marks the other 6 games as coming soon', () => {
    renderPlay()
    expect(screen.getAllByText('Coming soon')).toHaveLength(6)
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })
})
