import type { Rng } from '@/lib/rng'
import { LEVELS, type LevelSpec, type Op } from './levels'

export type ArithItem = { a: number; b: number; op: Op; answer: number }

export const ITEMS_PER_ROUND = 10
const MAX_ATTEMPTS = 1000

const clampLevel = (level: number) => Math.min(LEVELS.length, Math.max(1, Math.round(level)))

export function levelSpec(level: number): LevelSpec {
  return LEVELS[clampLevel(level) - 1]!
}

export function opsFor(spec: LevelSpec): Op[] {
  const ops: Op[] = ['+', '−']
  if (spec.mul) ops.push('×')
  if (spec.div) ops.push('÷')
  return ops
}

function makeItem(spec: LevelSpec, rng: Rng): ArithItem {
  const op = rng.pick(opsFor(spec))
  const [r1, r2] = spec.addSub
  switch (op) {
    case '+': {
      const a = rng.int(...r1)
      const b = rng.int(...r2)
      return { a, b, op, answer: a + b }
    }
    case '−': {
      const x = rng.int(...r1)
      const y = rng.int(...r2)
      const a = Math.max(x, y)
      const b = Math.min(x, y)
      return { a, b, op, answer: a - b }
    }
    case '×': {
      const [m1, m2] = spec.mul!
      const a = rng.int(...m1)
      const b = rng.int(...m2)
      return { a, b, op, answer: a * b }
    }
    case '÷': {
      const div = spec.div!
      const d = rng.int(...div.divisor)
      const q =
        'quotient' in div
          ? rng.int(...div.quotient)
          : rng.int(Math.ceil(div.dividend[0] / d), Math.floor(div.dividend[1] / d))
      return { a: d * q, b: d, op, answer: q }
    }
  }
}

/** Distinct problems for one round. Throws only if a level's ranges are too small (a bug). */
export function generateItems(level: number, rng: Rng, count = ITEMS_PER_ROUND): ArithItem[] {
  const spec = levelSpec(level)
  const seen = new Set<string>()
  const items: ArithItem[] = []
  for (let attempt = 0; items.length < count; attempt++) {
    if (attempt >= MAX_ATTEMPTS) {
      throw new Error(`Couldn’t generate ${count} distinct items for level ${level}`)
    }
    const item = makeItem(spec, rng)
    const key = `${item.a}${item.op}${item.b}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
  }
  return items
}

/** 10 s at level 1 down to 5 s at level 20. */
export const timeLimitMs = (level: number) =>
  Math.round(10000 - ((clampLevel(level) - 1) * 5000) / 19)

export const targetTimeMs = (level: number) => Math.round(0.4 * timeLimitMs(level))
