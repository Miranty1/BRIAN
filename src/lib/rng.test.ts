import { createRng } from './rng'

describe('createRng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(
      Array.from({ length: 5 }, () => b.next()),
    )
  })

  it('gives different sequences for different seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next())
  })

  it('returns floats in [0, 1)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const x = rng.next()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('int covers both ends of an inclusive range', () => {
    const rng = createRng(3)
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) seen.add(rng.int(2, 5))
    expect([...seen].sort()).toEqual([2, 3, 4, 5])
  })

  it('pick returns members of the array', () => {
    const rng = createRng(9)
    const items = ['a', 'b', 'c'] as const
    for (let i = 0; i < 100; i++) expect(items).toContain(rng.pick(items))
  })
})
