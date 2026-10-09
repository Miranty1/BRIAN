import type { GameModule } from '@/games/types'
import { generateItems, ITEMS_PER_ROUND, targetTimeMs, timeLimitMs, type MoneyItem } from './generate'
import { MoneyMathsView } from './MoneyMathsView'

export const moneyMaths: GameModule<MoneyItem, number> = {
  kind: 'items',
  id: 'money-maths',
  itemsPerRound: ITEMS_PER_ROUND,
  generate: (level, rng) => generateItems(level, rng, ITEMS_PER_ROUND),
  timeLimitMs,
  targetTimeMs,
  check: (item, index) => index === item.correctIndex,
  answerLabel: (item) => item.options[item.correctIndex]!,
  ItemView: MoneyMathsView,
}
