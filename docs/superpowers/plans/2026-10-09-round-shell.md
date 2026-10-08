# Round Shell + Speed Arithmetic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared round framework (engine, scoring, timer, feedback, summary, offline-safe saving), and prove it with a playable Speed Arithmetic game.

**Architecture:** A pure TypeScript round engine and scoring module drive one shared `RoundScreen`. Each game is a `GameModule` plug-in (generator, time limits, check, item view). Finished rounds update an on-device progress store immediately, are queued in a `localStorage` outbox, and are synced through an idempotent Postgres function `record_round`.

**Tech Stack:** React 19 + TypeScript (strict), Vite 8, React Router 7, Vitest 4 + Testing Library (jsdom), Supabase (Postgres + RLS, pgTAP via `npm run db:test`), CSS Modules + CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-10-09-round-shell-design.md`

## Global Constraints

- $0 to run: no new paid services; **no new npm dependencies** are needed for this plan.
- Australian English in all copy (e.g. "colour"); sentence case; curly apostrophes (`’`) in UI strings, matching existing screens.
- Styling: CSS Modules + tokens from `src/theme/tokens.css` (`--track-*`, `--space-*`, `--radius-*`, `--dur-*`, `--tap-min: 44px`). No inline colours except passing a track colour into `--track`.
- Imports use the `@/` alias for `src/`.
- Tests: Vitest globals (`describe`, `it`, `expect`, `vi`) are enabled; tests live next to the file (`foo.test.ts`). Run `npm test` from the repo root.
- Formatting: run `npx prettier --write <files>` before committing; `npm run lint` (oxlint) and `npm run typecheck` must be clean.
- Database changes go in a new migration file and are pushed to the hosted project with `npm run db:push` (the CLI is already logged in and linked). There is no local database and no Docker.
- Every commit message ends with the line: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Work on the `scaffold` branch. Do not push to `main` until Task 11.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/rng.ts` | Seeded PRNG (`createRng`) |
| `src/round/types.ts` | `ItemResult` type shared by engine + scoring |
| `src/round/scoring.ts` | Score formula, level change |
| `src/round/engine.ts` | Pure round state machine |
| `src/games/speed-arithmetic/levels.ts` | Level table (data only) |
| `src/games/speed-arithmetic/generate.ts` | Item generation, time limits |
| `src/games/types.ts` | `GameModule` contract |
| `src/components/NumberPad.tsx` (+ `.module.css`) | Shared on-screen number pad |
| `src/games/speed-arithmetic/SpeedArithmeticView.tsx` (+ `.module.css`) | Draws a problem + pad |
| `src/games/speed-arithmetic/index.ts` | The Speed Arithmetic `GameModule` |
| `src/games/registry.ts` | Game id → module lookup |
| `supabase/migrations/20261009000000_record_round.sql` | `record_round` function |
| `supabase/tests/record_round.test.sql` | pgTAP tests for it |
| `src/data/progress.ts` | Progress store + outbox (no React, no Supabase) |
| `src/data/supabaseProgress.ts` | Supabase adapters for the store |
| `src/data/ProgressProvider.tsx` | React context + hooks, sync triggers |
| `src/round/RoundScreen.tsx` | Route `/play/:gameId`: ready screen, runs |
| `src/round/RoundRun.tsx` | One round: engine, timers, feedback, saving |
| `src/round/RoundSummary.tsx` | End-of-round summary |
| `src/round/RoundScreen.module.css` | Styles for the three above |
| `src/routes/Play.tsx` (+ `.module.css`) | Library: playable vs coming soon |
| `src/App.tsx` | Provider + new route |

---

### Task 1: Seeded random number generator

**Files:**
- Create: `src/lib/rng.ts`
- Test: `src/lib/rng.test.ts`

**Interfaces:**
- Produces: `type Rng = { next(): number; int(min: number, max: number): number; pick<T>(items: readonly T[]): T }` and `createRng(seed: number): Rng`. `int` is inclusive at both ends.

- [ ] **Step 1: Write the failing test** — `src/lib/rng.test.ts`

```ts
import { createRng } from './rng'

describe('createRng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(
      Array.from({ length: 5 }, () => b.next()),
    )
  })

  it('gives different sequences for different seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next())
  })

  it('returns floats in [0, 1)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const x = rng.next()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('int covers both ends of an inclusive range', () => {
    const rng = createRng(3)
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) seen.add(rng.int(2, 5))
    expect([...seen].sort()).toEqual([2, 3, 4, 5])
  })

  it('pick returns members of the array', () => {
    const rng = createRng(9)
    const items = ['a', 'b', 'c'] as const
    for (let i = 0; i < 100; i++) expect(items).toContain(rng.pick(items))
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/rng.test.ts`
Expected: FAIL — cannot resolve `./rng`.

- [ ] **Step 3: Implement** — `src/lib/rng.ts`

```ts
export type Rng = {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
}

/** mulberry32: tiny, fast and good enough for game content. Same seed → same sequence. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)]!,
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/rng.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/lib/rng.ts src/lib/rng.test.ts
git add src/lib/rng.ts src/lib/rng.test.ts
git commit -m "Add seeded random number generator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Scoring and level change

**Files:**
- Create: `src/round/types.ts`, `src/round/scoring.ts`
- Test: `src/round/scoring.test.ts`

**Interfaces:**
- Produces: `type ItemResult = { correct: boolean; timedOut: boolean; responseMs: number }` (in `types.ts`); `type RoundStats = { accuracy: number; avgResponseMs: number; score: number }`; `scoreRound(results: readonly ItemResult[], targetTimeMs: number): RoundStats`; `nextLevel(level: number, score: number): number`; constants `LEVEL_UP_AT = 80`, `LEVEL_DOWN_AT = 50`, `MIN_LEVEL = 1`, `MAX_LEVEL = 20`.

- [ ] **Step 1: Write the failing test** — `src/round/scoring.test.ts`

```ts
import { nextLevel, scoreRound } from './scoring'
import type { ItemResult } from './types'

const r = (correct: boolean, responseMs: number, timedOut = false): ItemResult => ({
  correct,
  timedOut,
  responseMs,
})
const many = (n: number, item: ItemResult) => Array.from({ length: n }, () => item)

describe('scoreRound', () => {
  it('scores 100 for all correct at or under the target time', () => {
    expect(scoreRound(many(10, r(true, 1000)), 2000)).toEqual({
      accuracy: 1,
      avgResponseMs: 1000,
      score: 100,
    })
  })

  it('scales the speed part by target / average', () => {
    // 70 * 1 + 30 * (2000 / 4000) = 85
    expect(scoreRound(many(10, r(true, 4000)), 2000).score).toBe(85)
  })

  it('weights accuracy at 70', () => {
    const results = [...many(5, r(true, 2000)), ...many(5, r(false, 2000))]
    // 70 * 0.5 + 30 * 1 = 65
    expect(scoreRound(results, 2000)).toEqual({ accuracy: 0.5, avgResponseMs: 2000, score: 65 })
  })

  it('counts timeouts at their elapsed time', () => {
    // accuracy 0.5, avg 6000, speed 2000/6000 → 35 + 10 = 45
    expect(scoreRound([r(true, 2000), r(false, 10000, true)], 2000)).toEqual({
      accuracy: 0.5,
      avgResponseMs: 6000,
      score: 45,
    })
  })

  it('treats a zero average time as full speed', () => {
    expect(scoreRound(many(3, r(true, 0)), 2000).score).toBe(100)
  })

  it('returns zeros for an empty round', () => {
    expect(scoreRound([], 2000)).toEqual({ accuracy: 0, avgResponseMs: 0, score: 0 })
  })
})

