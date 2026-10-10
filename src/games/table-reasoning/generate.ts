import { makeChoices, makeLabelChoices, roundTo, shuffle, type ChoiceItem } from '@/games/choices'
import { formatAud } from '@/lib/money'
import type { Rng } from '@/lib/rng'
import { LEVELS, type TableLevel } from './levels'
import { THEMES, type Theme } from './themes'

export type Unit = '$' | 'units' | 'hours'
export type Table = {
  title: string
  unit: Unit
  rowNoun: string
  colNoun: string
  measure: string
  columns: string[]
  rows: { label: string; values: number[] }[]
}
export type QuestionType =
  'difference' | 'total' | 'average' | 'pctChange' | 'share' | 'ratio' | 'pickRow' | 'avgPctChange'
export type TableItem = ChoiceItem & { type: QuestionType; table: Table }

export const ITEMS_PER_ROUND = 10
const MAX_ATTEMPTS = 1000
const MAX_RATIO_TERM = 12

const clampLevel = (level: number) => Math.min(LEVELS.length, Math.max(1, Math.round(level)))
export const levelSpec = (level: number): TableLevel => LEVELS[clampLevel(level) - 1]!

export const pctChange = (from: number, to: number) => ((to - from) / from) * 100
const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0)
const mean = (xs: readonly number[]) => sum(xs) / xs.length
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

export function formatValue(n: number, unit: Unit): string {
  if (unit === '$') return formatAud(Math.round(n), false)
  const s = Math.round(n).toLocaleString('en-AU')
  return unit === 'hours' ? `${s} h` : s
}

/** "+12%", "−8.3%", "0%". Uses a true minus sign. */
export function formatPct(n: number, dp: number): string {
  const r = roundTo(n, dp)
  if (r === 0) return `${(0).toFixed(dp)}%`
  const body = Math.abs(r).toFixed(dp)
  return `${r > 0 ? '+' : '−'}${body}%`
}

/** The level's spec with the cell range narrowed to what the theme allows. */
const specFor = (spec: TableLevel, theme: Theme): TableLevel => ({
  ...spec,
  values: { ...spec.values, max: Math.min(spec.values.max, theme.maxValue ?? Infinity) },
})

function makeTable(theme: Theme, spec: TableLevel, rng: Rng): Table {
  const { min, max, step } = spec.values
  const cell = () => rng.int(Math.ceil(min / step), Math.floor(max / step)) * step
  return {
    title: theme.title,
    unit: theme.unit,
    rowNoun: theme.rowNoun,
    colNoun: theme.colNoun,
    measure: theme.measure,
    columns: theme.columns.slice(0, spec.cols),
    rows: theme.rows.slice(0, spec.rows).map((label) => ({
      label,
      values: Array.from({ length: spec.cols }, cell),
    })),
  }
}

/** Two distinct indexes in [0, n). */
function twoOf(n: number, rng: Rng): [number, number] {
  const a = rng.int(0, n - 1)
  let b = rng.int(0, n - 2)
  if (b >= a) b++
  return [a, b]
}

const valueChoices = (correct: number, distractors: number[], unit: Unit, rng: Rng) =>
  makeChoices(Math.round(correct), distractors.map(Math.round), rng, {
    format: (n) => formatValue(n, unit),
    // At least 1–3 away, so tiny values (a difference of 1) still find distinct neighbours.
    nudge: (n, r) =>
      n + (r.next() < 0.5 ? -1 : 1) * Math.max(r.int(1, 3), Math.round((n * r.int(3, 15)) / 100)),
  })

const pctChoices = (correct: number, distractors: number[], dp: number, rng: Rng) =>
  makeChoices(
    roundTo(correct, dp),
    distractors.map((d) => roundTo(d, dp)),
    rng,
    {
      format: (n) => formatPct(n, dp),
      nudge: (n, r) =>
        roundTo(n + (r.next() < 0.5 ? -1 : 1) * (dp === 0 ? r.int(2, 9) : r.int(5, 30) / 10), dp),
      allowNegative: true,
    },
  )

type Built = { prompt: string; choices: { options: string[]; correctIndex: number } } | null

