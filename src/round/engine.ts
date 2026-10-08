import type { ItemResult } from './types'

export type RoundPhase = 'ready' | 'item' | 'feedback' | 'done'

export type RoundState<Item> = {
  phase: RoundPhase
  items: readonly Item[]
  index: number
  itemStartedAt: number
  results: readonly ItemResult[]
}

/** Every event carries the current time so the engine stays pure and testable. */
export type RoundEvent =
  | { type: 'start'; now: number }
  | { type: 'answer'; correct: boolean; now: number }
  | { type: 'timeout'; now: number }
  | { type: 'next'; now: number }

export function initRound<Item>(items: readonly Item[]): RoundState<Item> {
  return { phase: 'ready', items, index: 0, itemStartedAt: 0, results: [] }
}

export function roundReducer<Item>(state: RoundState<Item>, event: RoundEvent): RoundState<Item> {
  switch (event.type) {
    case 'start':
      if (state.phase !== 'ready') return state
      if (state.items.length === 0) return { ...state, phase: 'done' }
      return { ...state, phase: 'item', index: 0, itemStartedAt: event.now }

    case 'answer':
    case 'timeout': {
      if (state.phase !== 'item') return state
      const result: ItemResult = {
        correct: event.type === 'answer' && event.correct,
        timedOut: event.type === 'timeout',
        responseMs: Math.max(0, event.now - state.itemStartedAt),
      }
      return { ...state, phase: 'feedback', results: [...state.results, result] }
    }

    case 'next': {
      if (state.phase !== 'feedback') return state
      const index = state.index + 1
      if (index >= state.items.length) return { ...state, phase: 'done' }
      return { ...state, phase: 'item', index, itemStartedAt: event.now }
    }
  }
}

export function lastResult<Item>(state: RoundState<Item>): ItemResult | undefined {
  return state.results[state.results.length - 1]
}
