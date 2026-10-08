import { TRACKS, TRACK_IDS } from './tracks'

describe('TRACKS', () => {
  it('defines the four tracks in order', () => {
    expect(TRACK_IDS).toEqual(['math', 'verbal', 'memory', 'focus'])
  })

  it('gives every track a distinct colour variable', () => {
    const colours = TRACK_IDS.map((id) => TRACKS[id].colour)
    expect(new Set(colours).size).toBe(4)
    for (const id of TRACK_IDS) expect(TRACKS[id].colour).toBe(`var(--track-${id})`)
  })
})
