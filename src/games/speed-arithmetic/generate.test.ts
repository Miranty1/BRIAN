import { createRng } from '@/lib/rng'
import { generateItems, opsFor, targetTimeMs, timeLimitMs, type ArithItem } from './generate'
import { LEVELS, type Range } from './levels'

const inRange = (n: number, [min, max]: Range) => n >= min && n <= max
const compute = ({ a, b, op }: ArithItem) =>
  op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b

describe('Speed Arithmetic generator', () => {
  it('has a spec for every level 1–20', () => {
    expect(LEVELS).toHaveLength(20)
  })

  for (let level = 1; level <= 20; level++) {
    it(`level ${level}: every item fits the level's rules`, () => {
      const spec = LEVELS[level - 1]!
      const ops = opsFor(spec)
      const [r1, r2] = spec.addSub
      for (let seed = 1; seed <= 200; seed++) {
        const items = generateItems(level, createRng(seed), 10)
        expect(items).toHaveLength(10)
        expect(new Set(items.map((i) => `${i.a}${i.op}${i.b}`)).size).toBe(10)
        for (const item of items) {
          expect(ops).toContain(item.op)
          expect(item.answer).toBe(compute(item))
          expect(Number.isInteger(item.answer)).toBe(true)
          expect(item.answer).toBeGreaterThanOrEqual(0)
          switch (item.op) {
            case '+':
              expect(inRange(item.a, r1) && inRange(item.b, r2)).toBe(true)
              break
            case '−': {
              const span: Range = [Math.min(r1[0], r2[0]), Math.max(r1[1], r2[1])]
              expect(item.a).toBeGreaterThanOrEqual(item.b)
              expect(inRange(item.a, span) && inRange(item.b, span)).toBe(true)
              break
            }
            case '×':
              expect(inRange(item.a, spec.mul![0]) && inRange(item.b, spec.mul![1])).toBe(true)
              break
            case '÷': {
              const div = spec.div!
              expect(inRange(item.b, div.divisor)).toBe(true)
              if ('quotient' in div) expect(inRange(item.answer, div.quotient)).toBe(true)
              else expect(inRange(item.a, div.dividend)).toBe(true)
              break
            }
          }
        }
      }
    })
  }

  it('uses only + and − at first, then adds × and ÷', () => {
    expect(opsFor(LEVELS[0]!)).toEqual(['+', '−'])
    expect(opsFor(LEVELS[3]!)).toEqual(['+', '−', '×'])
    expect(opsFor(LEVELS[5]!)).toEqual(['+', '−', '×', '÷'])
  })

  it('shrinks the time limit from 10 s to 5 s, with a 40% target', () => {
    expect(timeLimitMs(1)).toBe(10000)
    expect(timeLimitMs(10)).toBe(7632)
    expect(timeLimitMs(20)).toBe(5000)
    expect(targetTimeMs(1)).toBe(4000)
    expect(targetTimeMs(20)).toBe(2000)
  })

  it('is repeatable for a seed', () => {
    expect(generateItems(7, createRng(5))).toEqual(generateItems(7, createRng(5)))
  })
})
