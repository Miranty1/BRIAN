// Speed Arithmetic difficulty per level (spec §2). All values [tunable].
export type Op = '+' | '−' | '×' | '÷'
export type Range = readonly [min: number, max: number]
export type DivSpec = { divisor: Range; quotient: Range } | { divisor: Range; dividend: Range }

export type LevelSpec = {
  /** + uses [a range, b range]; − draws one number from each and orders them so a ≥ b. */
  addSub: readonly [Range, Range]
  mul?: readonly [Range, Range]
  div?: DivSpec
}

const R = (min: number, max: number): Range => [min, max]

const L1: LevelSpec = { addSub: [R(1, 9), R(1, 9)] }
const L2: LevelSpec = { addSub: [R(1, 20), R(1, 9)] }
const L3: LevelSpec = { addSub: [R(10, 99), R(1, 9)] }
const L4: LevelSpec = { ...L3, mul: [R(2, 5), R(1, 9)] }
const L5: LevelSpec = { ...L3, mul: [R(2, 9), R(2, 9)] }
const L6: LevelSpec = { ...L5, div: { divisor: R(2, 9), quotient: R(2, 9) } }
const L7: LevelSpec = { ...L6, addSub: [R(10, 99), R(10, 99)] }
const L8: LevelSpec = {
  addSub: [R(10, 99), R(10, 99)],
  mul: [R(2, 12), R(2, 12)],
  div: { divisor: R(2, 12), quotient: R(2, 12) },
}
const L10: LevelSpec = {
  addSub: [R(10, 99), R(10, 99)],
  mul: [R(11, 29), R(2, 9)],
  div: { divisor: R(2, 9), quotient: R(11, 25) },
}
const L12: LevelSpec = {
  ...L10,
  mul: [R(11, 49), R(2, 9)],
  div: { divisor: R(2, 9), quotient: R(11, 49) },
}
const L14: LevelSpec = {
  addSub: [R(100, 999), R(100, 999)],
  mul: [R(11, 99), R(2, 9)],
  div: { divisor: R(2, 9), quotient: R(11, 49) },
}
const L17: LevelSpec = {
  addSub: [R(100, 999), R(100, 999)],
  mul: [R(11, 25), R(11, 25)],
  div: { divisor: R(2, 9), dividend: R(100, 999) },
}

/** Index = level − 1. */
export const LEVELS: readonly LevelSpec[] = [
  L1,
  L2,
  L3,
  L4,
  L5,
  L6,
  L7,
  L8,
  L8,
  L10,
  L10,
  L12,
  L12,
  L14,
  L14,
  L14,
  L17,
  L17,
  L17,
  L17,
]
