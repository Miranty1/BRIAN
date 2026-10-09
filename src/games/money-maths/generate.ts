import { makeChoices, makeLabelChoices, shuffle, type ChoiceItem } from '@/games/choices'
import { formatAud, hasCents, roundCents } from '@/lib/money'
import type { Rng } from '@/lib/rng'
import { LEVELS, type MoneyLevel, type ProblemType } from './levels'

export type { ProblemType } from './levels'
export type MoneyItem = ChoiceItem & { type: ProblemType; inputs: Record<string, number> }

export const ITEMS_PER_ROUND = 10
const MAX_ATTEMPTS = 1000

const clampLevel = (level: number) => Math.min(LEVELS.length, Math.max(1, Math.round(level)))
export const levelSpec = (level: number): MoneyLevel => LEVELS[clampLevel(level) - 1]!

const THINGS = ['jacket', 'pair of boots', 'lamp', 'backpack', 'kettle', 'desk chair', 'heater']
const UNIT_SIZES = [250, 300, 375, 400, 500, 600, 750, 1000]

function price(spec: MoneyLevel, rng: Rng): number {
  const { min, max, step, cents } = spec.price
  if (cents) return rng.int(min * 100, max * 100) / 100
  return rng.int(Math.ceil(min / step), Math.floor(max / step)) * step
}

/** Whole-dollar levels nudge to whole dollars; cent levels to cents. */
function moneyChoices(correct: number, distractors: number[], rng: Rng) {
  const values = [correct, ...distractors].map(roundCents)
  const cents = values.some(hasCents)
  return makeChoices(values[0]!, values.slice(1), rng, {
    format: (n) => formatAud(n, cents),
    nudge: (n, r) => {
      const v = n * (1 + (r.next() < 0.5 ? -1 : 1) * (r.int(5, 15) / 100))
      return cents ? roundCents(v) : Math.round(v)
    },
  })
}

function item(
  type: ProblemType,
  prompt: string,
  inputs: Record<string, number>,
  correct: number,
  distractors: number[],
  rng: Rng,
): MoneyItem {
  return { type, prompt, inputs, ...moneyChoices(correct, distractors, rng) }
}

const pct = (n: number) => `${n}%`
const off = (p: number, d: number) => roundCents(p * (1 - d / 100))

function unitLabel(grams: number, cost: number) {
  const size = grams >= 1000 ? `${grams / 1000} kg` : `${grams} g`
  return `${size} for ${formatAud(cost, true)}`
}

function unitPrice(spec: MoneyLevel, rng: Rng): MoneyItem {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sizes = shuffle(UNIT_SIZES, rng).slice(0, spec.unitProducts)
    const per100 = rng.int(50, 300) / 100
    const products = sizes.map((g) => {
      const cost = roundCents((g / 100) * per100 * (1 + rng.int(-15, 15) / 100))
      return { label: unitLabel(g, cost), perGram: cost / g }
    })
    const sorted = [...products].sort((x, y) => x.perGram - y.perGram)
    if (sorted[1]!.perGram < sorted[0]!.perGram * 1.02) continue
    const choices = makeLabelChoices(
      sorted[0]!.label,
      sorted.slice(1).map((p) => p.label),
      rng,
      { count: spec.unitProducts },
    )
    return { type: 'unitPrice', prompt: 'Which is the best value?', inputs: {}, ...choices }
  }
  throw new Error('Couldn’t make a unit price problem')
}