/** Builds one question on `t`. Returns null when this table can't support it (the caller rerolls). */
function ask(type: QuestionType, t: Table, spec: TableLevel, rng: Rng): Built {
  const nRows = t.rows.length
  const nCols = t.columns.length
  const last = nCols - 1
  const v = (r: number, c: number) => t.rows[r]!.values[c]!
  const label = (r: number) => t.rows[r]!.label
  const colVals = (c: number) => t.rows.map((row) => row.values[c]!)

  switch (type) {
    case 'difference': {
      const c = rng.int(0, last)
      let [a, b] = twoOf(nRows, rng)
      if (v(a, c) === v(b, c)) return null
      if (v(a, c) < v(b, c)) [a, b] = [b, a]
      const otherC = (c + 1) % nCols
      const third = [...Array(nRows).keys()].find((r) => r !== a && r !== b) ?? b
      return {
        prompt: `How much higher ${t.be} ${t.measure} for ${label(a)} than for ${label(b)} in ${t.columns[c]}?`,
        choices: valueChoices(
          v(a, c) - v(b, c),
          [
            Math.abs(v(a, otherC) - v(b, otherC)),
            Math.abs(v(a, c) - v(third, c)),
            v(a, c) + v(b, c),
          ],
          t.unit,
          rng,
        ),
      }
    }
    case 'total': {
      const r = rng.int(0, nRows - 1)
      const row = t.rows[r]!.values
      const [x, y] = twoOf(nCols, rng)
      return {
        prompt: `What was the total ${t.measure} for ${label(r)} across all ${t.colNoun}s shown?`,
        choices: valueChoices(
          sum(row),
          [sum(row) - row[x]!, sum(row) - row[y]!, sum(colVals(0))],
          t.unit,
          rng,
        ),
      }
    }
    case 'average': {
      const c = rng.int(0, last)
      const col = colVals(c)
      const sorted = [...col].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
      return {
        prompt: `What was the average ${t.measure} per ${t.rowNoun} in ${t.columns[c]}, to the nearest whole number?`,
        choices: valueChoices(
          mean(col),
          [sum(col), sum(col) / (col.length - 1), median],
          t.unit,
          rng,
        ),
      }
    }
    case 'pctChange': {
      const r = rng.int(0, nRows - 1)
      const from = v(r, 0)
      const to = v(r, last)
      if (from === to) return null
      const change = pctChange(from, to)
      return {
        prompt: `What was the % change in ${t.measure} for ${label(r)} from ${t.columns[0]} to ${t.columns[last]}, to the nearest whole %?`,
        choices: pctChoices(change, [((to - from) / to) * 100, -change, to - from], 0, rng),
      }
    }
    case 'share': {
      const c = rng.int(0, last)
      const r = rng.int(0, nRows - 1)
      const share = (v(r, c) / sum(colVals(c))) * 100
      const grand = sum(t.rows.flatMap((row) => row.values))
      const nextRow = (r + 1) % nRows
      return {
        prompt: `What % of the combined ${t.measure} in ${t.columns[c]} was for ${label(r)}, to the nearest whole %?`,
        choices: makeChoices(
          roundTo(share, 0),
          [
            (v(r, c) / sum(t.rows[r]!.values)) * 100,
            (v(r, c) / grand) * 100,
            (v(nextRow, c) / sum(colVals(c))) * 100,
          ].map((d) => roundTo(d, 0)),
          rng,
          {
            format: (n) => `${n}%`,
            nudge: (n, rr) => Math.max(1, n + (rr.next() < 0.5 ? -1 : 1) * rr.int(2, 9)),
          },
        ),
      }
    }
    case 'ratio': {
      // Overwrite two cells so the simplest form has small terms; both stay on the level's grid.
      const c = rng.int(0, last)
      const [a, b] = twoOf(nRows, rng)
      const x0 = rng.int(1, MAX_RATIO_TERM)
      const y0 = rng.int(1, MAX_RATIO_TERM)
      if (x0 === y0) return null
      const g = gcd(x0, y0)
      const x = x0 / g
      const y = y0 / g
      const { min, max, step } = spec.values
      const lo = Math.ceil(min / (Math.min(x, y) * step))
      const hi = Math.floor(max / (Math.max(x, y) * step))
      if (hi < lo) return null
      const k = rng.int(lo, hi)
      t.rows[a]!.values[c] = x * k * step
      t.rows[b]!.values[c] = y * k * step
      const third = [...Array(nRows).keys()].find((r) => r !== a && r !== b)
      const simplify = (p: number, q: number) => {
        const d = gcd(p, q)
        return `${p / d}:${q / d}`
      }
      const correct = `${x}:${y}`
      const others = [`${y}:${x}`, `${v(a, c)}:${v(b, c)}`]
      if (third !== undefined) others.push(simplify(v(a, c), v(third, c)))
      return {
        prompt: `What is the ratio of ${t.measure} for ${label(a)} to ${label(b)} in ${t.columns[c]}, in simplest form?`,
        choices: makeLabelChoices(correct, others, rng, {
          fill: (rr) => `${x + rr.int(1, 3)}:${y}`,
        }),
      }
    }
    case 'pickRow': {
      const changes = t.rows.map((_, r) => pctChange(v(r, 0), v(r, last)))
      const abs = t.rows.map((_, r) => v(r, last) - v(r, 0))
      const best = changes.indexOf(Math.max(...changes))
      const trap = abs.indexOf(Math.max(...abs))
      const sortedChanges = [...changes].sort((p, q) => q - p)
      // Needs a real increase, a clear winner and a trap row that differs.
      if (changes[best]! <= 0 || best === trap) return null
      if (sortedChanges[0]! - sortedChanges[1]! < 1) return null
      const rest = shuffle(
        t.rows.map((row) => row.label).filter((l) => l !== label(best) && l !== label(trap)),
        rng,
      )
      return {
        prompt: `Which ${t.rowNoun} had the largest % increase from ${t.columns[0]} to ${t.columns[last]}?`,
        choices: makeLabelChoices(label(best), [label(trap), ...rest], rng),
      }
    }
    case 'avgPctChange': {
      const changes = t.rows.map((_, r) => pctChange(v(r, 0), v(r, 1)))
      const answer = mean(changes)
      const ofAverages = pctChange(mean(colVals(0)), mean(colVals(1)))
      const largest = changes.reduce((p, q) => (Math.abs(q) > Math.abs(p) ? q : p))
      const byNew = mean(t.rows.map((_, r) => ((v(r, 1) - v(r, 0)) / v(r, 1)) * 100))
      return {
        prompt: `What was the average % change per ${t.rowNoun} from ${t.columns[0]} to ${t.columns[1]}, to 1 decimal place?`,
        choices: pctChoices(answer, [ofAverages, largest, byNew], 1, rng),
      }
    }
  }
}

