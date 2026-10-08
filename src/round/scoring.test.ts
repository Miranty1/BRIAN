import { nextLevel, scoreRound } from './scoring'
import type { ItemResult } from './types'

const r = (correct: boolean, responseMs: number, timedOut = false): ItemResult => ({
  correct,
  timedOut,
  responseMs,
})
const many = (n: number, item: ItemResult) => Array.from({ length: n }, () => item)

describe('scoreRound', () => {
  it('scores 100 for all correct at or under the target time', () => {
    expect(scoreRound(many(10, r(true, 1000)), 2000)).toEqual({
      accuracy: 1,
      avgResponseMs: 1000,
      score: 100,
    })
  })

  it('scales the speed part by target / average', () => {
    // 70 * 1 + 30 * (2000 / 4000) = 85
    expect(scoreRound(many(10, r(true, 4000)), 2000).score).toBe(85)
  })

  it('weights accuracy at 70', () => {
    const results = [...many(5, r(true, 2000)), ...many(5, r(false, 2000))]
    // 70 * 0.5 + 30 * 1 = 65
    expect(scoreRound(results, 2000)).toEqual({ accuracy: 0.5, avgResponseMs: 2000, score: 65 })
  })

  it('counts timeouts at their elapsed time', () => {
    // accuracy 0.5, avg 6000, speed 2000/6000 → 35 + 10 = 45
    expect(scoreRound([r(true, 2000), r(false, 10000, true)], 2000)).toEqual({
      accuracy: 0.5,
      avgResponseMs: 6000,
      score: 45,
    })
  })

  it('treats a zero average time as full speed', () => {
    expect(scoreRound(many(3, r(true, 0)), 2000).score).toBe(100)
  })

  it('returns zeros for an empty round', () => {
    expect(scoreRound([], 2000)).toEqual({ accuracy: 0, avgResponseMs: 0, score: 0 })
  })
})

describe('nextLevel', () => {
  it.each([
    [80, 6],
    [100, 6],
    [79, 5],
    [51, 5],
    [50, 4],
    [0, 4],
  ])('score %i at level 5 → level %i', (score, expected) => {
    expect(nextLevel(5, score)).toBe(expected)
  })

  it('clamps to 1–20', () => {
    expect(nextLevel(20, 100)).toBe(20)
    expect(nextLevel(1, 0)).toBe(1)
  })
})