export function makeProblem(type: ProblemType, spec: MoneyLevel, rng: Rng): MoneyItem {
  switch (type) {
    case 'discount': {
      const p = price(spec, rng)
      const d = rng.pick(spec.percents)
      return item(
        type,
        `A ${formatAud(p)} ${rng.pick(THINGS)} is ${pct(d)} off. What do you pay?`,
        { p, d },
        off(p, d),
        [p * (1 + d / 100), (p * d) / 100, p - d],
        rng,
      )
    }
    case 'addGst': {
      const p = price(spec, rng)
      return item(
        type,
        `${formatAud(p)} before GST. What’s the price including 10% GST?`,
        { p },
        p * 1.1,
        [p * 1.2, p, p * 0.1],
        rng,
      )
    }
    case 'removeGst': {
      const p = spec.gstExact ? roundCents(price(spec, rng) * 1.1) : price(spec, rng)
      return item(
        type,
        `${formatAud(p)} including GST. What’s the price before GST?`,
        { p },
        p / 1.1,
        [p * 0.9, p - 10, p * 1.1],
        rng,
      )
    }
    case 'split': {
      const [lo, hi] = spec.splitPeople
      const n = rng.int(lo, hi)
      const t = spec.tips.length > 0 && rng.next() < 0.5 ? rng.pick(spec.tips) : 0
      // Whole-dollar levels split evenly.
      const p = spec.price.cents
        ? price(spec, rng)
        : rng.int(
            Math.ceil(spec.price.min / (n * spec.price.step)),
            Math.floor(spec.price.max / (n * spec.price.step)),
          ) *
          n *
          spec.price.step
      const withTip = p * (1 + t / 100)
      const prompt =
        t === 0
          ? `A ${formatAud(p)} bill is split evenly between ${n} people. How much does each pay?`
          : `A ${formatAud(p)} bill plus a ${pct(t)} tip is split evenly between ${n} people. How much does each pay?`
      const distractors =
        t === 0
          ? [p / (n - 1), p / (n + 1), p / n + n]
          : [p / n, withTip / (n - 1), p / n + (p * t) / 100]
      return item(type, prompt, { p, n, t }, withTip / n, distractors, rng)
    }
    case 'unitPrice':
      return unitPrice(spec, rng)
    case 'markup': {
      const c = price(spec, rng)
      const m = rng.pick(spec.percents)
      return item(
        type,
        `It costs ${formatAud(c)} and is marked up ${pct(m)}. What’s the sale price?`,
        { c, m },
        c * (1 + m / 100),
        [(c * m) / 100, c / (1 - m / 100), c + m],
        rng,
      )
    }
    case 'stackedDiscount': {
      const p = price(spec, rng)
      const a = rng.pick(spec.percents)
      const b = rng.pick(spec.stackedSecond)
      return item(
        type,
        `${formatAud(p)}, ${pct(a)} off, then a further ${pct(b)} off. What’s the final price?`,
        { p, a, b },
        off(off(p, a), b),
        [p * (1 - (a + b) / 100), off(p, a), off(p, b)],
        rng,
      )
    }
    case 'discountThenGst': {
      const p = price(spec, rng)
      const d = rng.pick(spec.percents)
      return item(
        type,
        `${formatAud(p)} before GST, ${pct(d)} off, then GST is added. What’s the total?`,
        { p, d },
        off(p, d) * 1.1,
        [p * (1 + 0.1 - d / 100), off(p, d), p * 1.1],
        rng,
      )
    }
  }
}

/** Distinct problems for one round. Throws only if a level is too narrow (a bug). */
export function generateItems(level: number, rng: Rng, count = ITEMS_PER_ROUND): MoneyItem[] {
  const spec = levelSpec(level)
  const seen = new Set<string>()
  const items: MoneyItem[] = []
  for (let attempt = 0; items.length < count; attempt++) {
    if (attempt >= MAX_ATTEMPTS)
      throw new Error(`Couldn’t generate ${count} items for level ${level}`)
    const next = makeProblem(rng.pick(spec.pool), spec, rng)
    if (seen.has(next.prompt)) continue
    seen.add(next.prompt)
    items.push(next)
  }
  return items
}

/** 40 s at level 1 down to 20 s at level 20. [tunable] */
export const timeLimitMs = (level: number) =>
  Math.round(40000 - ((clampLevel(level) - 1) * 20000) / 19)

export const targetTimeMs = (level: number) => Math.round(0.5 * timeLimitMs(level))
