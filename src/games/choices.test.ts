import { formatAud, roundCents } from '@/lib/money'
import { createRng } from '@/lib/rng'
import { makeChoices, makeLabelChoices, roundTo, shuffle } from './choices'

const money = {
  format: (n: number) => formatAud(n, true),
  nudge: (n: number, rng: ReturnType<typeof createRng>) =>
    roundCents(n * (1 + (rng.next() < 0.5 ? -1 : 1) * rng.int(5, 15) / 100)),
}

describe('roundTo', () => {
  it('rounds half away from zero', () => {
    expect(roundTo(12.45, 1)).toBe(12.5)
    expect(roundTo(-12.45, 1)).toBe(-12.5)
    expect(roundTo(2.5, 0)).toBe(3)
  })
})

describe('shuffle', () => {
  it('keeps every element and is deterministic per seed', () => {
    const a = shuffle([1, 2, 3, 4, 5], createRng(7))
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5])
    expect(shuffle([1, 2, 3, 4, 5], createRng(7))).toEqual(a)
  })
})

describe('makeChoices', () => {
  it('returns 4 distinct options including the correct one', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const c = makeChoices(60, [100, 20, 55], createRng(seed), money)
      expect(c.options).toHaveLength(4)
      expect(new Set(c.options).size).toBe(4)
      expect(c.options[c.correctIndex]).toBe('$60.00')
    }
  })

  it('treats values that format the same as duplicates and nudges to fill', () => {
    const c = makeChoices(12.5, [12.5, 12.5000001, -3, Number.NaN], createRng(3), money)
    expect(new Set(c.options).size).toBe(4)
    expect(c.options.filter((o) => o === '$12.50')).toHaveLength(1)
    expect(c.options.every((o) => !o.includes('-'))).toBe(true)
  })

  it('allows negatives when asked', () => {
    const pct = {
      format: (n: number) => `${n}%`,
      nudge: (n: number, rng: ReturnType<typeof createRng>) => n + rng.int(2, 9),
      allowNegative: true,
    }
    const c = makeChoices(12, [-12, 10, 30], createRng(1), pct)
    expect(c.options).toContain('-12%')
  })

  it('throws only when nudging can never find distinct values', () => {
    expect(() =>
      makeChoices(1, [], createRng(1), { format: () => 'same', nudge: (n) => n }),
    ).toThrow()
  })
})

describe('makeLabelChoices', () => {
  it('keeps the correct label, drops duplicates and fills from `fill`', () => {
    let i = 0
    const c = makeLabelChoices('3:2', ['2:3', '2:3', '3:2'], createRng(1), {
      fill: () => `${4 + i++}:1`,
    })
    expect(c.options).toHaveLength(4)
    expect(new Set(c.options).size).toBe(4)
    expect(c.options[c.correctIndex]).toBe('3:2')
  })

  it('can return fewer than 4 when asked', () => {
    const c = makeLabelChoices('A', ['B', 'C'], createRng(1), { count: 3 })
    expect([...c.options].sort()).toEqual(['A', 'B', 'C'])
  })
})
