import type { GameModule } from '@/games/types'
import {
  generateItems,
  ITEMS_PER_ROUND,
  targetTimeMs,
  timeLimitMs,
  type RuleItem,
  type Side,
} from './generate'
import { RuleSwitchView } from './RuleSwitchView'

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

export const ruleSwitch: GameModule<RuleItem, Side> = {
  kind: 'items',
  id: 'rule-switch',
  itemsPerRound: ITEMS_PER_ROUND,
  readyHint: 'Sort each card by the rule shown. The rule can change at any time.',
  generate: (level, rng) => generateItems(level, rng, ITEMS_PER_ROUND),
  timeLimitMs,
  targetTimeMs,
  check: (item, side) => side === item.correct,
  answerLabel: (item) => `${cap(item.correct)} — ${item.rule}`,
  ItemView: RuleSwitchView,
}
