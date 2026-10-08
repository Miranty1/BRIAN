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

/** What a game plugs into the shared round shell. */
export interface GameModule<Item, Answer> {
  id: GameId
  itemsPerRound: number
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

// Modules differ in Item/Answer; the shell only passes each module its own values back.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameModule = GameModule<any, any>
