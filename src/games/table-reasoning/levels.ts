// Table Reasoning difficulty per level (spec §3.2). All values [tunable].
import type { QuestionType } from './generate'

export type TableLevel = {
  rows: number
  cols: number
  /** Cell values: whole multiples of `step` in [min, max]. */
  values: { min: number; max: number; step: number }
  /** Question types; listing one twice doubles its weight. */
  pool: readonly QuestionType[]
}

const BASIC: QuestionType[] = ['difference', 'total']
const MID: QuestionType[] = [...BASIC, 'average', 'pctChange', 'share', 'ratio']
const HARD: QuestionType[] = [...MID, 'pickRow', 'pickRow', 'avgPctChange', 'avgPctChange']

const lvl = (rows: number, cols: number, max: number, step: number, pool: QuestionType[]): TableLevel => ({
  rows,
  cols,
  values: { min: 10, max, step },
  pool,
})

/** Index = level − 1. */
export const LEVELS: readonly TableLevel[] = [
  lvl(3, 2, 200, 10, BASIC),
  lvl(3, 2, 200, 10, BASIC),
  lvl(3, 3, 200, 10, BASIC),
  lvl(4, 3, 200, 10, BASIC),
  lvl(4, 3, 200, 10, BASIC),
  lvl(4, 3, 500, 5, MID),
  lvl(4, 3, 500, 5, MID),
  lvl(4, 3, 500, 5, MID),
  lvl(5, 4, 999, 1, MID),
  lvl(5, 4, 999, 1, MID),
  lvl(5, 4, 999, 1, MID),
  lvl(5, 4, 999, 1, MID),
  lvl(5, 4, 9999, 1, HARD),
  lvl(5, 4, 9999, 1, HARD),
  lvl(5, 4, 9999, 1, HARD),
  lvl(5, 4, 9999, 1, HARD),
  lvl(6, 4, 9999, 1, HARD),
  lvl(6, 4, 9999, 1, HARD),
  lvl(6, 4, 9999, 1, HARD),
  lvl(6, 4, 9999, 1, HARD),
]