describe('nextLevel', () => {
  it.each([
    [80, 6],
    [100, 6],
    [79, 5],
    [51, 5],
    [50, 4],
    [0, 4],
  ])('score %i at level 5 → level %i', (score, expected) => {
    expect(nextLevel(5, score)).toBe(expected)
  })

  it('clamps to 1–20', () => {
    expect(nextLevel(20, 100)).toBe(20)
    expect(nextLevel(1, 0)).toBe(1)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/round/scoring.test.ts`
Expected: FAIL — cannot resolve `./scoring`.

- [ ] **Step 3: Implement**

`src/round/types.ts`:

```ts
export type ItemResult = {
  correct: boolean
  timedOut: boolean
  responseMs: number
}
```

`src/round/scoring.ts`:

```ts
import type { ItemResult } from './types'

// Handoff §3, all [tunable].
export const ACCURACY_WEIGHT = 70
export const SPEED_WEIGHT = 30
export const LEVEL_UP_AT = 80
export const LEVEL_DOWN_AT = 50
export const MIN_LEVEL = 1
export const MAX_LEVEL = 20

export type RoundStats = { accuracy: number; avgResponseMs: number; score: number }

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x))

export function scoreRound(results: readonly ItemResult[], targetTimeMs: number): RoundStats {
  if (results.length === 0) return { accuracy: 0, avgResponseMs: 0, score: 0 }
  const accuracy = results.filter((r) => r.correct).length / results.length
  const avgResponseMs = results.reduce((sum, r) => sum + r.responseMs, 0) / results.length
  const speedFactor = avgResponseMs <= 0 ? 1 : clamp(targetTimeMs / avgResponseMs, 0, 1)
  const score = Math.round(ACCURACY_WEIGHT * accuracy + SPEED_WEIGHT * speedFactor)
  return { accuracy, avgResponseMs, score }
}

export function nextLevel(level: number, score: number): number {
  const delta = score >= LEVEL_UP_AT ? 1 : score <= LEVEL_DOWN_AT ? -1 : 0
  return clamp(level + delta, MIN_LEVEL, MAX_LEVEL)
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/round/scoring.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/round
git add src/round
git commit -m "Add round scoring and level change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Round engine

**Files:**
- Create: `src/round/engine.ts`
- Test: `src/round/engine.test.ts`

**Interfaces:**
- Consumes: `ItemResult` from `src/round/types.ts`.
- Produces:
  - `type RoundPhase = 'ready' | 'item' | 'feedback' | 'done'`
  - `type RoundState<Item> = { phase: RoundPhase; items: readonly Item[]; index: number; itemStartedAt: number; results: readonly ItemResult[] }`
  - `type RoundEvent = { type: 'start'; now: number } | { type: 'answer'; correct: boolean; now: number } | { type: 'timeout'; now: number } | { type: 'next'; now: number }`
  - `initRound<Item>(items: readonly Item[]): RoundState<Item>`
  - `roundReducer<Item>(state: RoundState<Item>, event: RoundEvent): RoundState<Item>` (returns the same object for ignored events)
  - `lastResult<Item>(state: RoundState<Item>): ItemResult | undefined`

- [ ] **Step 1: Write the failing test** — `src/round/engine.test.ts`

```ts
import { initRound, lastResult, roundReducer, type RoundEvent, type RoundState } from './engine'

const play = (events: RoundEvent[], items: string[] = ['a', 'b']) =>
  events.reduce<RoundState<string>>((s, e) => roundReducer(s, e), initRound(items))

describe('round engine', () => {
  it('starts in ready', () => {
    expect(initRound(['a']).phase).toBe('ready')
  })

  it('records an answer with its response time and moves to feedback', () => {
    const s = play([
      { type: 'start', now: 1000 },
      { type: 'answer', correct: true, now: 2500 },
    ])
    expect(s.phase).toBe('feedback')
    expect(lastResult(s)).toEqual({ correct: true, timedOut: false, responseMs: 1500 })
  })

  it('records a timeout as wrong', () => {
    const s = play([
      { type: 'start', now: 0 },
      { type: 'timeout', now: 10000 },
    ])
    expect(lastResult(s)).toEqual({ correct: false, timedOut: true, responseMs: 10000 })
  })

  it('moves to the next item and restarts its clock', () => {
    const s = play([
      { type: 'start', now: 0 },
      { type: 'answer', correct: false, now: 500 },
      { type: 'next', now: 1500 },
    ])
    expect(s).toMatchObject({ phase: 'item', index: 1, itemStartedAt: 1500 })
  })

  it('finishes after the last item', () => {
    const s = play([
      { type: 'start', now: 0 },
      { type: 'answer', correct: true, now: 100 },
      { type: 'next', now: 200 },
      { type: 'answer', correct: true, now: 300 },
      { type: 'next', now: 400 },
    ])
    expect(s.phase).toBe('done')
    expect(s.results).toHaveLength(2)
  })

  it('ignores events in the wrong phase', () => {
    const ready = initRound(['a'])
    expect(roundReducer(ready, { type: 'answer', correct: true, now: 1 })).toBe(ready)
    const item = roundReducer(ready, { type: 'start', now: 0 })
    expect(roundReducer(item, { type: 'start', now: 5 })).toBe(item)
    expect(roundReducer(item, { type: 'next', now: 5 })).toBe(item)
    const feedback = roundReducer(item, { type: 'timeout', now: 5 })
    expect(roundReducer(feedback, { type: 'answer', correct: true, now: 6 })).toBe(feedback)
    expect(roundReducer(feedback, { type: 'timeout', now: 6 })).toBe(feedback)
  })

  it('goes straight to done with no items', () => {
    expect(roundReducer(initRound([]), { type: 'start', now: 0 }).phase).toBe('done')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/round/engine.test.ts`
Expected: FAIL — cannot resolve `./engine`.

- [ ] **Step 3: Implement** — `src/round/engine.ts`

```ts
import type { ItemResult } from './types'

export type RoundPhase = 'ready' | 'item' | 'feedback' | 'done'

export type RoundState<Item> = {
  phase: RoundPhase
  items: readonly Item[]
  index: number
  itemStartedAt: number
  results: readonly ItemResult[]
}

/** Every event carries the current time so the engine stays pure and testable. */
export type RoundEvent =
  | { type: 'start'; now: number }
  | { type: 'answer'; correct: boolean; now: number }
  | { type: 'timeout'; now: number }
  | { type: 'next'; now: number }

export function initRound<Item>(items: readonly Item[]): RoundState<Item> {
  return { phase: 'ready', items, index: 0, itemStartedAt: 0, results: [] }
}

export function roundReducer<Item>(state: RoundState<Item>, event: RoundEvent): RoundState<Item> {
  switch (event.type) {
    case 'start':
      if (state.phase !== 'ready') return state
      if (state.items.length === 0) return { ...state, phase: 'done' }
      return { ...state, phase: 'item', index: 0, itemStartedAt: event.now }

    case 'answer':
    case 'timeout': {
      if (state.phase !== 'item') return state
      const result: ItemResult = {
        correct: event.type === 'answer' && event.correct,
        timedOut: event.type === 'timeout',
        responseMs: Math.max(0, event.now - state.itemStartedAt),
      }
      return { ...state, phase: 'feedback', results: [...state.results, result] }
    }

    case 'next': {
      if (state.phase !== 'feedback') return state
      const index = state.index + 1
      if (index >= state.items.length) return { ...state, phase: 'done' }
      return { ...state, phase: 'item', index, itemStartedAt: event.now }
    }
  }
}

export function lastResult<Item>(state: RoundState<Item>): ItemResult | undefined {
  return state.results[state.results.length - 1]
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/round/engine.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/round
git add src/round
git commit -m "Add pure round engine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Speed Arithmetic levels and generator

**Files:**
- Create: `src/games/speed-arithmetic/levels.ts`, `src/games/speed-arithmetic/generate.ts`
- Test: `src/games/speed-arithmetic/generate.test.ts`

**Interfaces:**
- Consumes: `Rng`, `createRng` from `@/lib/rng`.
- Produces:
  - `levels.ts`: `type Op = '+' | '−' | '×' | '÷'` (note `−` is U+2212, `×` U+00D7, `÷` U+00F7); `type Range = readonly [min: number, max: number]`; `type DivSpec`; `type LevelSpec = { addSub: readonly [Range, Range]; mul?: readonly [Range, Range]; div?: DivSpec }`; `LEVELS: readonly LevelSpec[]` (length 20).
  - `generate.ts`: `type ArithItem = { a: number; b: number; op: Op; answer: number }`; `ITEMS_PER_ROUND = 10`; `levelSpec(level)`; `opsFor(spec): Op[]`; `generateItems(level: number, rng: Rng, count?: number): ArithItem[]`; `timeLimitMs(level): number`; `targetTimeMs(level): number`.

- [ ] **Step 1: Write the failing test** — `src/games/speed-arithmetic/generate.test.ts`

```ts
import { createRng } from '@/lib/rng'
import { generateItems, opsFor, targetTimeMs, timeLimitMs, type ArithItem } from './generate'
import { LEVELS, type Range } from './levels'

const inRange = (n: number, [min, max]: Range) => n >= min && n <= max
const compute = ({ a, b, op }: ArithItem) =>
  op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b

describe('Speed Arithmetic generator', () => {
  it('has a spec for every level 1–20', () => {
    expect(LEVELS).toHaveLength(20)
  })

  for (let level = 1; level <= 20; level++) {
    it(`level ${level}: every item fits the level's rules`, () => {
      const spec = LEVELS[level - 1]!
      const ops = opsFor(spec)
      const [r1, r2] = spec.addSub
      for (let seed = 1; seed <= 200; seed++) {
        const items = generateItems(level, createRng(seed), 10)
        expect(items).toHaveLength(10)
        expect(new Set(items.map((i) => `${i.a}${i.op}${i.b}`)).size).toBe(10)
        for (const item of items) {
          expect(ops).toContain(item.op)
          expect(item.answer).toBe(compute(item))
          expect(Number.isInteger(item.answer)).toBe(true)
          expect(item.answer).toBeGreaterThanOrEqual(0)
          switch (item.op) {
            case '+':
              expect(inRange(item.a, r1) && inRange(item.b, r2)).toBe(true)
              break
            case '−': {
              const span: Range = [Math.min(r1[0], r2[0]), Math.max(r1[1], r2[1])]
              expect(item.a).toBeGreaterThanOrEqual(item.b)
              expect(inRange(item.a, span) && inRange(item.b, span)).toBe(true)
              break
            }
            case '×':
              expect(inRange(item.a, spec.mul![0]) && inRange(item.b, spec.mul![1])).toBe(true)
              break
            case '÷': {
              const div = spec.div!
              expect(inRange(item.b, div.divisor)).toBe(true)
              if ('quotient' in div) expect(inRange(item.answer, div.quotient)).toBe(true)
              else expect(inRange(item.a, div.dividend)).toBe(true)
              break
            }
          }
        }
      }
    })
  }

  it('uses only + and − at first, then adds × and ÷', () => {
    expect(opsFor(LEVELS[0]!)).toEqual(['+', '−'])
    expect(opsFor(LEVELS[3]!)).toEqual(['+', '−', '×'])
    expect(opsFor(LEVELS[5]!)).toEqual(['+', '−', '×', '÷'])
  })

  it('shrinks the time limit from 10 s to 5 s, with a 40% target', () => {
    expect(timeLimitMs(1)).toBe(10000)
    expect(timeLimitMs(10)).toBe(7632)
    expect(timeLimitMs(20)).toBe(5000)
    expect(targetTimeMs(1)).toBe(4000)
    expect(targetTimeMs(20)).toBe(2000)
  })

  it('is repeatable for a seed', () => {
    expect(generateItems(7, createRng(5))).toEqual(generateItems(7, createRng(5)))
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/games/speed-arithmetic`
Expected: FAIL — cannot resolve `./generate`.

- [ ] **Step 3: Implement the level table** — `src/games/speed-arithmetic/levels.ts`

```ts
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
  L1, L2, L3, L4, L5, L6, L7, L8, L8, L10,
  L10, L12, L12, L14, L14, L14, L17, L17, L17, L17,
]
```

(Prettier will reflow the `LEVELS` array; that's fine.)

- [ ] **Step 4: Implement the generator** — `src/games/speed-arithmetic/generate.ts`

```ts
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
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/games/speed-arithmetic`
Expected: PASS (24 tests).

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/games/speed-arithmetic
git add src/games/speed-arithmetic
git commit -m "Add Speed Arithmetic level table and generator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Game plug-in contract and number pad

**Files:**
- Create: `src/games/types.ts`, `src/components/NumberPad.tsx`, `src/components/NumberPad.module.css`
- Test: `src/components/NumberPad.test.tsx`

**Interfaces:**
- Consumes: `Rng` (`@/lib/rng`), `GameId` (`@/games/games`).
- Produces:
  - `types.ts`: `ItemFeedback = { correct: boolean; answerLabel: string }`; `ItemViewProps<Item, Answer> = { item: Item; onAnswer(answer: Answer): void; feedback: ItemFeedback | null }`; `GameModule<Item, Answer>` (fields: `id`, `itemsPerRound`, `generate`, `timeLimitMs`, `targetTimeMs`, `check`, `answerLabel`, `ItemView`); `AnyGameModule = GameModule<any, any>`.
  - `NumberPad` props: `{ value: string; onChange(value: string): void; answerLength: number; onSubmit(value: string): void; disabled?: boolean }`. Buttons are named `0`–`9` and `Delete`.

- [ ] **Step 1: Write the failing test** — `src/components/NumberPad.test.tsx`

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { NumberPad } from './NumberPad'

function Harness(props: { answerLength: number; onSubmit(v: string): void; disabled?: boolean }) {
  const [value, setValue] = useState('')
  return (
    <>
      <output data-testid="value">{value}</output>
      <NumberPad value={value} onChange={setValue} {...props} />
    </>
  )
}

const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('NumberPad', () => {
  it('submits once the typed length matches the answer, then clears', () => {
    const onSubmit = vi.fn()
    render(<Harness answerLength={2} onSubmit={onSubmit} />)
    press('1')
    expect(screen.getByTestId('value')).toHaveTextContent('1')
    expect(onSubmit).not.toHaveBeenCalled()
    press('5')
    expect(onSubmit).toHaveBeenCalledWith('15')
    expect(screen.getByTestId('value')).toHaveTextContent('')
  })

  it('submits a one-digit answer on the first press', () => {
    const onSubmit = vi.fn()
    render(<Harness answerLength={1} onSubmit={onSubmit} />)
    press('0')
    expect(onSubmit).toHaveBeenCalledWith('0')
  })

  it('deletes the last digit', () => {
    const onSubmit = vi.fn()
    render(<Harness answerLength={3} onSubmit={onSubmit} />)
    press('4')
    press('2')
    press('Delete')
    expect(screen.getByTestId('value')).toHaveTextContent('4')
  })

  it('accepts keyboard digits and Backspace', () => {
    const onSubmit = vi.fn()
    render(<Harness answerLength={2} onSubmit={onSubmit} />)
    fireEvent.keyDown(window, { key: '7' })
    fireEvent.keyDown(window, { key: 'Backspace' })
    fireEvent.keyDown(window, { key: '2' })
    fireEvent.keyDown(window, { key: '3' })
    expect(onSubmit).toHaveBeenCalledWith('23')
  })

  it('ignores input when disabled', () => {
    const onSubmit = vi.fn()
    render(<Harness answerLength={1} onSubmit={onSubmit} disabled />)
    press('3')
    fireEvent.keyDown(window, { key: '3' })
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/NumberPad.test.tsx`
Expected: FAIL — cannot resolve `./NumberPad`.

- [ ] **Step 3: Implement the contract** — `src/games/types.ts`

```ts
import type { ComponentType } from 'react'
import type { Rng } from '@/lib/rng'
import type { GameId } from './games'

export type ItemFeedback = { correct: boolean; answerLabel: string }

export type ItemViewProps<Item, Answer> = {
  item: Item
  onAnswer(answer: Answer): void
  /** Set while the round shows feedback for this item; input should be disabled. */
  feedback: ItemFeedback | null
}

/** What a game plugs into the shared round shell. */
export interface GameModule<Item, Answer> {
  id: GameId
  itemsPerRound: number
  generate(level: number, rng: Rng): Item[]
  /** Hard per-item limit; running out counts as wrong. */
  timeLimitMs(level: number): number
  /** "Fast" benchmark for the speed part of the score. */
  targetTimeMs(level: number): number
  check(item: Item, answer: Answer): boolean
  /** The correct answer as shown after a miss. */
  answerLabel(item: Item): string
  ItemView: ComponentType<ItemViewProps<Item, Answer>>
}

// Modules differ in Item/Answer; the shell only passes each module its own values back.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameModule = GameModule<any, any>
```

- [ ] **Step 4: Implement the number pad** — `src/components/NumberPad.tsx`

```tsx
import { useEffect } from 'react'
import styles from './NumberPad.module.css'

type Props = {
  value: string
  onChange(value: string): void
  /** Submits automatically once this many digits are typed. */
  answerLength: number
  onSubmit(value: string): void
  disabled?: boolean
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export function NumberPad({ value, onChange, answerLength, onSubmit, disabled = false }: Props) {
  function press(digit: string) {
    if (disabled) return
    const next = value + digit
    if (next.length >= answerLength) {
      onChange('')
      onSubmit(next)
    } else {
      onChange(next)
    }
  }

  function backspace() {
    if (!disabled) onChange(value.slice(0, -1))
  }

  // Desktop keyboard. Re-subscribes each render so the handler sees the current value.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        press(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        backspace()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className={styles.pad} role="group" aria-label="Number pad">
      {DIGITS.map((d) => (
        <button
          key={d}
          type="button"
          className={styles.key}
          onClick={() => press(d)}
          disabled={disabled}
        >
          {d}
        </button>
      ))}
      <span aria-hidden="true" />
      <button type="button" className={styles.key} onClick={() => press('0')} disabled={disabled}>
        0
      </button>
      <button
        type="button"
        className={`${styles.key} ${styles.back}`}
        onClick={backspace}
        disabled={disabled}
        aria-label="Delete"
      >
        ⌫
      </button>
    </div>
  )
}
```

`src/components/NumberPad.module.css`:

```css
.pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.key {
  min-height: 56px;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--ink);
  font-size: var(--text-xl);
  font-weight: 600;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  transition:
    transform var(--dur-fast) var(--ease-out),
    background var(--dur-fast);
}

.key:active:not(:disabled) {
  transform: scale(0.95);
  background: var(--surface-raised);
}

.key:disabled {
  opacity: 0.5;
  cursor: default;
}

.back {
  font-size: var(--text-lg);
  color: var(--ink-muted);
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/components/NumberPad.test.tsx && npm run typecheck && npm run lint`
Expected: PASS (5 tests); typecheck and lint clean. If oxlint reports the `eslint-disable-next-line` in `types.ts` as unused, delete that comment line.

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/games/types.ts src/components/NumberPad.tsx src/components/NumberPad.test.tsx src/components/NumberPad.module.css
git add src/games/types.ts src/components/NumberPad.tsx src/components/NumberPad.test.tsx src/components/NumberPad.module.css
git commit -m "Add game plug-in contract and shared number pad

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Speed Arithmetic module, view and registry

**Files:**
- Create: `src/games/speed-arithmetic/SpeedArithmeticView.tsx`, `src/games/speed-arithmetic/SpeedArithmeticView.module.css`, `src/games/speed-arithmetic/index.ts`, `src/games/registry.ts`
- Test: `src/games/speed-arithmetic/module.test.tsx`

**Interfaces:**
- Consumes: `GameModule`, `ItemViewProps`, `AnyGameModule` (Task 5); `NumberPad` (Task 5); `generateItems`, `timeLimitMs`, `targetTimeMs`, `ITEMS_PER_ROUND`, `ArithItem` (Task 4); `GameId` (`@/games/games`).
- Produces: `speedArithmetic: GameModule<ArithItem, string>`; `getGameModule(id: string): AnyGameModule | undefined`. The view renders `data-testid="problem"` (text like `47 + 8`) and `data-testid="answer"`.

- [ ] **Step 1: Write the failing test** — `src/games/speed-arithmetic/module.test.tsx`

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { getGameModule } from '@/games/registry'
import { createRng } from '@/lib/rng'
import type { ArithItem } from './generate'
import { speedArithmetic } from './index'
import { SpeedArithmeticView } from './SpeedArithmeticView'

const item: ArithItem = { a: 47, b: 8, op: '+', answer: 55 }
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('speedArithmetic module', () => {
  it('checks typed answers numerically', () => {
    expect(speedArithmetic.check(item, '55')).toBe(true)
    expect(speedArithmetic.check(item, '56')).toBe(false)
    expect(speedArithmetic.answerLabel(item)).toBe('55')
  })

  it('generates a round of 10', () => {
    expect(speedArithmetic.generate(1, createRng(1))).toHaveLength(10)
    expect(speedArithmetic.itemsPerRound).toBe(10)
  })

  it('is in the registry; unbuilt and unknown games are not', () => {
    expect(getGameModule('speed-arithmetic')).toBe(speedArithmetic)
    expect(getGameModule('rule-switch')).toBeUndefined()
    expect(getGameModule('nope')).toBeUndefined()
  })
})

describe('SpeedArithmeticView', () => {
  it('shows the problem and submits once enough digits are typed', () => {
    const onAnswer = vi.fn()
    render(<SpeedArithmeticView item={item} onAnswer={onAnswer} feedback={null} />)
    expect(screen.getByTestId('problem')).toHaveTextContent('47 + 8')
    press('5')
    expect(screen.getByTestId('answer')).toHaveTextContent('5')
    press('5')
    expect(onAnswer).toHaveBeenCalledWith('55')
  })

  it('shows the correct answer and locks the pad during feedback', () => {
    const onAnswer = vi.fn()
    render(
      <SpeedArithmeticView
        item={item}
        onAnswer={onAnswer}
        feedback={{ correct: false, answerLabel: '55' }}
      />,
    )
    expect(screen.getByTestId('answer')).toHaveTextContent('55')
    expect(screen.getByTestId('answer')).toHaveAttribute('data-state', 'wrong')
    expect(screen.getByRole('button', { name: '5' })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/games/speed-arithmetic/module.test.tsx`
Expected: FAIL — cannot resolve `./index` / `@/games/registry`.

- [ ] **Step 3: Implement the view** — `src/games/speed-arithmetic/SpeedArithmeticView.tsx`

```tsx
import { useState } from 'react'
import { NumberPad } from '@/components/NumberPad'
import type { ItemViewProps } from '@/games/types'
import type { ArithItem } from './generate'
import styles from './SpeedArithmeticView.module.css'

export function SpeedArithmeticView({ item, onAnswer, feedback }: ItemViewProps<ArithItem, string>) {
  const [typed, setTyped] = useState('')
  const state = feedback ? (feedback.correct ? 'right' : 'wrong') : 'typing'

  return (
    <div className={styles.view}>
      <div className={styles.display}>
        <p className={styles.problem} data-testid="problem">
          {item.a} {item.op} {item.b}
        </p>
        <p className={styles.answer} data-testid="answer" data-state={state} aria-live="polite">
          {feedback ? feedback.answerLabel : typed || ' '}
        </p>
      </div>
      <NumberPad
        value={typed}
        onChange={setTyped}
        answerLength={String(item.answer).length}
        onSubmit={onAnswer}
        disabled={feedback !== null}
      />
    </div>
  )
}
```

`src/games/speed-arithmetic/SpeedArithmeticView.module.css`:

```css
.view {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.display {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding-block: var(--space-5);
}

.problem {
  font-size: clamp(2.75rem, 14vw, 4.5rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.answer {
  min-height: 1.2em;
  font-size: clamp(2rem, 10vw, 3rem);
  font-weight: 600;
  color: var(--ink-muted);
}

.answer[data-state='right'] {
  color: var(--correct);
}

.answer[data-state='wrong'] {
  color: var(--incorrect);
}
```

- [ ] **Step 4: Implement the module and registry**

`src/games/speed-arithmetic/index.ts`:

```ts
import type { GameModule } from '@/games/types'
import { generateItems, ITEMS_PER_ROUND, targetTimeMs, timeLimitMs, type ArithItem } from './generate'
import { SpeedArithmeticView } from './SpeedArithmeticView'

export const speedArithmetic: GameModule<ArithItem, string> = {
  id: 'speed-arithmetic',
  itemsPerRound: ITEMS_PER_ROUND,
  generate: (level, rng) => generateItems(level, rng, ITEMS_PER_ROUND),
  timeLimitMs,
  targetTimeMs,
  check: (item, typed) => Number(typed) === item.answer,
  answerLabel: (item) => String(item.answer),
  ItemView: SpeedArithmeticView,
}
```

`src/games/registry.ts`:

```ts
import type { GameId } from './games'
import { speedArithmetic } from './speed-arithmetic'
import type { AnyGameModule } from './types'

/** Games that are playable. Games missing here show as "Coming soon". */
const GAME_MODULES: Partial<Record<GameId, AnyGameModule>> = {
  'speed-arithmetic': speedArithmetic,
}

export function getGameModule(id: string): AnyGameModule | undefined {
  return Object.hasOwn(GAME_MODULES, id) ? GAME_MODULES[id as GameId] : undefined
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/games && npm run typecheck && npm run lint`
Expected: PASS; typecheck and lint clean.

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/games
git add src/games
git commit -m "Add Speed Arithmetic game module, view and game registry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `record_round` database function

**Files:**
- Create: `supabase/migrations/20261009000000_record_round.sql`, `supabase/tests/record_round.test.sql`
- Modify: `src/lib/database.types.ts` (regenerated, not hand-edited)

**Interfaces:**
- Produces: RPC `record_round(p_id uuid, p_game_id text, p_level smallint, p_new_level smallint, p_score smallint, p_accuracy real, p_avg_response_ms integer, p_played_at timestamptz) returns boolean` — `true` when recorded, `false` for a duplicate id. Callable by `authenticated` only.

- [ ] **Step 1: Write the failing pgTAP test** — `supabase/tests/record_round.test.sql`

Each pgTAP assertion must start a line with `select <fn>(` so `scripts/db-test.mjs` can capture it.

```sql
-- record_round: saves a round + progress once, ignores resends and stale levels, stays per-user.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');
insert into public.game_progress (user_id, game_id, level, best_score, rounds_played, last_played_at) values
  ('00000000-0000-0000-0000-00000000000b', 'speed-arithmetic', 9, 70, 5, '2026-10-01 10:00+00');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1-2: the first round is recorded with its progress
select is(
  public.record_round('10000000-0000-0000-0000-000000000001', 'speed-arithmetic', 3::smallint, 4::smallint, 85::smallint, 0.9::real, 2100, '2026-10-09 10:00+00'),
  true, 'first call records the round');
select results_eq(
  $$ select level::int, best_score::int, rounds_played from public.game_progress $$,
  $$ values (4, 85, 1) $$, 'progress created from the round');

-- 3-4: resending the same id changes nothing
select is(
  public.record_round('10000000-0000-0000-0000-000000000001', 'speed-arithmetic', 3::smallint, 4::smallint, 85::smallint, 0.9::real, 2100, '2026-10-09 10:00+00'),
  false, 'resend returns false');
select results_eq(
  $$ select (select count(*)::int from public.rounds), (select rounds_played from public.game_progress) $$,
  $$ values (1, 1) $$, 'resend adds no round and does not recount');

-- 5-6: an older round counts but does not roll the level back
select is(
  public.record_round('10000000-0000-0000-0000-000000000002', 'speed-arithmetic', 2::smallint, 2::smallint, 95::smallint, 1::real, 1500, '2026-10-09 09:00+00'),
  true, 'older round is recorded');
select results_eq(
  $$ select level::int, best_score::int, rounds_played, last_played_at from public.game_progress $$,
  $$ values (4, 95, 2, '2026-10-09 10:00+00'::timestamptz) $$, 'older round keeps the newer level');

-- 7-8: a newer round moves the level and keeps the best
select is(
  public.record_round('10000000-0000-0000-0000-000000000003', 'speed-arithmetic', 4::smallint, 5::smallint, 40::smallint, 0.5::real, 3000, '2026-10-09 11:00+00'),
  true, 'newer round is recorded');
select results_eq(
  $$ select level::int, best_score::int, rounds_played from public.game_progress $$,
  $$ values (5, 95, 3) $$, 'newer round sets the level and keeps the best');

-- 9: the rounds belong to the caller
select results_eq(
  $$ select count(*)::int from public.rounds where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  array[3], 'all rounds owned by A');

-- 10: the other user's progress is untouched
reset role;
select results_eq(
  $$ select level::int, rounds_played from public.game_progress where user_id = '00000000-0000-0000-0000-00000000000b' $$,
  $$ values (9, 5) $$, 'other user progress untouched');

-- 11: anon cannot call it
set local role anon;
select throws_ok(
  $$ select public.record_round('10000000-0000-0000-0000-000000000004', 'speed-arithmetic', 1::smallint, 1::smallint, 0::smallint, 0::real, 0, now()) $$,
  '42501', null, 'anon cannot execute record_round');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run db:test`
Expected: `rls.test.sql` passes; `record_round.test.sql` fails with an error that `public.record_round` does not exist (exit code 1).

- [ ] **Step 3: Write the migration** — `supabase/migrations/20261009000000_record_round.sql`

```sql
-- Records one finished round and updates game_progress in a single call.
-- Idempotent: the client supplies the round id, so resending a synced round is a no-op.
-- Runs as the caller (security invoker), so the existing owner-only RLS still applies.
create or replace function public.record_round(
  p_id uuid,
  p_game_id text,
  p_level smallint,
  p_new_level smallint,
  p_score smallint,
  p_accuracy real,
  p_avg_response_ms integer,
  p_played_at timestamptz
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inserted uuid;
begin
  insert into public.rounds (id, game_id, level, score, accuracy, avg_response_ms, played_at)
  values (p_id, p_game_id, p_level, p_score, p_accuracy, p_avg_response_ms, p_played_at)
  on conflict (id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    return false;
  end if;

  insert into public.game_progress as gp
    (user_id, game_id, level, best_score, rounds_played, last_played_at)
  values (auth.uid(), p_game_id, p_new_level, p_score, 1, p_played_at)
  on conflict (user_id, game_id) do update set
    rounds_played = gp.rounds_played + 1,
    best_score = greatest(gp.best_score, excluded.best_score),
    -- A round that syncs late must not roll the level back.
    level = case
      when excluded.last_played_at >= coalesce(gp.last_played_at, '-infinity'::timestamptz)
        then excluded.level
      else gp.level
    end,
    last_played_at = greatest(gp.last_played_at, excluded.last_played_at);

  return true;
end;
$$;

revoke execute on function public.record_round(uuid, text, smallint, smallint, smallint, real, integer, timestamptz)
  from public, anon;
grant execute on function public.record_round(uuid, text, smallint, smallint, smallint, real, integer, timestamptz)
  to authenticated;
```

- [ ] **Step 4: Preview, push and test against the hosted database**

Run: `npm run db:push:dry`
Expected: lists only `20261009000000_record_round.sql`.

Run: `supabase db push --linked --yes`
Expected: `Applying migration 20261009000000_record_round.sql...` then `Finished supabase db push.` (a "Docker" cache warning is harmless).

Run: `npm run db:test; echo "exit=$?"`
Expected: both files print `ok` lines only (25 + 11), `exit=0`.

- [ ] **Step 5: Regenerate types**

Run: `npm run db:types && grep -n "record_round" src/lib/database.types.ts && npm run typecheck`
Expected: `record_round` appears under `Functions` with `Args` `p_id`, `p_game_id`, …; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261009000000_record_round.sql supabase/tests/record_round.test.sql src/lib/database.types.ts
git commit -m "Add idempotent record_round database function with pgTAP tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Progress store, Supabase adapters and provider

**Files:**
- Create: `src/data/progress.ts`, `src/data/supabaseProgress.ts`, `src/data/ProgressProvider.tsx`
- Modify: `src/App.tsx` (wrap the router in `ProgressProvider`)
- Test: `src/data/progress.test.ts`, `src/data/supabaseProgress.test.ts`

**Interfaces:**
- Consumes: `GameId` (`@/games/games`); `supabase` (`@/lib/supabase`); `useAuth` (`@/auth/AuthProvider`); `record_round` RPC (Task 7).
- Produces (`progress.ts`):
  - Types: `GameProgress = { level: number; bestScore: number | null; roundsPlayed: number; lastPlayedAt: string | null }`; `PendingRound = { id: string; gameId: GameId; level: number; newLevel: number; score: number; accuracy: number; avgResponseMs: number; playedAt: string }`; `RoundInput = Omit<PendingRound, 'id' | 'playedAt'>`; `SaveStatus = 'synced' | 'pending' | 'rejected'`; `SendResult = { ok: true } | { ok: false; retry: boolean; message: string }`; `ServerProgress = GameProgress & { gameId: GameId }`; `KeyValueStorage`; `ProgressStore`.
  - `DEFAULT_PROGRESS`; `createProgressStore(opts): ProgressStore` with `getGame`, `pendingCount`, `recordRound(input): Promise<SaveStatus>`, `flush`, `pullServerProgress`, `subscribe`.
- Produces (`supabaseProgress.ts`): `isRetryable(code: string | undefined): boolean`, `sendRound(round): Promise<SendResult>`, `fetchServerProgress(): Promise<ServerProgress[] | null>`, `browserStorage(): KeyValueStorage | null`.
- Produces (`ProgressProvider.tsx`): `ProgressContext` (value `ProgressStore | null`), `ProgressProvider`, `useProgressStore(): ProgressStore | null`, `useGameProgress(gameId: GameId | undefined): GameProgress`.

- [ ] **Step 1: Write the failing store test** — `src/data/progress.test.ts`

```ts
import {
  createProgressStore,
  type KeyValueStorage,
  type RoundInput,
  type SendResult,
  type ServerProgress,
} from './progress'

function memoryStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) }
}

const input = (overrides: Partial<RoundInput> = {}): RoundInput => ({
  gameId: 'speed-arithmetic',
  level: 3,
  newLevel: 4,
  score: 85,
  accuracy: 0.9,
  avgResponseMs: 2100,
  ...overrides,
})

function setup(opts: {
  send?: (r: unknown) => Promise<SendResult>
  fetchServer?: () => Promise<ServerProgress[] | null>
  storage?: KeyValueStorage | null
} = {}) {
  const storage = opts.storage === undefined ? memoryStorage() : opts.storage
  const send = vi.fn(opts.send ?? (async (): Promise<SendResult> => ({ ok: true })))
  const fetchServer = vi.fn(opts.fetchServer ?? (async () => []))
  let n = 0
  const store = createProgressStore({
    storage,
    key: 'k',
    send,
    fetchServer,
    newId: () => `id-${++n}`,
    now: () => new Date('2026-10-09T10:00:00.000Z'),
  })
  return { store, storage, send, fetchServer }
}

describe('progress store', () => {
  it('defaults an unplayed game to level 1', () => {
    const { store } = setup()
    expect(store.getGame('speed-arithmetic')).toEqual({
      level: 1,
      bestScore: null,
      roundsPlayed: 0,
      lastPlayedAt: null,
    })
  })

  it('updates progress immediately, sends the round and reports synced', async () => {
    const { store, send, storage } = setup()
    await expect(store.recordRound(input())).resolves.toBe('synced')
    expect(store.getGame('speed-arithmetic')).toEqual({
      level: 4,
      bestScore: 85,
      roundsPlayed: 1,
      lastPlayedAt: '2026-10-09T10:00:00.000Z',
    })
    expect(send).toHaveBeenCalledWith({
      ...input(),
      id: 'id-1',
      playedAt: '2026-10-09T10:00:00.000Z',
    })
    expect(store.pendingCount()).toBe(0)
    expect(JSON.parse((storage as ReturnType<typeof memoryStorage>).map.get('k')!).games).toHaveProperty(
      'speed-arithmetic',
    )
  })

  it('keeps the round when the network fails, and sends it on the next flush', async () => {
    let online = false
    const { store, send } = setup({
      send: async () => (online ? { ok: true } : { ok: false, retry: true, message: 'offline' }),
    })
    await expect(store.recordRound(input())).resolves.toBe('pending')
    expect(store.pendingCount()).toBe(1)
    expect(store.getGame('speed-arithmetic').level).toBe(4)
    online = true
    await store.flush()
    expect(store.pendingCount()).toBe(0)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('drops a round the database rejects so it cannot block the queue', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { store } = setup({
      send: async () => ({ ok: false, retry: false, message: 'violates check constraint' }),
    })
    await expect(store.recordRound(input())).resolves.toBe('rejected')
    expect(store.pendingCount()).toBe(0)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('sends queued rounds in order', async () => {
    let online = false
    const sent: string[] = []
    const { store } = setup({
      send: async (r) => {
        if (!online) return { ok: false, retry: true, message: 'offline' }
        sent.push((r as { id: string }).id)
        return { ok: true }
      },
    })
    await store.recordRound(input())
    await store.recordRound(input({ score: 40 }))
    online = true
    await store.flush()
    expect(sent).toEqual(['id-1', 'id-2'])
  })

  it('keeps the best score', async () => {
    const { store } = setup()
    await store.recordRound(input({ score: 90 }))
    await store.recordRound(input({ score: 60 }))
    expect(store.getGame('speed-arithmetic').bestScore).toBe(90)
    expect(store.getGame('speed-arithmetic').roundsPlayed).toBe(2)
  })

  it('reloads saved progress and outbox from storage', async () => {
    const storage = memoryStorage()
    const offline = async (): Promise<SendResult> => ({ ok: false, retry: true, message: 'x' })
    await setup({ storage, send: offline }).store.recordRound(input())
    const { store } = setup({ storage, send: offline })
    expect(store.getGame('speed-arithmetic').level).toBe(4)
    expect(store.pendingCount()).toBe(1)
  })

  it('merges server progress, keeping whichever record is newer', async () => {
    const { store } = setup({
      fetchServer: async () => [
        { gameId: 'speed-arithmetic', level: 9, bestScore: 99, roundsPlayed: 50, lastPlayedAt: '2026-10-09T09:00:00+00:00' },
        { gameId: 'money-maths', level: 6, bestScore: 70, roundsPlayed: 8, lastPlayedAt: '2026-10-08T09:00:00+00:00' },
      ],
    })
    await store.recordRound(input()) // local speed-arithmetic at 10:00
    await store.pullServerProgress()
    expect(store.getGame('speed-arithmetic').level).toBe(4)
    expect(store.getGame('money-maths').level).toBe(6)
  })

  it('adopts a newer server record', async () => {
    const { store } = setup({
      fetchServer: async () => [
        { gameId: 'speed-arithmetic', level: 9, bestScore: 99, roundsPlayed: 50, lastPlayedAt: '2026-10-09T11:00:00+00:00' },
      ],
    })
    await store.recordRound(input())
    await store.pullServerProgress()
    expect(store.getGame('speed-arithmetic').level).toBe(9)
  })

  it('works with no storage at all', async () => {
    const { store } = setup({ storage: null })
    await expect(store.recordRound(input())).resolves.toBe('synced')
    expect(store.getGame('speed-arithmetic').level).toBe(4)
  })

  it('notifies subscribers on change', async () => {
    const { store } = setup()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    await store.recordRound(input())
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    listener.mockClear()
    await store.recordRound(input())
    expect(listener).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/data/progress.test.ts`
Expected: FAIL — cannot resolve `./progress`.

- [ ] **Step 3: Implement the store** — `src/data/progress.ts`

```ts
import type { GameId } from '@/games/games'

export type GameProgress = {
  level: number
  bestScore: number | null
  roundsPlayed: number
  lastPlayedAt: string | null
}

export type PendingRound = {
  id: string
  gameId: GameId
  level: number
  newLevel: number
  score: number
  accuracy: number
  avgResponseMs: number
  playedAt: string
}

export type RoundInput = Omit<PendingRound, 'id' | 'playedAt'>
export type SaveStatus = 'synced' | 'pending' | 'rejected'
export type SendResult = { ok: true } | { ok: false; retry: boolean; message: string }
export type ServerProgress = GameProgress & { gameId: GameId }
export type KeyValueStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type ProgressStore = {
  getGame(gameId: GameId): GameProgress
  pendingCount(): number
  /** Updates local progress immediately, queues the round, then tries to send it. */
  recordRound(input: RoundInput): Promise<SaveStatus>
  flush(): Promise<void>
  pullServerProgress(): Promise<void>
  subscribe(listener: () => void): () => void
}

export type ProgressStoreOptions = {
  /** null = keep everything in memory (storage blocked). */
  storage: KeyValueStorage | null
  key: string
  send(round: PendingRound): Promise<SendResult>
  fetchServer(): Promise<ServerProgress[] | null>
  newId?: () => string
  now?: () => Date
}

type Persisted = { games: Partial<Record<GameId, GameProgress>>; outbox: PendingRound[] }

export const DEFAULT_PROGRESS: GameProgress = Object.freeze({
  level: 1,
  bestScore: null,
  roundsPlayed: 0,
  lastPlayedAt: null,
})

const time = (iso: string | null) => (iso ? Date.parse(iso) : -Infinity)

export function createProgressStore(opts: ProgressStoreOptions): ProgressStore {
  const newId = opts.newId ?? (() => crypto.randomUUID())
  const now = opts.now ?? (() => new Date())
  const listeners = new Set<() => void>()
  const rejected = new Set<string>()
  let inFlight: Promise<void> | null = null
  let state: Persisted = load()

  function load(): Persisted {
    try {
      const raw = opts.storage?.getItem(opts.key)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Persisted>
        return { games: parsed.games ?? {}, outbox: parsed.outbox ?? [] }
      }
    } catch {
      // Corrupt or unreadable storage: start fresh.
    }
    return { games: {}, outbox: [] }
  }

  function commit(next: Persisted) {
    state = next
    try {
      opts.storage?.setItem(opts.key, JSON.stringify(state))
    } catch {
      // Storage full or blocked: keep going in memory.
    }
    listeners.forEach((listener) => listener())
  }

  async function runFlush() {
    while (state.outbox.length > 0) {
      const round = state.outbox[0]!
      let result: SendResult
      try {
        result = await opts.send(round)
      } catch (e) {
        result = { ok: false, retry: true, message: String(e) }
      }
      if (!result.ok && result.retry) return
      if (!result.ok) {
        console.error(`Dropped round ${round.id}: ${result.message}`)
        rejected.add(round.id)
      }
      commit({ ...state, outbox: state.outbox.filter((r) => r.id !== round.id) })
    }
  }

  async function flush(): Promise<void> {
    // One run at a time; a caller arriving mid-run waits, then runs again to catch new rounds.
    while (inFlight) await inFlight
    inFlight = runFlush().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  return {
    getGame: (gameId) => state.games[gameId] ?? DEFAULT_PROGRESS,

    pendingCount: () => state.outbox.length,

    async recordRound(input) {
      const round: PendingRound = { ...input, id: newId(), playedAt: now().toISOString() }
      const prev = state.games[input.gameId] ?? DEFAULT_PROGRESS
      commit({
        games: {
          ...state.games,
          [input.gameId]: {
            level: input.newLevel,
            bestScore: prev.bestScore === null ? input.score : Math.max(prev.bestScore, input.score),
            roundsPlayed: prev.roundsPlayed + 1,
            lastPlayedAt: round.playedAt,
          },
        },
        outbox: [...state.outbox, round],
      })
      await flush()
      if (rejected.has(round.id)) return 'rejected'
      return state.outbox.some((r) => r.id === round.id) ? 'pending' : 'synced'
    },

    flush,

    async pullServerProgress() {
      const rows = await opts.fetchServer()
      if (!rows) return
      const games = { ...state.games }
      for (const { gameId, ...server } of rows) {
        const local = games[gameId]
        if (!local || time(server.lastPlayedAt) > time(local.lastPlayedAt)) games[gameId] = server
      }
      commit({ ...state, games })
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
```

- [ ] **Step 4: Run the store test to verify it passes**

Run: `npx vitest run src/data/progress.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Write the failing adapter test** — `src/data/supabaseProgress.test.ts`

```ts
import { isRetryable } from './supabaseProgress'

describe('isRetryable', () => {
  it.each([
    ['', true], // network failure: supabase-js reports no code
    [undefined, true],
    ['PGRST301', true], // expired JWT: retry after the session refreshes
    ['23514', false], // check constraint
    ['42501', false], // permission denied
    ['22P02', false], // invalid input syntax
  ])('code %s → retry %s', (code, expected) => {
    expect(isRetryable(code)).toBe(expected)
  })
})
```

Run: `npx vitest run src/data/supabaseProgress.test.ts`
Expected: FAIL — cannot resolve `./supabaseProgress`.

- [ ] **Step 6: Implement the adapters** — `src/data/supabaseProgress.ts`

```ts
import type { GameId } from '@/games/games'
import { supabase } from '@/lib/supabase'
import type { KeyValueStorage, PendingRound, SendResult, ServerProgress } from './progress'

/** Postgres errors (5-char SQLSTATE) won't succeed on retry; anything else (network, auth) might. */
export function isRetryable(code: string | undefined): boolean {
  return !/^[0-9A-Z]{5}$/.test(code ?? '')
}

export async function sendRound(round: PendingRound): Promise<SendResult> {
  try {
    const { error } = await supabase.rpc('record_round', {
      p_id: round.id,
      p_game_id: round.gameId,
      p_level: round.level,
      p_new_level: round.newLevel,
      p_score: round.score,
      p_accuracy: round.accuracy,
      p_avg_response_ms: round.avgResponseMs,
      p_played_at: round.playedAt,
    })
    if (!error) return { ok: true }
    return { ok: false, retry: isRetryable(error.code), message: error.message }
  } catch (e) {
    return { ok: false, retry: true, message: String(e) }
  }
}

export async function fetchServerProgress(): Promise<ServerProgress[] | null> {
  const { data, error } = await supabase
    .from('game_progress')
    .select('game_id, level, best_score, rounds_played, last_played_at')
  if (error || !data) return null
  return data.map((row) => ({
    gameId: row.game_id as GameId,
    level: row.level,
    bestScore: row.best_score,
    roundsPlayed: row.rounds_played,
    lastPlayedAt: row.last_played_at,
  }))
}

/** localStorage if it works; null (memory only) in private mode or when blocked. */
export function browserStorage(): KeyValueStorage | null {
  try {
    const probe = 'brian.probe'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}
```

Run: `npx vitest run src/data && npm run typecheck`
Expected: PASS; typecheck clean (if `rpc` argument types mismatch, re-run `npm run db:types` from Task 7).

- [ ] **Step 7: Implement the provider** — `src/data/ProgressProvider.tsx`

```tsx
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import type { GameId } from '@/games/games'
import { createProgressStore, DEFAULT_PROGRESS, type GameProgress, type ProgressStore } from './progress'
import { browserStorage, fetchServerProgress, sendRound } from './supabaseProgress'

// eslint-disable-next-line react/only-export-components
export const ProgressContext = createContext<ProgressStore | null>(null)

/** One store per signed-in user. Syncs on sign-in/app load and whenever the device comes back online. */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const store = useMemo(
    () =>
      userId
        ? createProgressStore({
            storage: browserStorage(),
            key: `brian.progress.v1.${userId}`,
            send: sendRound,
            fetchServer: fetchServerProgress,
          })
        : null,
    [userId],
  )

  useEffect(() => {
    if (!store) return
    void store.pullServerProgress().then(() => store.flush())
    const onOnline = () => void store.flush()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [store])

  return <ProgressContext.Provider value={store}>{children}</ProgressContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useProgressStore(): ProgressStore | null {
  return useContext(ProgressContext)
}

const noopSubscribe = () => () => {}

// eslint-disable-next-line react/only-export-components
export function useGameProgress(gameId: GameId | undefined): GameProgress {
  const store = useProgressStore()
  return useSyncExternalStore(store?.subscribe ?? noopSubscribe, () =>
    store && gameId ? store.getGame(gameId) : DEFAULT_PROGRESS,
  )
}
```

- [ ] **Step 8: Wire the provider into the app** — `src/App.tsx`

Add the import:

```tsx
import { ProgressProvider } from '@/data/ProgressProvider'
```

and wrap `<BrowserRouter>…</BrowserRouter>` so the tree reads:

```tsx
    <ThemeProvider>
      <AuthProvider>
        <ProgressProvider>
          <BrowserRouter>
            {/* …existing <Routes> unchanged… */}
          </BrowserRouter>
        </ProgressProvider>
      </AuthProvider>
    </ThemeProvider>
```

- [ ] **Step 9: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all tests pass; typecheck and lint clean.

- [ ] **Step 10: Commit**

```bash
npx prettier --write src/data src/App.tsx
git add src/data src/App.tsx
git commit -m "Add offline-safe progress store with Supabase sync

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Round screen, run and summary

**Files:**
- Create: `src/round/RoundScreen.tsx`, `src/round/RoundRun.tsx`, `src/round/RoundSummary.tsx`, `src/round/RoundScreen.module.css`
- Modify: `src/App.tsx` (add the `/play/:gameId` route)
- Test: `src/round/RoundScreen.test.tsx`

**Interfaces:**
- Consumes: `getGameModule` (Task 6); `AnyGameModule` (Task 5); `initRound`, `roundReducer`, `lastResult`, `RoundEvent`, `RoundState` (Task 3); `scoreRound`, `nextLevel` (Task 2); `createRng` (Task 1); `ProgressStore`, `SaveStatus` (Task 8); `useGameProgress`, `useProgressStore`, `ProgressContext` (Task 8); `gameById` (`@/games/games`); `TRACKS` (`@/games/tracks`); `ui` button classes (`@/components/ui.module.css`).
- Produces: `RoundScreen` (route element). Accessible names used by tests: buttons `Start`, `Quit round`, `Back to games`, `Play again`, `Done`; score has `aria-label="Score N out of 100"`; feedback wrapper `data-testid="stage"` with `data-feedback="correct" | "wrong"`.

- [ ] **Step 1: Write the failing test** — `src/round/RoundScreen.test.tsx`

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProgressContext } from '@/data/ProgressProvider'
import { createProgressStore, type PendingRound, type SendResult } from '@/data/progress'
import { RoundScreen } from './RoundScreen'

function solve(text: string) {
  const [a, op, b] = text.split(' ')
  const x = Number(a)
  const y = Number(b)
  return String(op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y)
}
/** Same length as the answer but different, so the pad auto-submits a wrong answer. */
const wrongFor = (answer: string) =>
  answer
    .split('')
    .map((d) => (d === '9' ? '8' : String(Number(d) + 1)))
    .join('')
const type = (digits: string) => {
  for (const d of digits) fireEvent.click(screen.getByRole('button', { name: d }))
}
const problem = () => screen.getByTestId('problem').textContent!
const flushPromises = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve()
  })

function renderRound(path = '/play/speed-arithmetic') {
  const send = vi.fn(async (_round: PendingRound): Promise<SendResult> => ({ ok: true }))
  const store = createProgressStore({
    storage: null,
    key: 'test',
    send,
    fetchServer: async () => [],
  })
  render(
    <ProgressContext.Provider value={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/play" element={<p>games list</p>} />
          <Route path="/play/:gameId" element={<RoundScreen />} />
        </Routes>
      </MemoryRouter>
    </ProgressContext.Provider>,
  )
  return { store, send }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('RoundScreen', () => {
  it('plays a full round, shows the summary and saves it', async () => {
    const { store, send } = renderRound()
    expect(screen.getByText('Level 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    for (let i = 0; i < 10; i++) {
      type(solve(problem()))
      act(() => vi.advanceTimersByTime(250))
    }

    expect(screen.getByLabelText('Score 100 out of 100')).toBeInTheDocument()
    expect(screen.getByText('1 → 2')).toBeInTheDocument()
    expect(screen.getByText('New personal best')).toBeInTheDocument()
    await flushPromises()
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![0]).toMatchObject({
      gameId: 'speed-arithmetic',
      level: 1,
      newLevel: 2,
      score: 100,
      accuracy: 1,
    })
    expect(store.getGame('speed-arithmetic').level).toBe(2)
  })

  it('shows the right answer after a wrong answer and after a timeout', () => {
    renderRound()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    const first = solve(problem())
    type(wrongFor(first))
    expect(screen.getByTestId('answer')).toHaveTextContent(first)
    expect(screen.getByTestId('stage')).toHaveAttribute('data-feedback', 'wrong')

    act(() => vi.advanceTimersByTime(1000))
    const second = solve(problem())
    act(() => vi.advanceTimersByTime(10000)) // level 1 limit
    expect(screen.getByTestId('answer')).toHaveTextContent(second)
    expect(screen.getByTestId('stage')).toHaveAttribute('data-feedback', 'wrong')
  })

  it('saves nothing when you quit mid-round', () => {
    const { store, send } = renderRound()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    type(solve(problem()))
    fireEvent.click(screen.getByRole('button', { name: 'Quit round' }))
    expect(screen.getByText('games list')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(20000))
    expect(send).not.toHaveBeenCalled()
    expect(store.getGame('speed-arithmetic').roundsPlayed).toBe(0)
  })

  it('sends unknown or unbuilt games back to the library', () => {
    renderRound('/play/rule-switch')
    expect(screen.getByText('games list')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/round/RoundScreen.test.tsx`
Expected: FAIL — cannot resolve `./RoundScreen`.

- [ ] **Step 3: Implement the summary** — `src/round/RoundSummary.tsx`

```tsx
import ui from '@/components/ui.module.css'
import type { SaveStatus } from '@/data/progress'
import styles from './RoundScreen.module.css'

type Props = {
  gameName: string
  score: number
  accuracy: number
  avgResponseMs: number
  level: number
  newLevel: number
  isPersonalBest: boolean
  saveStatus: SaveStatus | 'saving'
  onPlayAgain(): void
  onDone(): void
}

const SAVE_TEXT: Record<Props['saveStatus'], string> = {
  saving: 'Saving…',
  synced: 'Saved',
  pending: 'Saved on this phone. It’ll sync when you’re back online.',
  rejected: 'Couldn’t save this round.',
}

export function RoundSummary(p: Props) {
  const levelText = p.newLevel === p.level ? `Holds at ${p.level}` : `${p.level} → ${p.newLevel}`
  const change = p.newLevel > p.level ? 'up' : p.newLevel < p.level ? 'down' : 'same'

  return (
    <div className={styles.summary}>
      <p className={styles.summaryGame}>{p.gameName}</p>
      <p className={styles.score} aria-label={`Score ${p.score} out of 100`}>
        {p.score}
      </p>
      {p.isPersonalBest && <p className={styles.best}>New personal best</p>}
      <dl className={styles.stats}>
        <div>
          <dt>Accuracy</dt>
          <dd>{Math.round(p.accuracy * 100)}%</dd>
        </div>
        <div>
          <dt>Average time</dt>
          <dd>{(p.avgResponseMs / 1000).toFixed(1)} s</dd>
        </div>
        <div>
          <dt>Level</dt>
          <dd data-change={change}>{levelText}</dd>
        </div>
      </dl>
      <p className={styles.save} role="status">
        {SAVE_TEXT[p.saveStatus]}
      </p>
      <div className={styles.actions}>
        <button className={`${ui.button} ${ui.quiet}`} onClick={p.onDone}>
          Done
        </button>
        <button className={`${ui.button} ${styles.trackButton}`} onClick={p.onPlayAgain}>
          Play again
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement one round** — `src/round/RoundRun.tsx`

```tsx
import { useEffect, useReducer, useRef, useState } from 'react'
import type { ProgressStore, SaveStatus } from '@/data/progress'
import type { AnyGameModule } from '@/games/types'
import { initRound, lastResult, roundReducer, type RoundEvent, type RoundState } from './engine'
import { RoundSummary } from './RoundSummary'
import styles from './RoundScreen.module.css'
import { nextLevel, scoreRound } from './scoring'

export const CORRECT_PAUSE_MS = 250
export const WRONG_PAUSE_MS = 1000

type Props = {
  gameModule: AnyGameModule
  gameName: string
  level: number
  prevBest: number | null
  items: readonly unknown[]
  store: ProgressStore
  onQuit(): void
  onPlayAgain(): void
  onDone(): void
}

const reducer = (state: RoundState<unknown>, event: RoundEvent) => roundReducer(state, event)

export function RoundRun(props: Props) {
  const { gameModule, level, items, store } = props
  const [state, dispatch] = useReducer(reducer, items, initRound)
  const [saveStatus, setSaveStatus] = useState<SaveStatus | 'saving'>('saving')
  const saved = useRef(false)
  const limit = gameModule.timeLimitMs(level)
  const result = lastResult(state)

  // Start once mounted (a second dispatch under StrictMode is ignored by the engine).
  useEffect(() => {
    dispatch({ type: 'start', now: Date.now() })
  }, [])

  // Per-item hard limit.
  useEffect(() => {
    if (state.phase !== 'item') return
    const remaining = Math.max(0, limit - (Date.now() - state.itemStartedAt))
    const t = setTimeout(() => dispatch({ type: 'timeout', now: Date.now() }), remaining)
    return () => clearTimeout(t)
  }, [state.phase, state.index, state.itemStartedAt, limit])

  // Feedback pause, then the next item.
  useEffect(() => {
    if (state.phase !== 'feedback') return
    const pause = result?.correct ? CORRECT_PAUSE_MS : WRONG_PAUSE_MS
    const t = setTimeout(() => dispatch({ type: 'next', now: Date.now() }), pause)
    return () => clearTimeout(t)
  }, [state.phase, state.index, result?.correct])

  const stats = state.phase === 'done' ? scoreRound(state.results, gameModule.targetTimeMs(level)) : null
  const newLevel = stats ? nextLevel(level, stats.score) : level

  // Save exactly once when the round finishes.
  useEffect(() => {
    if (!stats || saved.current) return
    saved.current = true
    void store
      .recordRound({
        gameId: gameModule.id,
        level,
        newLevel,
        score: stats.score,
        accuracy: stats.accuracy,
        avgResponseMs: Math.round(stats.avgResponseMs),
      })
      .then(setSaveStatus)
  }, [state.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (stats) {
    const isPersonalBest = props.prevBest === null ? stats.score > 0 : stats.score > props.prevBest
    return (
      <RoundSummary
        gameName={props.gameName}
        score={stats.score}
        accuracy={stats.accuracy}
        avgResponseMs={stats.avgResponseMs}
        level={level}
        newLevel={newLevel}
        isPersonalBest={isPersonalBest}
        saveStatus={saveStatus}
        onPlayAgain={props.onPlayAgain}
        onDone={props.onDone}
      />
    )
  }

  const item = state.items[state.index]
  const feedback =
    state.phase === 'feedback' && result
      ? { correct: result.correct, answerLabel: gameModule.answerLabel(item) }
      : null
  const ItemView = gameModule.ItemView

  return (
    <div className={styles.run}>
      <div className={styles.top}>
        <button className={styles.quit} onClick={props.onQuit} aria-label="Quit round">
          ✕
        </button>
        <ol
          className={styles.segments}
          aria-label={`Question ${state.index + 1} of ${state.items.length}`}
        >
          {state.items.map((_, i) => {
            const r = state.results[i]
            const status = r
              ? r.correct
                ? 'right'
                : 'wrong'
              : i === state.index
                ? 'current'
                : 'upcoming'
            return <li key={i} className={styles.segment} data-status={status} />
          })}
        </ol>
      </div>
      <div className={styles.timerTrack} aria-hidden="true">
        <div
          key={state.index}
          className={styles.timerFill}
          data-running={state.phase === 'item'}
          style={{ animationDuration: `${limit}ms` }}
        />
      </div>
      <div
        className={styles.stage}
        data-testid="stage"
        data-feedback={feedback ? (feedback.correct ? 'correct' : 'wrong') : undefined}
      >
        <ItemView
          key={state.index}
          item={item}
          feedback={feedback}
          onAnswer={(answer: unknown) =>
            dispatch({ type: 'answer', correct: gameModule.check(item, answer), now: Date.now() })
          }
        />
      </div>
    </div>
  )
}
```

(If `npm run lint` flags the `eslint-disable-line` comment as unused, delete the comment.)

- [ ] **Step 5: Implement the route screen** — `src/round/RoundScreen.tsx`

```tsx
import { useState, type CSSProperties } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import ui from '@/components/ui.module.css'
import { useGameProgress, useProgressStore } from '@/data/ProgressProvider'
import { gameById } from '@/games/games'
import { getGameModule } from '@/games/registry'
import { TRACKS } from '@/games/tracks'
import { createRng } from '@/lib/rng'
import { RoundRun } from './RoundRun'
import styles from './RoundScreen.module.css'

type Run = { id: number; level: number; prevBest: number | null; items: readonly unknown[] }

export function RoundScreen() {
  const { gameId = '' } = useParams()
  const gameModule = getGameModule(gameId)
  const store = useProgressStore()
  const progress = useGameProgress(gameModule?.id)
  const navigate = useNavigate()
  const [run, setRun] = useState<Run | null>(null)

  if (!gameModule || !store) return <Navigate to="/play" replace />

  const game = gameById(gameModule.id)
  const track = TRACKS[game.track]
  const toLibrary = () => navigate('/play')

  function start() {
    setRun((prev) => ({
      id: (prev?.id ?? 0) + 1,
      level: progress.level,
      prevBest: progress.bestScore,
      items: gameModule!.generate(progress.level, createRng(Date.now())),
    }))
  }

  return (
    <div className={styles.screen} style={{ '--track': track.colour } as CSSProperties}>
      {run ? (
        <RoundRun
          key={run.id}
          gameModule={gameModule}
          gameName={game.name}
          level={run.level}
          prevBest={run.prevBest}
          items={run.items}
          store={store}
          onQuit={toLibrary}
          onPlayAgain={start}
          onDone={toLibrary}
        />
      ) : (
        <div className={styles.ready}>
          <button className={styles.quit} onClick={toLibrary} aria-label="Back to games">
            ✕
          </button>
          <div className={styles.readyBody}>
            <p className={styles.readyTrack}>{track.name}</p>
            <h1 className={styles.readyTitle}>{game.name}</h1>
            <p className={styles.readyLevel}>Level {progress.level}</p>
            <p className={styles.readyHint}>
              {gameModule.itemsPerRound} questions, each against the clock.
            </p>
          </div>
          <button className={`${ui.button} ${styles.trackButton} ${styles.start}`} onClick={start}>
            Start
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Add the styles** — `src/round/RoundScreen.module.css`

```css
.screen {
  --track: var(--track-math);
  min-height: 100dvh;
  max-width: 30rem;
  margin: 0 auto;
  padding: calc(var(--space-3) + env(safe-area-inset-top, 0px)) var(--space-4)
    calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
}

.quit {
  width: var(--tap-min);
  height: var(--tap-min);
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-lg);
}

.quit:hover {
  color: var(--ink);
}

.trackButton {
  background: var(--track);
  color: var(--on-track);
}

/* Ready */
.ready {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.readyBody {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-2);
}

.readyTrack {
  color: var(--track);
  font-size: var(--text-sm);
  font-weight: 600;
}

.readyTitle {
  font-size: var(--text-2xl);
  font-weight: 700;
}

.readyLevel {
  font-size: var(--text-lg);
}

.readyHint {
  color: var(--ink-muted);
}

.start {
  width: 100%;
  min-height: 56px;
  font-size: var(--text-lg);
}

/* Run */
.run {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.top {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--space-2);
}

.segments {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.segment {
  height: 6px;
  border-radius: 3px;
  background: var(--surface-raised);
  transition: background var(--dur-med);
}

.segment[data-status='current'] {
  background: var(--ink-faint);
}

.segment[data-status='right'] {
  background: var(--track);
}

.segment[data-status='wrong'] {
  background: var(--incorrect);
}

.timerTrack {
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--surface-raised);
}

.timerFill {
  height: 100%;
  background: var(--track);
  transform-origin: left;
  animation-name: drain;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
  animation-play-state: paused;
}

.timerFill[data-running='true'] {
  animation-play-state: running;
}

@keyframes drain {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

.stage {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.stage[data-feedback='correct'] {
  animation: pulse 220ms var(--ease-out);
}

.stage[data-feedback='wrong'] {
  animation: shake 320ms var(--ease-out);
}

@keyframes pulse {
  50% {
    transform: scale(1.03);
  }
}

@keyframes shake {
  20% {
    transform: translateX(-8px);
  }
  40% {
    transform: translateX(7px);
  }
  60% {
    transform: translateX(-5px);
  }
  80% {
    transform: translateX(3px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .stage[data-feedback] {
    animation: none;
  }
}

/* Summary */
.summary {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-4);
}

.summaryGame {
  color: var(--ink-muted);
}

.score {
  font-size: clamp(4rem, 22vw, 6rem);
  font-weight: 700;
  line-height: 1;
  color: var(--track);
}

.best {
  font-weight: 600;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin: 0;
}

.stats div {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.stats dt {
  color: var(--ink-muted);
  font-size: var(--text-xs);
}

.stats dd {
  margin: 0;
  font-weight: 600;
}

.stats dd[data-change='up'] {
  color: var(--correct);
}

.stats dd[data-change='down'] {
  color: var(--incorrect);
}

.save {
  color: var(--ink-muted);
  font-size: var(--text-sm);
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  margin-top: auto;
}
```

- [ ] **Step 7: Add the route** — `src/App.tsx`

Add the import:

```tsx
import { RoundScreen } from '@/round/RoundScreen'
```

Inside `<Route element={<RequireAuth />}>`, add the round route **next to** (not inside) the `<Route element={<AppShell />}>` block, so rounds are full-screen without the nav:

```tsx
            <Route element={<RequireAuth />}>
              <Route path="play/:gameId" element={<RoundScreen />} />
              <Route element={<AppShell />}>
                {/* …existing child routes unchanged… */}
              </Route>
            </Route>
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run src/round && npm test && npm run typecheck && npm run lint`
Expected: PASS (4 RoundScreen tests plus all earlier tests); typecheck and lint clean.

- [ ] **Step 9: Commit**

```bash
npx prettier --write src/round src/App.tsx
git add src/round src/App.tsx
git commit -m "Add round screen with timer, feedback, summary and saving

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Play library links playable games

**Files:**
- Modify: `src/routes/Play.tsx`, `src/routes/Play.module.css`
- Test: `src/routes/Play.test.tsx`

**Interfaces:**
- Consumes: `GAMES` (`@/games/games`), `TRACKS`, `getGameModule` (Task 6), `useGameProgress`, `ProgressContext` (Task 8), `createProgressStore`, `KeyValueStorage` (Task 8).
- Produces: playable rows are links to `/play/<id>` showing `Level N`; others show `Coming soon`.

- [ ] **Step 1: Write the failing test** — `src/routes/Play.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProgressContext } from '@/data/ProgressProvider'
import { createProgressStore } from '@/data/progress'
import { Play } from './Play'

function renderPlay() {
  const saved = JSON.stringify({
    games: {
      'speed-arithmetic': { level: 3, bestScore: 80, roundsPlayed: 4, lastPlayedAt: null },
    },
    outbox: [],
  })
  const store = createProgressStore({
    storage: { getItem: () => saved, setItem: () => {} },
    key: 'test',
    send: async () => ({ ok: true }),
    fetchServer: async () => [],
  })
  render(
    <ProgressContext.Provider value={store}>
      <MemoryRouter>
        <Play />
      </MemoryRouter>
    </ProgressContext.Provider>,
  )
}

describe('Play', () => {
  it('links playable games with their level', () => {
    renderPlay()
    const link = screen.getByRole('link', { name: /Speed Arithmetic/ })
    expect(link).toHaveAttribute('href', '/play/speed-arithmetic')
    expect(link).toHaveTextContent('Level 3')
  })

  it('marks the other 8 games as coming soon', () => {
    renderPlay()
    expect(screen.getAllByText('Coming soon')).toHaveLength(8)
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/routes/Play.test.tsx`
Expected: FAIL — no link named "Speed Arithmetic".

- [ ] **Step 3: Implement** — replace `src/routes/Play.tsx` entirely:

```tsx
import { Link } from 'react-router-dom'
import { useGameProgress } from '@/data/ProgressProvider'
import { GAMES, type GameDef } from '@/games/games'
import { getGameModule } from '@/games/registry'
import { TRACKS } from '@/games/tracks'
import styles from './Play.module.css'

function GameRow({ game }: { game: GameDef }) {
  const playable = getGameModule(game.id) !== undefined
  const progress = useGameProgress(playable ? game.id : undefined)
  const content = (
    <>
      <span className={styles.swatch} style={{ background: TRACKS[game.track].colour }} />
      <span className={styles.name}>{game.name}</span>
      <span className={styles.blurb}>{game.blurb}</span>
      <span className={styles.meta}>{playable ? `Level ${progress.level}` : 'Coming soon'}</span>
    </>
  )
  return (
    <li>
      {playable ? (
        <Link to={`/play/${game.id}`} className={`${styles.row} ${styles.playable}`}>
          {content}
        </Link>
      ) : (
        <div className={`${styles.row} ${styles.soon}`}>{content}</div>
      )}
    </li>
  )
}

export function Play() {
  return (
    <div>
      <h1 className={styles.title}>Free play</h1>
      <p className={styles.lede}>Any game, any time. Free play doesn’t count towards your streak.</p>
      <ul className={styles.list}>
        {GAMES.map((g) => (
          <GameRow key={g.id} game={g} />
        ))}
      </ul>
    </div>
  )
}
```

In `src/routes/Play.module.css`, replace the `.row` rule with the following and append the new rules (keep `.title`, `.lede`, `.list`, `.swatch`, `.name`, `.blurb` as they are):

```css
.row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  column-gap: var(--space-3);
  min-height: 64px;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--line);
  color: inherit;
  text-decoration: none;
}

.meta {
  grid-column: 3;
  grid-row: 1 / span 2;
  color: var(--ink-muted);
  font-size: var(--text-sm);
}

.playable .meta {
  color: var(--ink);
  font-weight: 600;
}

.playable:hover .name {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.soon {
  opacity: 0.55;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/routes/Play.test.tsx && npm test && npm run typecheck && npm run lint`
Expected: PASS; typecheck and lint clean.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/routes/Play.tsx src/routes/Play.module.css src/routes/Play.test.tsx
git add src/routes/Play.tsx src/routes/Play.module.css src/routes/Play.test.tsx
git commit -m "Link playable games from the Play library

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Full verification and deploy

**Files:** none new.

- [ ] **Step 1: Run every check**

Run:
```bash
npm run typecheck && npm run lint && npm test && npx prettier --check . && npm run build && npm run db:test; echo "exit=$?"
```
Expected: all green, `exit=0`; the build lists an `App-*.js` chunk.

- [ ] **Step 2: Render the whole app once in the test environment**

Create a throwaway `src/zz-smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { App } from './App'

it('still renders the login screen for a signed-out visitor', async () => {
  window.history.pushState({}, '', '/play/speed-arithmetic')
  render(<App />)
  expect(
    await screen.findByText('Email me a sign-in code', {}, { timeout: 3000 }),
  ).toBeInTheDocument()
})
```

Run: `npx vitest run src/zz-smoke.test.tsx; rm src/zz-smoke.test.tsx`
Expected: PASS, and the file is deleted.

- [ ] **Step 3: Deploy**

```bash
git push origin scaffold
git checkout main && git merge --ff-only scaffold && git push origin main && git checkout scaffold
```

Then poll until the live bundle includes the new screen:

```bash
for i in $(seq 1 24); do b=$(curl -s https://brian-azure.vercel.app/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1); curl -s "https://brian-azure.vercel.app$b" -o /tmp/b.js; for a in $(grep -oE 'App-[A-Za-z0-9_-]+\.js' /tmp/b.js | sort -u); do curl -s "https://brian-azure.vercel.app/assets/$a" >> /tmp/b.js; done; if grep -q 'each against the clock' /tmp/b.js; then echo "live ($b)"; break; fi; echo "not yet"; sleep 15; done; rm -f /tmp/b.js
```
Expected: `live (...)` within a few minutes.

- [ ] **Step 4: Owner checks on the phone (hand over to the user)**

1. Open the installed app (close and reopen once to pick up the update) → Play → Speed Arithmetic → Start; play a round. The summary shows score, accuracy, average time, level change and "Saved".
2. In Supabase → Table Editor, `rounds` has the row and `game_progress` shows the new level.
3. Turn on flight mode, play a round: the summary says "Saved on this phone…". Turn flight mode off, reopen the app: the second row appears in `rounds`.
