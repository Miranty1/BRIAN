import { GAMES } from './games'
import { TRACK_IDS } from './tracks'

describe('GAMES', () => {
  it('has the 9 games with unique ids', () => {
    expect(GAMES).toHaveLength(9)
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(9)
  })

  it('splits 3 / 3 / 2 / 1 across tracks', () => {
    const counts = TRACK_IDS.map((t) => GAMES.filter((g) => g.track === t).length)
    expect(counts).toEqual([3, 3, 2, 1])
  })
})
