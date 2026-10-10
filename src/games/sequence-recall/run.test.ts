import { createRng } from '@/lib/rng'
import { allowRepeats, flashMs, gapMs, gridSize, startLength, targetLength } from './levels'
import {
  generateSequence,
  initRun,
  nextLength,
  runReducer,
  runResult,
  scoreRun,
  type RunEvent,
  type RunState,
} from './run'

const play = (state: RunState, ...events: RunEvent[]) => events.reduce(runReducer, state)
const tapAll = (seq: number[], start: number) =>
  seq.map((tile, i) => ({ type: 'tap' as const, tile, now: start + (i + 1) * 500 }))

describe('Sequence Recall levels', () => {
  it('grows the grid and start length with level', () => {
    expect([gridSize(1), gridSize(7), gridSize(14)]).toEqual([3, 4, 5])
    expect([startLength(1), startLength(4), startLength(20)]).toEqual([3, 4, 9])
    expect(targetLength(1)).toBe(5)
    expect(flashMs(1)).toBe(700)
    expect(flashMs(20)).toBe(350)
    expect(gapMs(20)).toBe(150)
    expect([allowRepeats(7), allowRepeats(8)]).toEqual([false, true])
  })
})

describe('generateSequence', () => {
  it('stays on the grid, never repeats below L8, never doubles up', () => {
    for (let level = 1; level <= 20; level++) {
      for (let seed = 1; seed <= 100; seed++) {
        const n = gridSize(level) ** 2
        const seq = generateSequence(startLength(level) + 3, level, createRng(seed))
        expect(seq).toHaveLength(startLength(level) + 3)
        seq.forEach((t, i) => {
          expect(t).toBeGreaterThanOrEqual(0)
          expect(t).toBeLessThan(n)
          if (i > 0) expect(t).not.toBe(seq[i - 1])
        })
        if (!allowRepeats(level)) expect(new Set(seq).size).toBe(seq.length)
      }
    }
  })

  it('allows repeats once a sequence is longer than the grid', () => {
    const seq = generateSequence(12, 1, createRng(1)) // 3 × 3 grid
    expect(seq).toHaveLength(12)
    seq.forEach((t, i) => i > 0 && expect(t).not.toBe(seq[i - 1]))
  })
})

describe('run reducer', () => {
  it('grows after a success, holds after a mistake, and ends after two mistakes', () => {
    let s = initRun([0, 1, 2])
    s = play(s, { type: 'shown', now: 0 }, ...tapAll([0, 1, 2], 0))
    expect(s).toMatchObject({
      phase: 'feedback',
      lastOk: true,
      longest: 3,
      successes: 1,
      attempts: 1,
    })
    expect(nextLength(s)).toBe(4)

    s = play(s, { type: 'next', sequence: [3, 4, 5, 6] }, { type: 'shown', now: 5000 })
    s = play(s, { type: 'tap', tile: 3, now: 5500 }, { type: 'tap', tile: 8, now: 6000 })
    expect(s).toMatchObject({
      phase: 'feedback',
      lastOk: false,
      mistakes: 1,
      wrongTile: 8,
      inputIndex: 1,
    })
    expect(nextLength(s)).toBe(4)

    s = play(
      s,
      { type: 'next', sequence: [1, 2, 3, 4] },
      { type: 'shown', now: 9000 },
      { type: 'tap', tile: 0, now: 9500 },
    )
    expect(s.mistakes).toBe(2)
    s = play(s, { type: 'next', sequence: [5, 6, 7, 8] })
    expect(s.phase).toBe('done')
    expect(s).toMatchObject({ longest: 3, attempts: 3, successes: 1 })
  })

  it('ignores taps outside input and events in the wrong phase', () => {
    const s = initRun([0, 1, 2])
    expect(runReducer(s, { type: 'tap', tile: 0, now: 1 })).toBe(s)
    expect(runReducer(s, { type: 'next', sequence: [1] })).toBe(s)
    const shown = runReducer(s, { type: 'shown', now: 0 })
    expect(runReducer(shown, { type: 'shown', now: 5 })).toBe(shown)
  })

  it('caps the gap between taps at 5 s', () => {
    let s = play(initRun([0, 1, 2]), { type: 'shown', now: 0 })
    s = play(s, { type: 'tap', tile: 0, now: 600000 }, { type: 'tap', tile: 1, now: 600400 })
    expect(s.tapMs).toEqual([5000, 400])
  })
})

describe('scoreRun / runResult', () => {
  it('scores steps past the start length the same at every level', () => {
    for (const level of [1, 20]) {
      const start = startLength(level)
      expect(scoreRun(0, level)).toBe(0)
      expect(scoreRun(start, level)).toBe(27)
      expect(scoreRun(start + 1, level)).toBe(53)
      expect(scoreRun(start + 2, level)).toBe(80)
      expect(scoreRun(start + 3, level)).toBe(100)
      expect(scoreRun(start + 9, level)).toBe(100)
    }
  })

  it('reports accuracy, average tap time and the summary stats', () => {
    let s = play(initRun([0, 1, 2]), { type: 'shown', now: 0 }, ...tapAll([0, 1, 2], 0))
    s = play(
      s,
      { type: 'next', sequence: [0, 1, 2, 3] },
      { type: 'shown', now: 0 },
      { type: 'tap', tile: 5, now: 1000 },
    )
    expect(runResult(s, 1)).toEqual({
      score: 27,
      accuracy: 0.5,
      avgResponseMs: 625,
      stats: [
        { label: 'Longest', value: '3' },
        { label: 'Target', value: '5' },
      ],
    })
  })
})
