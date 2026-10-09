import type { Rng } from '@/lib/rng'
import {
  FILL_FROM_LEVEL,
  ITEMS_PER_ROUND,
  LIMIT_MS_L1,
  LIMIT_MS_L20,
  MIN_CONFLICT_SHARE,
  MIN_SWITCHES,
  SWITCH_P_L1,
  SWITCH_P_L20,
  TARGET_SHARE,
} from './levels'

export { ITEMS_PER_ROUND } from './levels'

export type Rule = 'colour' | 'shape' | 'fill'
export type Side = 'left' | 'right'
export type Card = { colour: 'blue' | 'orange'; shape: 'circle' | 'square'; fill: 'solid' | 'outline' }
export type RuleItem = { rule: Rule; card: Card; correct: Side }

/** The attribute value that sorts left / right under each rule. */
export const LEFT = { colour: 'blue', shape: 'circle', fill: 'solid' } as const satisfies Record<Rule, string>
export const RIGHT = { colour: 'orange', shape: 'square', fill: 'outline' } as const satisfies Record<Rule, string>

const MAX_ATTEMPTS = 1000
const clampLevel = (level: number) => Math.min(20, Math.max(1, Math.round(level)))
const lerp = (a: number, b: number, level: number) => a + ((clampLevel(level) - 1) * (b - a)) / 19

export const rulesFor = (level: number): Rule[] =>
  clampLevel(level) >= FILL_FROM_LEVEL ? ['colour', 'shape', 'fill'] : ['colour', 'shape']

export const switchP = (level: number) => lerp(SWITCH_P_L1, SWITCH_P_L20, level)
export const timeLimitMs = (level: number) => Math.round(lerp(LIMIT_MS_L1, LIMIT_MS_L20, level))
export const targetTimeMs = (level: number) => Math.round(TARGET_SHARE * timeLimitMs(level))

export const sideOf = (card: Card, rule: Rule): Side => (card[rule] === LEFT[rule] ? 'left' : 'right')

export const isConflict = (card: Card, rule: Rule, rules: readonly Rule[]) =>
  rules.some((r) => r !== rule && sideOf(card, r) !== sideOf(card, rule))

function randomCard(rules: readonly Rule[], rng: Rng): Card {
  return {
    colour: rng.pick(['blue', 'orange'] as const),
    shape: rng.pick(['circle', 'square'] as const),
    fill: rules.includes('fill') ? rng.pick(['solid', 'outline'] as const) : 'solid',
  }
}

function conflictCard(rule: Rule, rules: readonly Rule[], rng: Rng): Card {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const card = randomCard(rules, rng)
    if (isConflict(card, rule, rules)) return card
  }
  throw new Error('Couldn’t make a conflict card')
}

function ruleSequence(level: number, count: number, rng: Rng): Rule[] {
  const rules = rulesFor(level)
  const p = switchP(level)
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const seq: Rule[] = [rng.pick(rules)]
    for (let i = 1; i < count; i++) {
      const prev = seq[i - 1]!
      seq.push(rng.next() < p ? rng.pick(rules.filter((r) => r !== prev)) : prev)
    }
    const switches = seq.filter((r, i) => i > 0 && r !== seq[i - 1]).length
    if (switches >= MIN_SWITCHES) return seq
  }
  throw new Error(`Couldn’t make a rule sequence for level ${level}`)
}

export function generateItems(level: number, rng: Rng, count = ITEMS_PER_ROUND): RuleItem[] {
  const rules = rulesFor(level)
  const seq = ruleSequence(level, count, rng)
  const cards = seq.map((rule, i) =>
    i > 0 && rule !== seq[i - 1] ? conflictCard(rule, rules, rng) : randomCard(rules, rng),
  )
  // Top up conflicts on random non-conflict cards until the share is met.
  const need = Math.ceil(MIN_CONFLICT_SHARE * count)
  const plain = cards.map((_, i) => i).filter((i) => !isConflict(cards[i]!, seq[i]!, rules))
  let conflicts = count - plain.length
  while (conflicts < need) {
    const pick = plain.splice(rng.int(0, plain.length - 1), 1)[0]!
    cards[pick] = conflictCard(seq[pick]!, rules, rng)
    conflicts++
  }
  return seq.map((rule, i) => ({ rule, card: cards[i]!, correct: sideOf(cards[i]!, rule) }))
}