function makeItem(spec: TableLevel, rng: Rng): TableItem {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const type = rng.pick(spec.pool)
    const theme = rng.pick(THEMES)
    const themed = specFor(spec, theme)
    const table = makeTable(theme, themed, rng)
    const built = ask(type, table, themed, rng)
    if (built) return { type, table, prompt: built.prompt, ...built.choices }
  }
  throw new Error('Couldn’t generate a table question')
}

/** Distinct questions for one round. Throws only if a level is too narrow (a bug). */
export function generateItems(level: number, rng: Rng, count = ITEMS_PER_ROUND): TableItem[] {
  const spec = levelSpec(level)
  const seen = new Set<string>()
  const items: TableItem[] = []
  for (let attempt = 0; items.length < count; attempt++) {
    if (attempt >= MAX_ATTEMPTS)
      throw new Error(`Couldn’t generate ${count} items for level ${level}`)
    const item = makeItem(spec, rng)
    if (seen.has(item.prompt)) continue
    seen.add(item.prompt)
    items.push(item)
  }
  return items
}

/** 60 s at level 1 down to 30 s at level 20. [tunable] */
export const timeLimitMs = (level: number) =>
  Math.round(60000 - ((clampLevel(level) - 1) * 30000) / 19)

export const targetTimeMs = (level: number) => Math.round(0.5 * timeLimitMs(level))
