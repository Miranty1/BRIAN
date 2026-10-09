import type { ComponentType } from 'react'
import type { Rng } from '@/lib/rng'
import type { GameId } from './games'

export type ItemFeedback = { correct: boolean; answerLabel: string }

export type ItemViewProps<Item, Answer> = {
  item: Item
  onAnswer(answer: Answer): void
  /** Set while the round shows feedback for this item; input should be disabled. */
  feedback: ItemFeedback | null
}

/** One line in the end-of-round summary, e.g. { label: 'Accuracy', value: '90%' }. */
export type SummaryStat = { label: string; value: string }

/** What an item-based game plugs into the shared round shell. */
export interface GameModule<Item, Answer> {
  kind: 'items'
  id: GameId
  itemsPerRound: number
  /** Ready-screen text; defaults to "N questions, each against the clock." */
  readyHint?: string
  generate(level: number, rng: Rng): Item[]
  /** Hard per-item limit; running out counts as wrong. */
  timeLimitMs(level: number): number
  /** "Fast" benchmark for the speed part of the score. */
  targetTimeMs(level: number): number
  check(item: Item, answer: Answer): boolean
  /** The correct answer as shown after a miss. */
  answerLabel(item: Item): string
  ItemView: ComponentType<ItemViewProps<Item, Answer>>
}

/** What a run-format game (Sequence Recall) reports when its run ends. */
export type RunResult = {
  score: number
  accuracy: number
  avgResponseMs: number
  stats: SummaryStat[]
}

export type RunViewProps = {
  level: number
  rng: Rng
  onFinish(result: RunResult): void
  onQuit(): void
}

/** A game that runs its own loop and only hands back a result. */
export type RunGameModule = {
  kind: 'run'
  id: GameId
  readyHint: string
  RunView: ComponentType<RunViewProps>
}

// Modules differ in Item/Answer; the shell only passes each module its own values back.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyItemGameModule = GameModule<any, any>
export type AnyGameModule = AnyItemGameModule | RunGameModule
