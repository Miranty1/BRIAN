import { createRng } from '@/lib/rng'
import {
  formatPct,
  formatValue,
  generateItems,
  levelSpec,
  pctChange,
  targetTimeMs,
  timeLimitMs,
  type TableItem,
} from './generate'
import { LEVELS } from './levels'

// 20 levels × 200 seeds; slow under full-suite load.
const SWEEP_TIMEOUT_MS = 30000

const HOURS_MAX = 60

/** The correct option, recomputed from the table and the row/column the prompt names. */
function expected(item: TableItem): string {
  const { rows, columns, unit } = item.table
  const { prompt } = item
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)
  const mean = (xs: number[]) => sum(xs) / xs.length
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  // Rows the prompt names, in the order they appear.
  const named = rows
    .map((r) => ({ r, at: prompt.search(new RegExp(`\\b${r.label}\\b`)) }))
    .filter((x) => x.at >= 0)
    .sort((p, q) => p.at - q.at)
    .map((x) => x.r)
  const col = () => columns.findIndex((c) => new RegExp(`\\bin ${c}\\b`).test(prompt))

  switch (item.type) {
    case 'difference': {
      expect(named).toHaveLength(2)
      const c = col()
      return formatValue(Math.abs(named[0]!.values[c]! - named[1]!.values[c]!), unit)
    }
    case 'total':
      expect(named).toHaveLength(1)
      return formatValue(sum(named[0]!.values), unit)
    case 'average':
      return formatValue(Math.round(mean(rows.map((r) => r.values[col()]!))), unit)
    case 'pctChange': {
      const [, from, to] = /from (.+?) to (.+?), to/.exec(prompt)!
      expect(named).toHaveLength(1)
      const v = named[0]!.values
      return formatPct(pctChange(v[columns.indexOf(from!)]!, v[columns.indexOf(to!)]!), 0)
    }
    case 'share': {
      expect(named).toHaveLength(1)
      const c = columns.findIndex((x) => new RegExp(`\\bin ${x} was\\b`).test(prompt))
      return `${Math.round((named[0]!.values[c]! * 100) / sum(rows.map((r) => r.values[c]!)))}%`
    }
    case 'ratio': {
      expect(named).toHaveLength(2)
      const c = col()
      const p = named[0]!.values[c]!
      const q = named[1]!.values[c]!
      const d = gcd(p, q)
      return `${p / d}:${q / d}`
    }
    case 'pickRow': {
      const [, from, to] = /from (.+?) to (.+?)\?/.exec(prompt)!
      const f = columns.indexOf(from!)
      const t = columns.indexOf(to!)
      const best = rows.reduce((b, r) =>
        pctChange(r.values[f]!, r.values[t]!) > pctChange(b.values[f]!, b.values[t]!) ? r : b,
      )
      return best.label
    }
    case 'avgPctChange': {
      const [, from, to] = /from (.+?) to (.+?), to/.exec(prompt)!
      const f = columns.indexOf(from!)
      const t = columns.indexOf(to!)
      return formatPct(mean(rows.map((r) => pctChange(r.values[f]!, r.values[t]!))), 1)
    }
  }
}

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
    it(
      `level ${level}: tables and questions fit the level`,
      () => {
        const spec = levelSpec(level)
        for (let seed = 1; seed <= 200; seed++) {
          const items = generateItems(level, createRng(seed))
          expect(items).toHaveLength(10)
          expect(new Set(items.map((i) => i.prompt)).size).toBe(10)
          for (const item of items) {
            const { rows, columns } = item.table
            expect(spec.pool).toContain(item.type)
            const maxValue =
              item.table.unit === 'hours' ? Math.min(spec.values.max, HOURS_MAX) : spec.values.max
            expect(rows).toHaveLength(spec.rows)
            expect(columns).toHaveLength(spec.cols)
            for (const row of rows) {
              expect(row.values).toHaveLength(spec.cols)
              for (const v of row.values) {
                expect(Number.isInteger(v)).toBe(true)
                expect(v).toBeGreaterThanOrEqual(spec.values.min)
                expect(v).toBeLessThanOrEqual(maxValue)
                expect(v % spec.values.step).toBe(0)
              }
            }
            expect(item.options).toHaveLength(4)
            expect(new Set(item.options).size).toBe(4)
            expect(item.correctIndex).toBeGreaterThanOrEqual(0)
            expect(item.options[item.correctIndex]).toBe(expected(item))
          }
        }
      },
      SWEEP_TIMEOUT_MS,
    )
  }

  it(
    'makes pickRow traps: largest % change and largest absolute change are different rows',
    () => {
      for (let seed = 1; seed <= 300; seed++) {
        for (const item of generateItems(17, createRng(seed))) {
          if (item.type !== 'pickRow') continue
          const last = item.table.columns.length - 1
          const byPct = [...item.table.rows].sort(
            (a, b) =>
              pctChange(b.values[0]!, b.values[last]!) - pctChange(a.values[0]!, a.values[last]!),
          )
          const byAbs = [...item.table.rows].sort(
            (a, b) => b.values[last]! - b.values[0]! - (a.values[last]! - a.values[0]!),
          )
          expect(item.options[item.correctIndex]).toBe(byPct[0]!.label)
          expect(byAbs[0]!.label).not.toBe(byPct[0]!.label)
          expect(item.options).toContain(byAbs[0]!.label)
        }
      }
    },
    SWEEP_TIMEOUT_MS,
  )

  it('words the questions with "for <label>", never a possessive', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const item of generateItems(15, createRng(seed))) expect(item.prompt).not.toContain('’s')
    }
  })

  it('states the rounding in every percentage question', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const item of generateItems(15, createRng(seed))) {
        if (['pctChange', 'share'].includes(item.type))
          expect(item.prompt).toContain('nearest whole %')
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
