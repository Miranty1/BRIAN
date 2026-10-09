import type { ItemResult } from './types'

// Handoff §3, all [tunable].
export const ACCURACY_WEIGHT = 70
export const SPEED_WEIGHT = 30
export const LEVEL_UP_AT = 80
export const LEVEL_DOWN_AT = 50
export const MIN_LEVEL = 1
export const MAX_LEVEL = 20

export type RoundStats = { accuracy: number; avgResponseMs: number; score: number }

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x))

export function scoreRound(results: readonly ItemResult[], targetTimeMs: number): RoundStats {
  if (results.length === 0) return { accuracy: 0, avgResponseMs: 0, score: 0 }
  const accuracy = results.filter((r) => r.correct).length / results.length
  const avgResponseMs = results.reduce((sum, r) => sum + r.responseMs, 0) / results.length
  const speedFactor = avgResponseMs <= 0 ? 1 : clamp(targetTimeMs / avgResponseMs, 0, 1)
  const score = Math.round(ACCURACY_WEIGHT * accuracy + SPEED_WEIGHT * speedFactor)
  return { accuracy, avgResponseMs, score }
}

export function nextLevel(level: number, score: number): number {
  const delta = score >= LEVEL_UP_AT ? 1 : score <= LEVEL_DOWN_AT ? -1 : 0
  return clamp(level + delta, MIN_LEVEL, MAX_LEVEL)
}

/** A first round counts as a best only if it scored something. */
export function isPersonalBest(prevBest: number | null, score: number): boolean {
  return prevBest === null ? score > 0 : score > prevBest
}
