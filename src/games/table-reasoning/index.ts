import type { GameModule } from '@/games/types'
import {
  generateItems,
  ITEMS_PER_ROUND,
  targetTimeMs,
  timeLimitMs,
  type TableItem,
} from './generate'
import { TableReasoningView } from './TableReasoningView'

export const tableReasoning: GameModule<TableItem, number> = {
  kind: 'items',
  id: 'table-reasoning',
  itemsPerRound: ITEMS_PER_ROUND,
  generate: (level, rng) => generateItems(level, rng, ITEMS_PER_ROUND),
  timeLimitMs,
  targetTimeMs,
  check: (item, index) => index === item.correctIndex,
  answerLabel: (item) => item.options[item.correctIndex]!,
  ItemView: TableReasoningView,
}
