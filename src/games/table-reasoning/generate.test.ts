import { createRng } from '@/lib/rng'
import { formatPct, formatValue, generateItems, levelSpec, pctChange, targetTimeMs, timeLimitMs } from './generate'
import { LEVELS } from './levels'

describe('Table Reasoning helpers', () => {
  it('formats values by unit and percentages with a sign', () => {
    expect(formatValue(1200, '$')).toBe('$1,200')
    expect(formatValue(1200, 'units')).toBe('1,200')
    expect(formatValue(36, 'hours')).toBe('36 h')
    expect(formatPct(12, 0)).toBe('+12%')
    expect(formatPct(-8.25, 1)).toBe('−8.3%')
    expect(formatPct(0, 0)).toBe('0%')
  })

  it('computes % change from the old value', () => {
    expect(pctChange(80, 100)).toBe(25)
    expect(pctChange(100, 80)).toBe(-20)
  })
})

describe('Table Reasoning generator', () => {
  it('has a spec for every level', () => {
    expect(LEVELS).toHaveLength(20)
  })

  for (let level = 1; level <= 20; level++) {
    it(`level ${level}: tables and questions fit the level`, () => {
      const spec = levelSpec(level)
      for (let seed = 1; seed <= 200; seed++) {
        const items = generateItems(level, createRng(seed))
        expect(items).toHaveLength(10)
        expect(new Set(items.map((i) => i.prompt)).size).toBe(10)
        for (const item of items) {
          const { rows, columns } = item.table
          expect(spec.pool).toContain(item.type)
          expect(rows).toHaveLength(spec.rows)
          expect(columns).toHaveLength(spec.cols)
          for (const row of rows) {
            expect(row.values).toHaveLength(spec.cols)
            for (const v of row.values) {
              expect(Number.isInteger(v)).toBe(true)
              expect(v).toBeGreaterThanOrEqual(spec.values.min)
              expect(v).toBeLessThanOrEqual(spec.values.max)
              expect(v % spec.values.step).toBe(0)
            }
          }
          expect(item.options).toHaveLength(4)
          expect(new Set(item.options).size).toBe(4)
          expect(item.correctIndex).toBeGreaterThanOrEqual(0)
        }
      }
    })
  }

  it('makes pickRow traps: largest % change and largest absolute change are different rows', () => {
    for (let seed = 1; seed <= 300; seed++) {
      for (const item of generateItems(17, createRng(seed))) {
        if (item.type !== 'pickRow') continue
        const last = item.table.columns.length - 1
        const byPct = [...item.table.rows].sort(
          (a, b) => pctChange(b.values[0]!, b.values[last]!) - pctChange(a.values[0]!, a.values[last]!),
        )
        const byAbs = [...item.table.rows].sort(
          (a, b) => b.values[last]! - b.values[0]! - (a.values[last]! - a.values[0]!),
        )
        expect(item.options[item.correctIndex]).toBe(byPct[0]!.label)
        expect(byAbs[0]!.label).not.toBe(byPct[0]!.label)
        expect(item.options).toContain(byAbs[0]!.label)
      }
    }
  })

  it('recomputes total and difference answers from the table', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const item of generateItems(3, createRng(seed))) {
        const { rows, columns, unit } = item.table
        const correct = item.options[item.correctIndex]!
        if (item.type === 'total') {
          const row = rows.find((r) => item.prompt.includes(`${r.label}’s`))!
          expect(correct).toBe(formatValue(row.values.reduce((s, v) => s + v, 0), unit))
        }
        if (item.type === 'difference') {
          const col = columns.findIndex((c) => item.prompt.endsWith(`in ${c}?`))
          const named = rows.filter((r) => item.prompt.includes(`${r.label}’s`))
          expect(named).toHaveLength(2)
          const diff = Math.abs(named[0]!.values[col]! - named[1]!.values[col]!)
          expect(correct).toBe(formatValue(diff, unit))
        }
      }
    }
  })

  it('states the rounding in every percentage question', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const item of generateItems(15, createRng(seed))) {
        if (['pctChange', 'share'].includes(item.type)) expect(item.prompt).toContain('nearest whole %')
        if (item.type === 'avgPctChange') expect(item.prompt).toContain('1 decimal place')
        if (item.type === 'ratio') expect(item.prompt).toContain('simplest form')
      }
    }
  })

  it('shrinks the time limit from 60 s to 30 s, with a 50% target', () => {
    expect(timeLimitMs(1)).toBe(60000)
    expect(timeLimitMs(20)).toBe(30000)
    expect(targetTimeMs(20)).toBe(15000)
  })
})
