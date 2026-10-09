import { createRng } from '@/lib/rng'
import { generateItems, isConflict, rulesFor, sideOf, switchP, targetTimeMs, timeLimitMs, type Card } from './generate'

const card: Card = { colour: 'blue', shape: 'square', fill: 'solid' }

describe('Rule Switch basics', () => {
  it('maps each attribute to a side', () => {
    expect(sideOf(card, 'colour')).toBe('left')
    expect(sideOf(card, 'shape')).toBe('right')
    expect(sideOf(card, 'fill')).toBe('left')
  })

  it('calls a card a conflict when another active rule points the other way', () => {
    expect(isConflict(card, 'colour', ['colour', 'shape'])).toBe(true)
    expect(isConflict({ ...card, shape: 'circle' }, 'colour', ['colour', 'shape'])).toBe(false)
  })

  it('adds fill as a rule from level 14', () => {
    expect(rulesFor(13)).toEqual(['colour', 'shape'])
    expect(rulesFor(14)).toEqual(['colour', 'shape', 'fill'])
  })

  it('switches more often and allows less time as levels rise', () => {
    expect(switchP(1)).toBeCloseTo(1 / 6)
    expect(switchP(20)).toBeCloseTo(1 / 2)
    expect(timeLimitMs(1)).toBe(3000)
    expect(timeLimitMs(20)).toBe(1000)
    expect(targetTimeMs(1)).toBe(1500)
  })
})

describe('Rule Switch generator', () => {
  for (let level = 1; level <= 20; level++) {
    it(`level ${level}: switches, conflicts and answers`, () => {
      const rules = rulesFor(level)
      for (let seed = 1; seed <= 200; seed++) {
        const items = generateItems(level, createRng(seed))
        expect(items).toHaveLength(20)
        let switches = 0
        let conflicts = 0
        items.forEach((item, i) => {
          expect(rules).toContain(item.rule)
          expect(item.correct).toBe(sideOf(item.card, item.rule))
          if (level < 14) expect(item.card.fill).toBe('solid')
          const conflict = isConflict(item.card, item.rule, rules)
          if (conflict) conflicts++
          if (i > 0 && item.rule !== items[i - 1]!.rule) {
            switches++
            expect(conflict).toBe(true)
          }
        })
        expect(switches).toBeGreaterThanOrEqual(2)
        expect(conflicts).toBeGreaterThanOrEqual(12)
      }
    })
  }
})
