import { initRound, lastResult, roundReducer, type RoundEvent, type RoundState } from './engine'

const play = (events: RoundEvent[], items: string[] = ['a', 'b']) =>
  events.reduce<RoundState<string>>((s, e) => roundReducer(s, e), initRound(items))

describe('round engine', () => {
  it('starts in ready', () => {
    expect(initRound(['a']).phase).toBe('ready')
  })

  it('records an answer with its response time and moves to feedback', () => {
    const s = play([
      { type: 'start', now: 1000 },
      { type: 'answer', correct: true, now: 2500 },
    ])
    expect(s.phase).toBe('feedback')
    expect(lastResult(s)).toEqual({ correct: true, timedOut: false, responseMs: 1500 })
  })

  it('records a timeout as wrong', () => {
    const s = play([
      { type: 'start', now: 0 },
      { type: 'timeout', now: 10000 },
    ])
    expect(lastResult(s)).toEqual({ correct: false, timedOut: true, responseMs: 10000 })
  })

  it('moves to the next item and restarts its clock', () => {
    const s = play([
      { type: 'start', now: 0 },
      { type: 'answer', correct: false, now: 500 },
      { type: 'next', now: 1500 },
    ])
    expect(s).toMatchObject({ phase: 'item', index: 1, itemStartedAt: 1500 })
  })

  it('finishes after the last item', () => {
    const s = play([
      { type: 'start', now: 0 },
      { type: 'answer', correct: true, now: 100 },
      { type: 'next', now: 200 },
      { type: 'answer', correct: true, now: 300 },
      { type: 'next', now: 400 },
    ])
    expect(s.phase).toBe('done')
    expect(s.results).toHaveLength(2)
  })

  it('ignores events in the wrong phase', () => {
    const ready = initRound(['a'])
    expect(roundReducer(ready, { type: 'answer', correct: true, now: 1 })).toBe(ready)
    const item = roundReducer(ready, { type: 'start', now: 0 })
    expect(roundReducer(item, { type: 'start', now: 5 })).toBe(item)
    expect(roundReducer(item, { type: 'next', now: 5 })).toBe(item)
    const feedback = roundReducer(item, { type: 'timeout', now: 5 })
    expect(roundReducer(feedback, { type: 'answer', correct: true, now: 6 })).toBe(feedback)
    expect(roundReducer(feedback, { type: 'timeout', now: 6 })).toBe(feedback)
  })

  it('goes straight to done with no items', () => {
    expect(roundReducer(initRound([]), { type: 'start', now: 0 }).phase).toBe('done')
  })
})
