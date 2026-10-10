import type { RunResult } from '@/games/types'
import type { Rng } from '@/lib/rng'
import {
  allowRepeats,
  gridSize,
  MAX_MISTAKES,
  startLength,
  TAP_GAP_CAP_MS,
  TARGET_STEPS,
  targetLength,
} from './levels'

/** Tiles lit in order. No tile twice in a row; no repeats at all below L8 while the grid has room. */
export function generateSequence(length: number, level: number, rng: Rng): number[] {
  const cells = gridSize(level) ** 2
  const unique = !allowRepeats(level) && length <= cells
  const seq: number[] = []
  while (seq.length < length) {
    const tile = rng.int(0, cells - 1)
    if (tile === seq[seq.length - 1]) continue
    if (unique && seq.includes(tile)) continue
    seq.push(tile)
  }
  return seq
}

export type RunPhase = 'show' | 'input' | 'feedback' | 'done'

export type RunState = {
  phase: RunPhase
  sequence: readonly number[]
  inputIndex: number
  mistakes: number
  longest: number
  attempts: number
  successes: number
  /** Gaps between taps (first tap measured from the end of the show), capped. */
  tapMs: readonly number[]
  lastTapAt: number
  /** Outcome of the attempt just finished; null while one is in progress. */
  lastOk: boolean | null
  wrongTile: number | null
}

/** Every event carries what it needs, so the reducer stays pure. */
export type RunEvent =
  | { type: 'shown'; now: number }
  | { type: 'tap'; tile: number; now: number }
  | { type: 'next'; sequence: number[] }

export function initRun(sequence: number[]): RunState {
  return {
    phase: 'show',
    sequence,
    inputIndex: 0,
    mistakes: 0,
    longest: 0,
    attempts: 0,
    successes: 0,
    tapMs: [],
    lastTapAt: 0,
    lastOk: null,
    wrongTile: null,
  }
}

export function runReducer(state: RunState, event: RunEvent): RunState {
  switch (event.type) {
    case 'shown':
      if (state.phase !== 'show') return state
      return { ...state, phase: 'input', lastTapAt: event.now }

    case 'tap': {
      if (state.phase !== 'input') return state
      const gap = Math.min(TAP_GAP_CAP_MS, Math.max(0, event.now - state.lastTapAt))
      const base = { ...state, tapMs: [...state.tapMs, gap], lastTapAt: event.now }
      if (event.tile !== state.sequence[state.inputIndex]) {
        return {
          ...base,
          phase: 'feedback',
          mistakes: state.mistakes + 1,
          attempts: state.attempts + 1,
          lastOk: false,
          wrongTile: event.tile,
        }
      }
      const inputIndex = state.inputIndex + 1
      if (inputIndex < state.sequence.length) return { ...base, inputIndex }
      return {
        ...base,
        inputIndex,
        phase: 'feedback',
        attempts: state.attempts + 1,
        successes: state.successes + 1,
        longest: Math.max(state.longest, state.sequence.length),
        lastOk: true,
      }
    }

    case 'next':
      if (state.phase !== 'feedback') return state
      if (state.mistakes >= MAX_MISTAKES) return { ...state, phase: 'done' }
      return {
        ...state,
        phase: 'show',
        sequence: event.sequence,
        inputIndex: 0,
        lastOk: null,
        wrongTile: null,
      }
  }
}

/** Length of the next attempt: one longer after a success, the same after a mistake. */
export const nextLength = (state: RunState) => state.sequence.length + (state.lastOk ? 1 : 0)

/** 80 at the target (level up), the same at every level. */
export function scoreRun(longest: number, level: number): number {
  const steps = longest >= startLength(level) ? longest - startLength(level) + 1 : 0
  return Math.min(100, Math.round((80 * steps) / (TARGET_STEPS + 1)))
}

export function runResult(state: RunState, level: number): RunResult {
  const avg = state.tapMs.length ? state.tapMs.reduce((s, x) => s + x, 0) / state.tapMs.length : 0
  return {
    score: scoreRun(state.longest, level),
    accuracy: state.attempts ? state.successes / state.attempts : 0,
    avgResponseMs: Math.round(avg),
    stats: [
      { label: 'Longest', value: String(state.longest) },
      { label: 'Target', value: String(targetLength(level)) },
    ],
  }
}
