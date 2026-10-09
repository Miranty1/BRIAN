import type { GameModule } from '@/games/types'
import {
  generateItems,
  ITEMS_PER_ROUND,
  targetTimeMs,
  timeLimitMs,
  type ArithItem,
} from './generate'
import { SpeedArithmeticView } from './SpeedArithmeticView'

export const speedArithmetic: GameModule<ArithItem, string> = {
  kind: 'items',
  id: 'speed-arithmetic',
  itemsPerRound: ITEMS_PER_ROUND,
  generate: (level, rng) => generateItems(level, rng, ITEMS_PER_ROUND),
  timeLimitMs,
  targetTimeMs,
  check: (item, typed) => Number(typed) === item.answer,
  answerLabel: (item) => String(item.answer),
  ItemView: SpeedArithmeticView,
}
