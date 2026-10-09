import type { Unit } from './generate'

export type Theme = {
  title: string
  unit: Unit
  /** Used in questions: "Which store…", "…across all months". */
  rowNoun: string
  colNoun: string
  /** "sales", "units sold"… as in "Store A’s sales". */
  measure: string
  rows: readonly string[]
  /** Time-ordered, so % change reads first → last. */
  columns: readonly string[]
}

export const THEMES: readonly Theme[] = [
  {
    title: 'Sales by store ($)',
    unit: '$',
    rowNoun: 'store',
    colNoun: 'month',
    measure: 'sales',
    rows: ['Store A', 'Store B', 'Store C', 'Store D', 'Store E', 'Store F'],
    columns: ['Jan', 'Feb', 'Mar', 'Apr'],
  },
  {
    title: 'Units sold by product',
    unit: 'units',
    rowNoun: 'product',
    colNoun: 'quarter',
    measure: 'units sold',
    rows: ['Pens', 'Paper', 'Ink', 'Folders', 'Tape', 'Glue'],
    columns: ['Q1', 'Q2', 'Q3', 'Q4'],
  },
  {
    title: 'Hours worked by staff member',
    unit: 'hours',
    rowNoun: 'staff member',
    colNoun: 'week',
    measure: 'hours',
    rows: ['Ava', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay'],
    columns: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
  },
  {
    title: 'Price charged by supplier ($)',
    unit: '$',
    rowNoun: 'supplier',
    colNoun: 'year',
    measure: 'price',
    rows: ['Supplier A', 'Supplier B', 'Supplier C', 'Supplier D', 'Supplier E', 'Supplier F'],
    columns: ['2022', '2023', '2024', '2025'],
  },
]
