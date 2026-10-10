import { formatAud, roundCents } from '@/lib/money'
import { createRng, type Rng } from '@/lib/rng'
import {
  generateItems,
  levelSpec,
  makeProblem,
  targetTimeMs,
  timeLimitMs,
  type MoneyItem,
} from './generate'
import { LEVELS } from './levels'

// 20 levels × 200 seeds; slow under full-suite load.
const SWEEP_TIMEOUT_MS = 30000

/** Independent re-computation of the right answer from the item's inputs. */
function expected(item: MoneyItem): number {
  const { p = 0, d = 0, n = 1, t = 0, c = 0, m = 0, a = 0, b = 0 } = item.inputs
  switch (item.type) {
    case 'discount':
      return roundCents(p * (1 - d / 100))
    case 'addGst':
      return roundCents(p * 1.1)
    case 'removeGst':
      return roundCents(p / 1.1)
    case 'split':
      return roundCents((p * (1 + t / 100)) / n)
    case 'markup':
      return roundCents(c * (1 + m / 100))
    case 'stackedDiscount':
      return roundCents(roundCents(p * (1 - a / 100)) * (1 - b / 100))
    case 'discountThenGst':
      return roundCents(roundCents(p * (1 - d / 100)) * 1.1)
    case 'unitPrice':
      return Number.NaN
  }
}

/** "500 g for $4.20" / "1 kg for $9.00" → price per gram. */
function perGram(label: string): number {
  const m = /^([\d.]+) (g|kg) for \$([\d,.]+)$/.exec(label)!
  const grams = Number(m[1]) * (m[2] === 'kg' ? 1000 : 1)
  return Number(m[3]!.replace(/,/g, '')) / grams
}

const fixedRng = (): Rng => createRng(42)

describe('Money Maths generator', () => {
  it('has a spec for every level', () => {
    expect(LEVELS).toHaveLength(20)
  })

  for (let level = 1; level <= 20; level++) {
    it(
      `level ${level}: items fit the level and the answers are right`,
      () => {
        const spec = levelSpec(level)
        for (let seed = 1; seed <= 200; seed++) {
          const items = generateItems(level, createRng(seed))
          expect(items).toHaveLength(10)
          expect(new Set(items.map((i) => i.prompt)).size).toBe(10)
          for (const item of items) {
            expect(spec.pool).toContain(item.type)
            expect(new Set(item.options).size).toBe(item.options.length)
            const correct = item.options[item.correctIndex]!
            if (item.type === 'unitPrice') {
              expect(item.options).toHaveLength(spec.unitProducts)
              const best = Math.min(...item.options.map(perGram))
              expect(perGram(correct)).toBe(best)
              const rest = item.options.filter((o) => o !== correct).map(perGram)
              expect(Math.min(...rest)).toBeGreaterThanOrEqual(best * 1.02)
            } else {
              expect(item.options).toHaveLength(4)
              const usesCents = item.options.some((o) => o.includes('.'))
              expect(correct).toBe(formatAud(expected(item), usesCents))
              // One style per item: all options with cents, or none.
              expect(item.options.every((o) => o.includes('.') === usesCents)).toBe(true)
            }
          }
        }
      },
      SWEEP_TIMEOUT_MS,
    )
  }

  it('uses only simple types and round prices at levels 1–4', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const item of generateItems(1, createRng(seed))) {
        expect(['discount', 'addGst', 'split']).toContain(item.type)
        expect(item.inputs.p! % 10).toBe(0)
        expect([10, 20, 25, 50, 0]).toContain(item.inputs.d ?? 0)
        if (item.type === 'split') {
          expect(item.inputs.t).toBe(0)
          expect(item.inputs.p! % item.inputs.n!).toBe(0)
        }
      }
    }
  })

  it('removing GST from $110 gives $100, with the ×0.9 trap among the options', () => {
    const spec = { ...levelSpec(7), price: { min: 100, max: 100, step: 1, cents: false } }
    const item = makeProblem('removeGst', spec, fixedRng())
    expect(item.prompt).toContain('$110')
    // Every option is whole dollars here, so none show cents.
    expect(item.options[item.correctIndex]).toBe('$100')
    expect(item.options).toContain('$99')
  })

  it('20% then 10% off $250 is $180, with the "30% off" trap among the options', () => {
    const spec = {
      ...levelSpec(15),
      price: { min: 250, max: 250, step: 1, cents: false },
      percents: [20],
      stackedSecond: [10],
    }
    const item = makeProblem('stackedDiscount', spec, fixedRng())
    expect(item.options[item.correctIndex]).toBe('$180')
    expect(item.options).toContain('$175')
  })

  it('shrinks the time limit from 40 s to 20 s, with a 50% target', () => {
    expect(timeLimitMs(1)).toBe(40000)
    expect(timeLimitMs(20)).toBe(20000)
    expect(targetTimeMs(1)).toBe(20000)
    expect(timeLimitMs(0)).toBe(40000)
    expect(timeLimitMs(99)).toBe(20000)
  })
})
