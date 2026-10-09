// Money Maths difficulty per level (spec §2.2). All values [tunable].
export type ProblemType =
  | 'discount'
  | 'addGst'
  | 'removeGst'
  | 'split'
  | 'unitPrice'
  | 'markup'
  | 'stackedDiscount'
  | 'discountThenGst'

export type MoneyLevel = {
  /** Problem types; listing one twice doubles its weight. */
  pool: readonly ProblemType[]
  /** Base prices: whole multiples of `step` in [min, max], or any cent amount when `cents`. */
  price: { min: number; max: number; step: number; cents: boolean }
  percents: readonly number[]
  /** Second discount for stackedDiscount. */
  stackedSecond: readonly number[]
  splitPeople: readonly [number, number]
  tips: readonly number[]
  /** Products compared in unitPrice. */
  unitProducts: number
  /** removeGst prices are built from a clean ex-GST price, so the answer is exact. */
  gstExact: boolean
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

const L1: MoneyLevel = {
  pool: ['discount', 'addGst', 'split'],
  price: { min: 20, max: 200, step: 10, cents: false },
  percents: [10, 20, 25, 50],
  stackedSecond: [10],
  splitPeople: [2, 4],
  tips: [],
  unitProducts: 3,
  gstExact: true,
}
const L5: MoneyLevel = {
  ...L1,
  pool: ['discount', 'addGst', 'split', 'removeGst', 'markup', 'unitPrice'],
  price: { min: 10, max: 500, step: 1, cents: false },
  percents: [5, 10, 15, 20, 25, 30, 40, 50],
}
const L7: MoneyLevel = { ...L5, price: { min: 10, max: 500, step: 1, cents: true } }
const L10: MoneyLevel = {
  ...L7,
  pool: [...L7.pool, 'discountThenGst'],
  price: { min: 5, max: 999, step: 1, cents: true },
  percents: [...L7.percents, 12.5, 17.5, 35],
  splitPeople: [3, 8],
  tips: [10, 15, 20],
  unitProducts: 4,
  gstExact: false,
}
const L15: MoneyLevel = {
  ...L10,
  pool: [
    'discount',
    'addGst',
    'removeGst',
    'split',
    'unitPrice',
    'markup',
    'stackedDiscount',
    'stackedDiscount',
    'discountThenGst',
    'discountThenGst',
  ],
  price: { min: 5, max: 2500, step: 1, cents: true },
  percents: [...range(5, 60), 12.5, 17.5],
  stackedSecond: [5, 10, 15, 20, 25],
}

/** Index = level − 1. */
export const LEVELS: readonly MoneyLevel[] = [
  L1,
  L1,
  L1,
  L1,
  L5,
  L5,
  L7,
  L7,
  L7,
  L10,
  L10,
  L10,
  L10,
  L10,
  L15,
  L15,
  L15,
  L15,
  L15,
  L15,
]
