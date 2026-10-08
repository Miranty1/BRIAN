import type { TrackId } from './tracks'

export type GameId =
  | 'speed-arithmetic'
  | 'money-maths'
  | 'table-reasoning'
  | 'synonym-sprint'
  | 'sentence-fix'
  | 'word-bank'
  | 'sequence-recall'
  | 'detail-recall'
  | 'rule-switch'

export type GameDef = { id: GameId; track: TrackId; name: string; blurb: string }

export const GAMES: readonly GameDef[] = [
  { id: 'speed-arithmetic', track: 'math', name: 'Speed Arithmetic', blurb: 'Quick-fire sums' },
  { id: 'money-maths', track: 'math', name: 'Money Maths', blurb: 'Discounts, GST and splits' },
  {
    id: 'table-reasoning',
    track: 'math',
    name: 'Table Reasoning',
    blurb: 'Read the numbers, do the maths',
  },
  { id: 'synonym-sprint', track: 'verbal', name: 'Synonym Sprint', blurb: 'Closest meaning wins' },
  { id: 'sentence-fix', track: 'verbal', name: 'Sentence Fix', blurb: 'Find the error, fix it' },
  { id: 'word-bank', track: 'verbal', name: 'Word Bank', blurb: 'Learn and review new words' },
  { id: 'sequence-recall', track: 'memory', name: 'Sequence Recall', blurb: 'Repeat the pattern' },
  { id: 'detail-recall', track: 'memory', name: 'Detail Recall', blurb: 'Study it, then answer' },
  {
    id: 'rule-switch',
    track: 'focus',
    name: 'Rule Switch',
    blurb: 'Sort by the rule, then it changes',
  },
]

export const gameById = (id: GameId): GameDef => GAMES.find((g) => g.id === id)!
