# Code-only Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Money Maths, Table Reasoning, Rule Switch and Sequence Recall on top of the step 2 round shell, each deployable on its own.

**Architecture:**
- Money Maths, Table Reasoning and Rule Switch are ordinary item `GameModule`s that plug into the existing round engine and `RoundRun`. The two math games share a multiple-choice grid and a distractor helper.
- Sequence Recall is a new `kind: 'run'` module. It brings its own pure run reducer and view, then hands a `RunResult` to a small `RunRound` wrapper. That wrapper reuses `nextLevel`, `RoundSummary` and a `useSaveRound` hook extracted from `RoundRun`.

**Tech Stack:**
- React 19, TypeScript 6 (strict, `noUncheckedIndexedAccess`), CSS modules
- Vitest 4 + Testing Library (jsdom, globals on, fake timers)
- oxlint, Vite

**Spec:** `docs/superpowers/specs/2026-10-09-code-only-games-design.md`

## Global Constraints

- Every level parameter is a named constant in that game's `levels.ts` (or at the top of `generate.ts`), marked `[tunable]` in a comment.
- Levels are 1–20. Generators clamp the level with `Math.min(20, Math.max(1, Math.round(level)))`.
- Generators are pure functions of `(level, rng)`. Never call `Math.random()` or `Date.now()` in a generator.
- All money goes through `roundCents` at every displayed step, and is formatted with `formatAud`.
- Tap targets are at least 56 px tall for answer buttons. Keyboard handlers ignore `e.repeat` and modifier keys.
- The UI copy uses Australian spelling ("colour") and curly apostrophes (’) in user-facing strings, matching the existing code.
- Imports use the `@/` alias for `src/`. Tests sit next to their source as `*.test.ts(x)`.
- Before each commit: `npm run typecheck && npm run lint && npm test` must all pass.
- Deploy = `git checkout main && git merge --ff-only scaffold && git push origin main scaffold && git checkout scaffold`. Only deploy at the "Deploy" steps.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A rare level/seed combination can't produce enough distinct options or prompts, and the generator throws mid-game.** Expected: generators never throw for any level 1–20 at any seed. Pinned by the 20 levels × 200 seeds loops in Tasks 4, 6 and 8, plus a `makeChoices` fallback test in Task 2.
2. **Floating-point money: `110 / 1.1` and `x.xx5` amounts round to the wrong cent, or two options look identical (`$12.50` vs `$12.5`).** Expected: the options are always visibly distinct and the correct answer matches the by-hand value. Pinned in Task 2 (`roundCents(1.005)`, label dedupe) and in the Task 4 hand-checked cases.
3. **Rapid or double taps during feedback, or key auto-repeat, record two answers for one item.** Expected: input is ignored once an answer is chosen. Pinned in Task 3 (ChoiceGrid ignores clicks during feedback and repeat keys), Task 9 (Rule Switch arrow repeat) and Task 12 (tiles disabled outside input).
4. **Backgrounding the phone mid-Sequence-Recall inflates the average time, or leaves the show sequence half played.** Expected: tap gaps are capped at 5 s, and timers are cleaned up on unmount. Pinned in Task 10 (gap cap) and Task 12 (quit mid-show leaves no timers firing).
5. **A long Sequence Recall run on a 3 × 3 grid asks for more tiles than the grid has, while repeats are banned.** Expected: once the length passes the grid size, repeats are allowed (never back to back). Pinned in Task 10.

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/games/types.ts` (modify) | `GameModule` gains `kind: 'items'` and `readyHint?`; adds `RunGameModule`, `RunResult`, `SummaryStat`, `AnyGameModule` union | 1 |
| `src/round/useSaveRound.ts` (new) | Save-once hook shared by both loops | 1 |
| `src/round/scoring.ts` (modify) | add `isPersonalBest` | 1 |
| `src/round/RoundSummary.tsx` (modify) | takes `stats: SummaryStat[]` | 1 |
| `src/round/RoundRun.tsx` (modify) | uses the hook and the new summary props | 1 |
| `src/round/RoundScreen.tsx` (modify) | `readyHint`; branches on `kind` (the `'run'` branch lands in Task 11) | 1, 11 |
| `src/lib/money.ts` (new) | `roundCents`, `hasCents`, `formatAud` | 2 |
| `src/games/choices.ts` (new) | `ChoiceItem`, `shuffle`, `makeChoices`, `makeLabelChoices`, `roundTo` | 2 |
| `src/components/ChoiceGrid.tsx` + css (new) | 2 × 2 option buttons with feedback states and 1–4 keys | 3 |
| `src/games/money-maths/*` (new) | levels, generator, view, module | 4, 5 |
| `src/games/table-reasoning/*` (new) | themes, levels, generator, view, module | 6, 7 |
| `src/games/rule-switch/*` (new) | levels, generator, view, module | 8, 9 |
| `src/games/sequence-recall/*` (new) | levels, run reducer, sequence generator, view, module | 10, 12 |
| `src/round/RunRound.tsx` (new) | hosts a `RunView`, then the summary and save | 11 |
| `src/games/registry.ts` (modify) | registers each game as it ships | 5, 7, 9, 12 |
| `docs/PROGRESS.md` (modify) | step 3 status | 13 |

---

### Task 1: Shell refactor (module kinds, readyHint, summary stats, useSaveRound)

A refactor plus two small additions. Speed Arithmetic must behave exactly as before, and every existing test must still pass, with only the summary label text unchanged.

**Files:**
- Modify: `src/games/types.ts`, `src/games/speed-arithmetic/index.ts`, `src/round/scoring.ts`, `src/round/RoundSummary.tsx`, `src/round/RoundRun.tsx`, `src/round/RoundScreen.tsx`
- Create: `src/round/useSaveRound.ts`, `src/round/useSaveRound.test.tsx`
- Test: `src/round/scoring.test.ts` (add), `src/round/RoundScreen.test.tsx` (add)

**Interfaces:**
- Produces:
  - `type SummaryStat = { label: string; value: string }`
  - `type RunResult = { score: number; accuracy: number; avgResponseMs: number; stats: SummaryStat[] }`
  - `type RunViewProps = { level: number; rng: Rng; onFinish(result: RunResult): void; onQuit(): void }`
  - `interface GameModule<Item, Answer>`, now with `kind: 'items'` and `readyHint?: string`
  - `type RunGameModule = { kind: 'run'; id: GameId; readyHint: string; RunView: ComponentType<RunViewProps> }`
  - `type AnyItemGameModule = GameModule<any, any>`
  - `type AnyGameModule = AnyItemGameModule | RunGameModule`
  - `useSaveRound(store: ProgressStore, input: RoundInput | null): SaveStatus | 'saving'`
  - `isPersonalBest(prevBest: number | null, score: number): boolean`
  - `RoundSummary` props: `{ gameName, score, stats: SummaryStat[], level, newLevel, isPersonalBest, saveStatus, onPlayAgain, onDone }`

- [ ] **Step 1: Write the failing tests**

Add to `src/round/scoring.test.ts`:
```ts
import { isPersonalBest } from './scoring'

describe('isPersonalBest', () => {
  it('needs a score above the previous best; a first round needs more than 0', () => {
    expect(isPersonalBest(null, 0)).toBe(false)
    expect(isPersonalBest(null, 1)).toBe(true)
    expect(isPersonalBest(70, 70)).toBe(false)
    expect(isPersonalBest(70, 71)).toBe(true)
  })
})
```
(Merge the import into the file's existing import from `./scoring`.)

Create `src/round/useSaveRound.test.tsx`:
```tsx
import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import type { ProgressStore, RoundInput } from '@/data/progress'
import { useSaveRound } from './useSaveRound'

const input: RoundInput = {
  gameId: 'speed-arithmetic',
  level: 1,
  newLevel: 2,
  score: 90,
  accuracy: 1,
  avgResponseMs: 1000,
}

function Harness({ store }: { store: ProgressStore }) {
  const [ready, setReady] = useState<RoundInput | null>(null)
  const [, force] = useState(0)
  const status = useSaveRound(store, ready)
  return (
    <>
      <p data-testid="status">{status}</p>
      <button onClick={() => setReady(input)}>finish</button>
      <button onClick={() => force((n) => n + 1)}>rerender</button>
      <button onClick={() => setReady({ ...input })}>new object</button>
    </>
  )
}

const fakeStore = (impl: ProgressStore['recordRound']) =>
  ({ recordRound: vi.fn(impl) }) as unknown as ProgressStore & {
    recordRound: ReturnType<typeof vi.fn>
  }

describe('useSaveRound', () => {
  it('waits for input, saves exactly once, and reports the status', async () => {
    const store = fakeStore(async () => 'synced')
    render(<Harness store={store} />)
    expect(screen.getByTestId('status')).toHaveTextContent('saving')
    expect(store.recordRound).not.toHaveBeenCalled()

    await act(async () => screen.getByText('finish').click())
    await act(async () => screen.getByText('rerender').click())
    await act(async () => screen.getByText('new object').click())

    expect(store.recordRound).toHaveBeenCalledTimes(1)
    expect(store.recordRound).toHaveBeenCalledWith(input)
    expect(screen.getByTestId('status')).toHaveTextContent('synced')
  })

  it('shows pending when the save throws', async () => {
    const store = fakeStore(async () => {
      throw new Error('boom')
    })
    render(<Harness store={store} />)
    await act(async () => screen.getByText('finish').click())
    expect(screen.getByTestId('status')).toHaveTextContent('pending')
  })
})
```

Add to `src/round/RoundScreen.test.tsx` (inside the `describe`):
```tsx
  it('shows the default hint for a game without its own', () => {
    renderRound()
    expect(screen.getByText('10 questions, each against the clock.')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to check they fail**

Run: `npx vitest run src/round`
Expected: FAIL. `isPersonalBest` and `./useSaveRound` don't exist yet. The RoundScreen hint test already passes, because it guards the existing behaviour.

- [ ] **Step 3: Implement**

`src/games/types.ts` (full file):
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

/** One line in the end-of-round summary, e.g. { label: 'Accuracy', value: '90%' }. */
export type SummaryStat = { label: string; value: string }

/** What an item-based game plugs into the shared round shell. */
export interface GameModule<Item, Answer> {
  kind: 'items'
  id: GameId
  itemsPerRound: number
  /** Ready-screen text; defaults to "N questions, each against the clock." */
  readyHint?: string
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

/** What a run-format game (Sequence Recall) reports when its run ends. */
export type RunResult = {
  score: number
  accuracy: number
  avgResponseMs: number
  stats: SummaryStat[]
}

export type RunViewProps = {
  level: number
  rng: Rng
  onFinish(result: RunResult): void
  onQuit(): void
}

/** A game that runs its own loop and only hands back a result. */
export type RunGameModule = {
  kind: 'run'
  id: GameId
  readyHint: string
  RunView: ComponentType<RunViewProps>
}

// Modules differ in Item/Answer; the shell only passes each module its own values back.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyItemGameModule = GameModule<any, any>
export type AnyGameModule = AnyItemGameModule | RunGameModule
```

`src/games/speed-arithmetic/index.ts`: add `kind: 'items',` as the first property of `speedArithmetic`.

`src/round/scoring.ts`: append
```ts
/** A first round counts as a best only if it scored something. */
export function isPersonalBest(prevBest: number | null, score: number): boolean {
  return prevBest === null ? score > 0 : score > prevBest
}
```

`src/round/useSaveRound.ts`:
```ts
import { useEffect, useRef, useState } from 'react'
import type { ProgressStore, RoundInput, SaveStatus } from '@/data/progress'

/** Saves the round once, the first time `input` is non-null, and reports how it went. */
export function useSaveRound(
  store: ProgressStore,
  input: RoundInput | null,
): SaveStatus | 'saving' {
  const [status, setStatus] = useState<SaveStatus | 'saving'>('saving')
  const saved = useRef(false)

  useEffect(() => {
    if (!input || saved.current) return
    saved.current = true
    void store
      .recordRound(input)
      .then(setStatus)
      .catch(() => setStatus('pending'))
  }, [input, store])

  return status
}
```

`src/round/RoundSummary.tsx`:
- Replace the `accuracy` and `avgResponseMs` props with `stats: SummaryStat[]` (import the type from `@/games/types`).
- Replace the two hard-coded `<div>`s (Accuracy and Average time) in the `<dl>` with:
```tsx
        {p.stats.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
```
- Keep the Level `<div>` last.

`src/round/RoundRun.tsx`:
- Change the `gameModule` prop type to `AnyItemGameModule`.
- Delete the `saveStatus` state, the `saved` ref and the save `useEffect`.
- Delete `useState` from the imports, and add `useMemo`.
- Import `useSaveRound` from `./useSaveRound`, and `isPersonalBest` from `./scoring`.
- Replace them with the following code, placed after `newLevel`:
```tsx
  const input = useMemo(
    () =>
      stats
        ? {
            gameId: gameModule.id,
            level,
            newLevel,
            score: stats.score,
            accuracy: stats.accuracy,
            avgResponseMs: Math.round(stats.avgResponseMs),
          }
        : null,
    [state.phase], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const saveStatus = useSaveRound(store, input)
```
and render the summary as:
```tsx
    return (
      <RoundSummary
        gameName={props.gameName}
        score={stats.score}
        stats={[
          { label: 'Accuracy', value: `${Math.round(stats.accuracy * 100)}%` },
          { label: 'Average time', value: `${(stats.avgResponseMs / 1000).toFixed(1)} s` },
        ]}
        level={level}
        newLevel={newLevel}
        isPersonalBest={isPersonalBest(props.prevBest, stats.score)}
        saveStatus={saveStatus}
        onPlayAgain={props.onPlayAgain}
        onDone={props.onDone}
      />
    )
```

`src/round/RoundScreen.tsx` (this task only adds the hint and narrows the type; the run branch comes in Task 11):
- After `if (!gameModule || !store) …`, add:
```tsx
  if (gameModule.kind !== 'items') return <Navigate to="/play" replace />
```
- Replace the hint paragraph's contents with:
```tsx
              {gameModule.readyHint ?? `${gameModule.itemsPerRound} questions, each against the clock.`}
```
- Inside `start()`, `gameModule!` becomes `gameModule` (TypeScript narrows it now). If it complains inside the closure, bind `const itemModule = gameModule` after the kind check and use that.

- [ ] **Step 4: Run all checks**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all PASS (the 119 existing tests plus the new ones).

- [ ] **Step 5: Commit**

```bash
git add src/games/types.ts src/games/speed-arithmetic/index.ts src/round
git commit -m "Generalise the round shell: module kinds, readyHint, summary stats, useSaveRound

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Money helpers and multiple-choice helpers

**Files:**
- Create: `src/lib/money.ts`, `src/lib/money.test.ts`, `src/games/choices.ts`, `src/games/choices.test.ts`

**Interfaces:**
- Consumes: `Rng` from `@/lib/rng` (`next()`, `int(min, max)`, `pick(arr)`)
- Produces:
  - `roundCents(n: number): number`. Half away from zero, to the cent.
  - `hasCents(n: number): boolean`
  - `formatAud(n: number, withCents?: boolean): string`. With no flag, it shows cents only when `n` has them.
  - `roundTo(n: number, dp: number): number`. Half away from zero.
  - `type ChoiceItem = { prompt: string; options: string[]; correctIndex: number }`
  - `type Choices = { options: string[]; correctIndex: number }`
  - `shuffle<T>(items: readonly T[], rng: Rng): T[]`
  - `makeChoices(correct: number, distractors: readonly number[], rng: Rng, opts: { format(n: number): string; nudge(n: number, rng: Rng): number; allowNegative?: boolean }): Choices`. Always 4 options.
  - `makeLabelChoices(correct: string, others: readonly string[], rng: Rng, opts?: { count?: number; fill?(rng: Rng): string }): Choices`. `count` defaults to 4.

- [ ] **Step 1: Write the failing tests**

`src/lib/money.test.ts`:
```ts
import { formatAud, hasCents, roundCents } from './money'

describe('roundCents', () => {
  it('rounds half away from zero, despite float error', () => {
    expect(roundCents(1.005)).toBe(1.01)
    expect(roundCents(110 / 1.1)).toBe(100)
    expect(roundCents(2.344)).toBe(2.34)
    expect(roundCents(-1.005)).toBe(-1.01)
  })
})

describe('hasCents', () => {
  it('is false for whole dollars, including float noise', () => {
    expect(hasCents(80)).toBe(false)
    expect(hasCents(110 / 1.1)).toBe(false)
    expect(hasCents(12.5)).toBe(true)
  })
})

describe('formatAud', () => {
  it('shows cents only when there are some, unless told', () => {
    expect(formatAud(80)).toBe('$80')
    expect(formatAud(12.5)).toBe('$12.50')
    expect(formatAud(80, true)).toBe('$80.00')
    expect(formatAud(12.5, false)).toBe('$13')
  })

  it('adds thousands separators', () => {
    expect(formatAud(1234.5)).toBe('$1,234.50')
    expect(formatAud(2500)).toBe('$2,500')
  })
})
```

`src/games/choices.test.ts`:
```ts
import { formatAud, roundCents } from '@/lib/money'
import { createRng } from '@/lib/rng'
import { makeChoices, makeLabelChoices, roundTo, shuffle } from './choices'

const money = {
  format: (n: number) => formatAud(n, true),
  nudge: (n: number, rng: ReturnType<typeof createRng>) =>
    roundCents(n * (1 + (rng.next() < 0.5 ? -1 : 1) * rng.int(5, 15) / 100)),
}

describe('roundTo', () => {
  it('rounds half away from zero', () => {
    expect(roundTo(12.45, 1)).toBe(12.5)
    expect(roundTo(-12.45, 1)).toBe(-12.5)
    expect(roundTo(2.5, 0)).toBe(3)
  })
})

describe('shuffle', () => {
  it('keeps every element and is deterministic per seed', () => {
    const a = shuffle([1, 2, 3, 4, 5], createRng(7))
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5])
    expect(shuffle([1, 2, 3, 4, 5], createRng(7))).toEqual(a)
  })
})

describe('makeChoices', () => {
  it('returns 4 distinct options including the correct one', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const c = makeChoices(60, [100, 20, 55], createRng(seed), money)
      expect(c.options).toHaveLength(4)
      expect(new Set(c.options).size).toBe(4)
      expect(c.options[c.correctIndex]).toBe('$60.00')
    }
  })

  it('treats values that format the same as duplicates and nudges to fill', () => {
    const c = makeChoices(12.5, [12.5, 12.5000001, -3, Number.NaN], createRng(3), money)
    expect(new Set(c.options).size).toBe(4)
    expect(c.options.filter((o) => o === '$12.50')).toHaveLength(1)
    expect(c.options.every((o) => !o.includes('-'))).toBe(true)
  })

  it('allows negatives when asked', () => {
    const pct = {
      format: (n: number) => `${n}%`,
      nudge: (n: number, rng: ReturnType<typeof createRng>) => n + rng.int(2, 9),
      allowNegative: true,
    }
    const c = makeChoices(12, [-12, 10, 30], createRng(1), pct)
    expect(c.options).toContain('-12%')
  })

  it('throws only when nudging can never find distinct values', () => {
    expect(() =>
      makeChoices(1, [], createRng(1), { format: () => 'same', nudge: (n) => n }),
    ).toThrow()
  })
})

describe('makeLabelChoices', () => {
  it('keeps the correct label, drops duplicates and fills from `fill`', () => {
    let i = 0
    const c = makeLabelChoices('3:2', ['2:3', '2:3', '3:2'], createRng(1), {
      fill: () => `${4 + i++}:1`,
    })
    expect(c.options).toHaveLength(4)
    expect(new Set(c.options).size).toBe(4)
    expect(c.options[c.correctIndex]).toBe('3:2')
  })

  it('can return fewer than 4 when asked', () => {
    const c = makeLabelChoices('A', ['B', 'C'], createRng(1), { count: 3 })
    expect([...c.options].sort()).toEqual(['A', 'B', 'C'])
  })
})
```

- [ ] **Step 2: Run the tests to check they fail**

Run: `npx vitest run src/lib/money.test.ts src/games/choices.test.ts`
Expected: FAIL, because the modules aren't found.

- [ ] **Step 3: Implement**

`src/lib/money.ts`:
```ts
/** Half away from zero, to the cent. The tiny bias absorbs float error like 1.005 * 100 = 100.4999… */
export function roundCents(n: number): number {
  return (Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-6)) / 100
}

export function hasCents(n: number): boolean {
  return Math.round(Math.abs(roundCents(n)) * 100) % 100 !== 0
}

/** "$1,234.50". Shows cents only when the amount has them, unless `withCents` says otherwise. */
export function formatAud(n: number, withCents: boolean = hasCents(n)): string {
  const digits = withCents ? 2 : 0
  const value = withCents ? roundCents(n) : Math.round(roundCents(n))
  return `$${value.toLocaleString('en-AU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}
```

`src/games/choices.ts`:
```ts
import type { Rng } from '@/lib/rng'

/** A multiple-choice item: Money Maths and Table Reasoning both build on this. */
export type ChoiceItem = { prompt: string; options: string[]; correctIndex: number }
export type Choices = { options: string[]; correctIndex: number }

const NUDGE_ATTEMPTS = 200

/** Half away from zero to `dp` places, with a tiny bias for float error. */
export function roundTo(n: number, dp: number): number {
  const f = 10 ** dp
  return (Math.sign(n) * Math.round(Math.abs(n) * f + 1e-6)) / f
}

/** Fisher–Yates; returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

function finish(correct: string, others: string[], rng: Rng): Choices {
  const options = shuffle([correct, ...others], rng)
  return { options, correctIndex: options.indexOf(correct) }
}

/**
 * Four distinct options: the correct value plus up to three distractors, compared after
 * formatting. Gaps are filled with `nudge(correct)`. Throws only if nudging can't find
 * distinct values (a bug in the caller's nudge).
 */
export function makeChoices(
  correct: number,
  distractors: readonly number[],
  rng: Rng,
  opts: { format(n: number): string; nudge(n: number, rng: Rng): number; allowNegative?: boolean },
): Choices {
  const correctLabel = opts.format(correct)
  const seen = new Set([correctLabel])
  const others: string[] = []
  const add = (n: number) => {
    if (others.length >= 3 || !Number.isFinite(n) || (n < 0 && !opts.allowNegative)) return
    const label = opts.format(n)
    if (seen.has(label)) return
    seen.add(label)
    others.push(label)
  }
  distractors.forEach(add)
  for (let i = 0; others.length < 3 && i < NUDGE_ATTEMPTS; i++) add(opts.nudge(correct, rng))
  if (others.length < 3) throw new Error(`Couldn’t make distinct options for ${correctLabel}`)
  return finish(correctLabel, others, rng)
}

/** Like makeChoices for text answers (rows, products, ratios). */
export function makeLabelChoices(
  correct: string,
  others: readonly string[],
  rng: Rng,
  opts: { count?: number; fill?(rng: Rng): string } = {},
): Choices {
  const want = (opts.count ?? 4) - 1
  const seen = new Set([correct])
  const picked: string[] = []
  const add = (label: string) => {
    if (picked.length >= want || seen.has(label)) return
    seen.add(label)
    picked.push(label)
  }
  others.forEach(add)
  for (let i = 0; opts.fill && picked.length < want && i < NUDGE_ATTEMPTS; i++) add(opts.fill(rng))
  if (picked.length < want) throw new Error(`Couldn’t make distinct options for ${correct}`)
  return finish(correct, picked, rng)
}
```

- [ ] **Step 4: Run all checks**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/lib/money.test.ts src/games/choices.ts src/games/choices.test.ts
git commit -m "Add money formatting and multiple-choice helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: ChoiceGrid component

**Files:**
- Create: `src/components/ChoiceGrid.tsx`, `src/components/ChoiceGrid.module.css`, `src/components/ChoiceGrid.test.tsx`

**Interfaces:**
- Consumes: `ItemFeedback` from `@/games/types`
- Produces: `ChoiceGrid` props:
  - `options: readonly string[]`, with 2–4 options
  - `correctIndex: number`
  - `feedback: ItemFeedback | null`
  - `onChoose(index: number): void`
  - The grid tracks which option was chosen itself. Each `ItemView` is keyed per item by `RoundRun`, so that state resets between items.

- [ ] **Step 1: Write the failing test**

`src/components/ChoiceGrid.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { ChoiceGrid } from './ChoiceGrid'

const options = ['$60', '$100', '$20', '$55']

describe('ChoiceGrid', () => {
  it('reports the tapped option', () => {
    const onChoose = vi.fn()
    render(<ChoiceGrid options={options} correctIndex={0} feedback={null} onChoose={onChoose} />)
    fireEvent.click(screen.getByRole('button', { name: '$20' }))
    expect(onChoose).toHaveBeenCalledWith(2)
  })

  it('answers with keys 1–4, ignoring repeats and modifiers', () => {
    const onChoose = vi.fn()
    render(<ChoiceGrid options={options} correctIndex={0} feedback={null} onChoose={onChoose} />)
    fireEvent.keyDown(window, { key: '4', repeat: true })
    fireEvent.keyDown(window, { key: '4', metaKey: true })
    fireEvent.keyDown(window, { key: '5' })
    expect(onChoose).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: '4' })
    expect(onChoose).toHaveBeenCalledWith(3)
  })

  it('only takes the first choice', () => {
    const onChoose = vi.fn()
    render(<ChoiceGrid options={options} correctIndex={0} feedback={null} onChoose={onChoose} />)
    fireEvent.click(screen.getByRole('button', { name: '$20' }))
    fireEvent.click(screen.getByRole('button', { name: '$60' }))
    fireEvent.keyDown(window, { key: '1' })
    expect(onChoose).toHaveBeenCalledTimes(1)
  })

  it('marks a wrong choice and the right answer during feedback, and disables input', () => {
    const onChoose = vi.fn()
    const { rerender } = render(
      <ChoiceGrid options={options} correctIndex={0} feedback={null} onChoose={onChoose} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '$20' }))
    rerender(
      <ChoiceGrid
        options={options}
        correctIndex={0}
        feedback={{ correct: false, answerLabel: '$60' }}
        onChoose={onChoose}
      />,
    )
    expect(screen.getByRole('button', { name: '$20' })).toHaveAttribute('data-state', 'wrong')
    expect(screen.getByRole('button', { name: '$60' })).toHaveAttribute('data-state', 'answer')
    expect(screen.getByRole('button', { name: '$100' })).toBeDisabled()
  })

  it('shows the answer after a timeout with nothing chosen', () => {
    render(
      <ChoiceGrid
        options={options}
        correctIndex={1}
        feedback={{ correct: false, answerLabel: '$100' }}
        onChoose={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '$100' })).toHaveAttribute('data-state', 'answer')
  })

  it('marks a right choice', () => {
    const { rerender } = render(
      <ChoiceGrid options={options} correctIndex={0} feedback={null} onChoose={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '$60' }))
    rerender(
      <ChoiceGrid
        options={options}
        correctIndex={0}
        feedback={{ correct: true, answerLabel: '$60' }}
        onChoose={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '$60' })).toHaveAttribute('data-state', 'right')
  })
})
```

- [ ] **Step 2: Run the test to check it fails**

Run: `npx vitest run src/components/ChoiceGrid.test.tsx`
Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement**

`src/components/ChoiceGrid.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'
import type { ItemFeedback } from '@/games/types'
import styles from './ChoiceGrid.module.css'

type Props = {
  options: readonly string[]
  correctIndex: number
  /** Set during feedback; input is locked. */
  feedback: ItemFeedback | null
  onChoose(index: number): void
}

type State = 'idle' | 'right' | 'wrong' | 'answer'

export function ChoiceGrid({ options, correctIndex, feedback, onChoose }: Props) {
  const [chosen, setChosen] = useState<number | null>(null)
  // A ref as well as state, so two taps in the same frame can't both get through.
  const locked = useRef(false)

  function choose(index: number) {
    if (feedback || locked.current || index < 0 || index >= options.length) return
    locked.current = true
    setChosen(index)
    onChoose(index)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (!/^[1-4]$/.test(e.key)) return
      e.preventDefault()
      choose(Number(e.key) - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function stateOf(i: number): State {
    if (!feedback) return 'idle'
    if (i === chosen) return feedback.correct ? 'right' : 'wrong'
    if (!feedback.correct && i === correctIndex) return 'answer'
    return 'idle'
  }

  return (
    <div className={styles.grid} role="group" aria-label="Answers">
      {options.map((label, i) => (
        <button
          key={label}
          type="button"
          className={styles.option}
          data-state={stateOf(i)}
          disabled={feedback !== null || chosen !== null}
          onClick={() => choose(i)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

`src/components/ChoiceGrid.module.css`:
```css
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.option {
  min-height: 64px;
  padding: var(--space-2) var(--space-3);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--ink);
  font-size: var(--text-lg);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  overflow-wrap: anywhere;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  transition:
    transform var(--dur-fast) var(--ease-out),
    background var(--dur-fast),
    border-color var(--dur-fast);
}

.option:active:not(:disabled) {
  transform: scale(0.97);
  background: var(--surface-raised);
}

.option:disabled {
  cursor: default;
}

.option[data-state='right'] {
  background: var(--correct);
  color: var(--bg);
}

.option[data-state='wrong'] {
  background: var(--incorrect);
  color: var(--bg);
}

.option[data-state='answer'] {
  border-color: var(--correct);
}
```

- [ ] **Step 4: Run all checks**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChoiceGrid.tsx src/components/ChoiceGrid.module.css src/components/ChoiceGrid.test.tsx
git commit -m "Add ChoiceGrid multiple-choice component

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Money Maths generator

**Files:**
- Create: `src/games/money-maths/levels.ts`, `src/games/money-maths/generate.ts`, `src/games/money-maths/generate.test.ts`

**Interfaces:**
- Consumes: `roundCents`, `hasCents`, `formatAud` (Task 2); `ChoiceItem`, `makeChoices`, `makeLabelChoices` (Task 2); `Rng`
- Produces:
  - `type ProblemType = 'discount' | 'addGst' | 'removeGst' | 'split' | 'unitPrice' | 'markup' | 'stackedDiscount' | 'discountThenGst'`
  - `type MoneyItem = ChoiceItem & { type: ProblemType; inputs: Record<string, number> }`
  - `ITEMS_PER_ROUND = 10`
  - `levelSpec(level): MoneyLevel`
  - `generateItems(level, rng, count?): MoneyItem[]`
  - `timeLimitMs(level)`, `targetTimeMs(level)`
  - `makeProblem(type, spec, rng): MoneyItem`, exported for the hand-checked tests

- [ ] **Step 1: Write the failing tests**

`src/games/money-maths/generate.test.ts`:
```ts
import { formatAud, roundCents } from '@/lib/money'
import { createRng, type Rng } from '@/lib/rng'
import { generateItems, levelSpec, makeProblem, targetTimeMs, timeLimitMs, type MoneyItem } from './generate'
import { LEVELS } from './levels'

/** Independent re-computation of the right answer from the item's inputs. */
function expected(item: MoneyItem): number {
  const { p = 0, d = 0, n = 1, t = 0, c = 0, m = 0, a = 0, b = 0 } = item.inputs
  switch (item.type) {
    case 'discount':
      return roundCents(p * (1 - d / 100))
    case 'addGst':
      return roundCents(p * 1.1)
    case 'removeGst':
      return roundCents(p / 1.1)
    case 'split':
      return roundCents((p * (1 + t / 100)) / n)
    case 'markup':
      return roundCents(c * (1 + m / 100))
    case 'stackedDiscount':
      return roundCents(roundCents(p * (1 - a / 100)) * (1 - b / 100))
    case 'discountThenGst':
      return roundCents(roundCents(p * (1 - d / 100)) * 1.1)
    case 'unitPrice':
      return Number.NaN
  }
}

/** "500 g for $4.20" / "1 kg for $9.00" → price per gram. */
function perGram(label: string): number {
  const m = /^([\d.]+) (g|kg) for \$([\d,.]+)$/.exec(label)!
  const grams = Number(m[1]) * (m[2] === 'kg' ? 1000 : 1)
  return Number(m[3]!.replace(/,/g, '')) / grams
}

const fixedRng = (): Rng => createRng(42)

describe('Money Maths generator', () => {
  it('has a spec for every level', () => {
    expect(LEVELS).toHaveLength(20)
  })

  for (let level = 1; level <= 20; level++) {
    it(`level ${level}: items fit the level and the answers are right`, () => {
      const spec = levelSpec(level)
      for (let seed = 1; seed <= 200; seed++) {
        const items = generateItems(level, createRng(seed))
        expect(items).toHaveLength(10)
        expect(new Set(items.map((i) => i.prompt)).size).toBe(10)
        for (const item of items) {
          expect(spec.pool).toContain(item.type)
          expect(new Set(item.options).size).toBe(item.options.length)
          const correct = item.options[item.correctIndex]!
          if (item.type === 'unitPrice') {
            expect(item.options).toHaveLength(spec.unitProducts)
            const best = Math.min(...item.options.map(perGram))
            expect(perGram(correct)).toBe(best)
            const rest = item.options.filter((o) => o !== correct).map(perGram)
            expect(Math.min(...rest)).toBeGreaterThanOrEqual(best * 1.02)
          } else {
            expect(item.options).toHaveLength(4)
            const usesCents = item.options.some((o) => o.includes('.'))
            expect(correct).toBe(formatAud(expected(item), usesCents))
            // One style per item: all options with cents, or none.
            expect(item.options.every((o) => o.includes('.') === usesCents)).toBe(true)
          }
        }
      }
    })
  }

  it('uses only simple types and round prices at levels 1–4', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const item of generateItems(1, createRng(seed))) {
        expect(['discount', 'addGst', 'split']).toContain(item.type)
        expect(item.inputs.p! % 10).toBe(0)
        expect([10, 20, 25, 50, 0]).toContain(item.inputs.d ?? 0)
        if (item.type === 'split') {
          expect(item.inputs.t).toBe(0)
          expect(item.inputs.p! % item.inputs.n!).toBe(0)
        }
      }
    }
  })

  it('removing GST from $110 gives $100, with the ×0.9 trap among the options', () => {
    const spec = { ...levelSpec(7), price: { min: 100, max: 100, step: 1, cents: false } }
    const item = makeProblem('removeGst', spec, fixedRng())
    expect(item.prompt).toContain('$110')
    // Every option is whole dollars here, so none show cents.
    expect(item.options[item.correctIndex]).toBe('$100')
    expect(item.options).toContain('$99')
  })

  it('20% then 10% off $250 is $180, with the "30% off" trap among the options', () => {
    const spec = {
      ...levelSpec(15),
      price: { min: 250, max: 250, step: 1, cents: false },
      percents: [20],
      stackedSecond: [10],
    }
    const item = makeProblem('stackedDiscount', spec, fixedRng())
    expect(item.options[item.correctIndex]).toBe('$180')
    expect(item.options).toContain('$175')
  })

  it('shrinks the time limit from 40 s to 20 s, with a 50% target', () => {
    expect(timeLimitMs(1)).toBe(40000)
    expect(timeLimitMs(20)).toBe(20000)
    expect(targetTimeMs(1)).toBe(20000)
    expect(timeLimitMs(0)).toBe(40000)
    expect(timeLimitMs(99)).toBe(20000)
  })
})
```

- [ ] **Step 2: Run the tests to check they fail**

Run: `npx vitest run src/games/money-maths`
Expected: FAIL, because the modules aren't found.

- [ ] **Step 3: Implement the level table**

`src/games/money-maths/levels.ts`:
```ts
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

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

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
  L1, L1, L1, L1,
  L5, L5, L7, L7, L7,
  L10, L10, L10, L10, L10,
  L15, L15, L15, L15, L15, L15,
]
```
(Prettier may reflow the `LEVELS` array onto one entry per line. That's fine.)

- [ ] **Step 4: Implement the generator**

`src/games/money-maths/generate.ts`:
```ts
import { makeChoices, makeLabelChoices, type ChoiceItem } from '@/games/choices'
import { formatAud, hasCents, roundCents } from '@/lib/money'
import type { Rng } from '@/lib/rng'
import { LEVELS, type MoneyLevel, type ProblemType } from './levels'

export type { ProblemType } from './levels'
export type MoneyItem = ChoiceItem & { type: ProblemType; inputs: Record<string, number> }

export const ITEMS_PER_ROUND = 10
const MAX_ATTEMPTS = 1000

const clampLevel = (level: number) => Math.min(LEVELS.length, Math.max(1, Math.round(level)))
export const levelSpec = (level: number): MoneyLevel => LEVELS[clampLevel(level) - 1]!

const THINGS = ['jacket', 'pair of boots', 'lamp', 'backpack', 'kettle', 'desk chair', 'heater']
const UNIT_SIZES = [250, 300, 375, 400, 500, 600, 750, 1000]

function price(spec: MoneyLevel, rng: Rng): number {
  const { min, max, step, cents } = spec.price
  if (cents) return rng.int(min * 100, max * 100) / 100
  return rng.int(Math.ceil(min / step), Math.floor(max / step)) * step
}

/** Whole-dollar levels nudge to whole dollars; cent levels to cents. */
function moneyChoices(correct: number, distractors: number[], rng: Rng) {
  const values = [correct, ...distractors].map(roundCents)
  const cents = values.some(hasCents)
  return makeChoices(values[0]!, values.slice(1), rng, {
    format: (n) => formatAud(n, cents),
    nudge: (n, r) => {
      const v = n * (1 + (r.next() < 0.5 ? -1 : 1) * (r.int(5, 15) / 100))
      return cents ? roundCents(v) : Math.round(v)
    },
  })
}

function item(
  type: ProblemType,
  prompt: string,
  inputs: Record<string, number>,
  correct: number,
  distractors: number[],
  rng: Rng,
): MoneyItem {
  return { type, prompt, inputs, ...moneyChoices(correct, distractors, rng) }
}

const pct = (n: number) => `${n}%`
const off = (p: number, d: number) => roundCents(p * (1 - d / 100))

function unitLabel(grams: number, cost: number) {
  const size = grams >= 1000 ? `${grams / 1000} kg` : `${grams} g`
  return `${size} for ${formatAud(cost, true)}`
}

function unitPrice(spec: MoneyLevel, rng: Rng): MoneyItem {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sizes = [...UNIT_SIZES].sort(() => rng.next() - 0.5).slice(0, spec.unitProducts)
    const per100 = rng.int(50, 300) / 100
    const products = sizes.map((g) => {
      const cost = roundCents((g / 100) * per100 * (1 + rng.int(-15, 15) / 100))
      return { label: unitLabel(g, cost), perGram: cost / g }
    })
    const sorted = [...products].sort((x, y) => x.perGram - y.perGram)
    if (sorted[1]!.perGram < sorted[0]!.perGram * 1.02) continue
    const choices = makeLabelChoices(
      sorted[0]!.label,
      sorted.slice(1).map((p) => p.label),
      rng,
      { count: spec.unitProducts },
    )
    return { type: 'unitPrice', prompt: 'Which is the best value?', inputs: {}, ...choices }
  }
  throw new Error('Couldn’t make a unit price problem')
}

export function makeProblem(type: ProblemType, spec: MoneyLevel, rng: Rng): MoneyItem {
  switch (type) {
    case 'discount': {
      const p = price(spec, rng)
      const d = rng.pick(spec.percents)
      return item(
        type,
        `A ${formatAud(p)} ${rng.pick(THINGS)} is ${pct(d)} off. What do you pay?`,
        { p, d },
        off(p, d),
        [p * (1 + d / 100), (p * d) / 100, p - d],
        rng,
      )
    }
    case 'addGst': {
      const p = price(spec, rng)
      return item(
        type,
        `${formatAud(p)} before GST. What’s the price including 10% GST?`,
        { p },
        p * 1.1,
        [p * 1.2, p, p * 0.1],
        rng,
      )
    }
    case 'removeGst': {
      const p = spec.gstExact ? roundCents(price(spec, rng) * 1.1) : price(spec, rng)
      return item(
        type,
        `${formatAud(p)} including GST. What’s the price before GST?`,
        { p },
        p / 1.1,
        [p * 0.9, p - 10, p * 1.1],
        rng,
      )
    }
    case 'split': {
      const [lo, hi] = spec.splitPeople
      const n = rng.int(lo, hi)
      const t = spec.tips.length > 0 && rng.next() < 0.5 ? rng.pick(spec.tips) : 0
      // Whole-dollar levels split evenly.
      const p = spec.price.cents
        ? price(spec, rng)
        : rng.int(
            Math.ceil(spec.price.min / (n * spec.price.step)),
            Math.floor(spec.price.max / (n * spec.price.step)),
          ) *
          n *
          spec.price.step
      const withTip = p * (1 + t / 100)
      const prompt =
        t === 0
          ? `A ${formatAud(p)} bill is split evenly between ${n} people. How much does each pay?`
          : `A ${formatAud(p)} bill plus a ${pct(t)} tip is split evenly between ${n} people. How much does each pay?`
      const distractors =
        t === 0
          ? [p / (n - 1), p / (n + 1), p / n + n]
          : [p / n, withTip / (n - 1), p / n + (p * t) / 100]
      return item(type, prompt, { p, n, t }, withTip / n, distractors, rng)
    }
    case 'unitPrice':
      return unitPrice(spec, rng)
    case 'markup': {
      const c = price(spec, rng)
      const m = rng.pick(spec.percents)
      return item(
        type,
        `It costs ${formatAud(c)} and is marked up ${pct(m)}. What’s the sale price?`,
        { c, m },
        c * (1 + m / 100),
        [(c * m) / 100, c / (1 - m / 100), c + m],
        rng,
      )
    }
    case 'stackedDiscount': {
      const p = price(spec, rng)
      const a = rng.pick(spec.percents)
      const b = rng.pick(spec.stackedSecond)
      return item(
        type,
        `${formatAud(p)}, ${pct(a)} off, then a further ${pct(b)} off. What’s the final price?`,
        { p, a, b },
        off(off(p, a), b),
        [p * (1 - (a + b) / 100), off(p, a), off(p, b)],
        rng,
      )
    }
    case 'discountThenGst': {
      const p = price(spec, rng)
      const d = rng.pick(spec.percents)
      return item(
        type,
        `${formatAud(p)} before GST, ${pct(d)} off, then GST is added. What’s the total?`,
        { p, d },
        off(p, d) * 1.1,
        [p * (1 + 0.1 - d / 100), off(p, d), p * 1.1],
        rng,
      )
    }
  }
}

/** Distinct problems for one round. Throws only if a level is too narrow (a bug). */
export function generateItems(level: number, rng: Rng, count = ITEMS_PER_ROUND): MoneyItem[] {
  const spec = levelSpec(level)
  const seen = new Set<string>()
  const items: MoneyItem[] = []
  for (let attempt = 0; items.length < count; attempt++) {
    if (attempt >= MAX_ATTEMPTS) throw new Error(`Couldn’t generate ${count} items for level ${level}`)
    const next = makeProblem(rng.pick(spec.pool), spec, rng)
    if (seen.has(next.prompt)) continue
    seen.add(next.prompt)
    items.push(next)
  }
  return items
}

/** 40 s at level 1 down to 20 s at level 20. [tunable] */
export const timeLimitMs = (level: number) =>
  Math.round(40000 - ((clampLevel(level) - 1) * 20000) / 19)

export const targetTimeMs = (level: number) => Math.round(0.5 * timeLimitMs(level))
```

Implementation notes for the engineer:
- The 3 × `L1` levels use `stackedSecond`, but never reach `stackedDiscount`. The field just has to exist.
- `unitPrice` shuffles sizes with `.sort(() => rng.next() - 0.5)`. That's acceptable for picking 3–4 of 8 sizes. If lint objects, use `shuffle` from `@/games/choices` instead.
- In the hand-checked `removeGst` test, the price is fixed at $100 (`gstExact`), so `p = roundCents(110)` and the prompt reads "$110 including GST". The distractors are 99, 100 (a duplicate, so it's dropped) and 121. None of them have cents, so `$99` is present and nudges stay whole dollars.
- In the `stackedDiscount` test, the values are 250 → 200 → 180, and the distractors are 175, 200, 225. They're all whole dollars, so no cents are shown.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/games/money-maths`
Expected: PASS. If a level/seed throws "Couldn’t make distinct options", the nudge range is too narrow for tiny prices. Widen it to `r.int(5, 25)` and rerun. Don't remove the test.

- [ ] **Step 6: Run all checks and commit**

Run: `npm run typecheck && npm run lint && npm test`
```bash
git add src/games/money-maths
git commit -m "Add Money Maths problem generator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Money Maths view, module and registry, then deploy

**Files:**
- Create: `src/games/money-maths/MoneyMathsView.tsx`, `src/games/money-maths/MoneyMathsView.module.css`, `src/games/money-maths/index.ts`, `src/games/money-maths/module.test.tsx`
- Modify: `src/games/registry.ts`
- Test: `src/round/RoundScreen.test.tsx` (add a Money Maths round)

**Interfaces:**
- Consumes: `ChoiceGrid` (Task 3); `generateItems`, `timeLimitMs`, `targetTimeMs`, `ITEMS_PER_ROUND`, `MoneyItem` (Task 4)
- Produces: `moneyMaths: GameModule<MoneyItem, number>`, registered as `'money-maths'`

- [ ] **Step 1: Write the failing tests**

`src/games/money-maths/module.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { getGameModule } from '@/games/registry'
import { createRng } from '@/lib/rng'
import type { MoneyItem } from './generate'
import { moneyMaths } from './index'
import { MoneyMathsView } from './MoneyMathsView'

const item: MoneyItem = {
  type: 'discount',
  prompt: 'A $80 jacket is 25% off. What do you pay?',
  inputs: { p: 80, d: 25 },
  options: ['$100', '$60', '$20', '$55'],
  correctIndex: 1,
}

describe('moneyMaths module', () => {
  it('checks the chosen index and labels the answer', () => {
    expect(moneyMaths.check(item, 1)).toBe(true)
    expect(moneyMaths.check(item, 0)).toBe(false)
    expect(moneyMaths.answerLabel(item)).toBe('$60')
  })

  it('generates a round of 10 and is registered', () => {
    expect(moneyMaths.generate(1, createRng(1))).toHaveLength(10)
    expect(getGameModule('money-maths')).toBe(moneyMaths)
  })
})

describe('MoneyMathsView', () => {
  it('shows the prompt and answers with the tapped index', () => {
    const onAnswer = vi.fn()
    render(<MoneyMathsView item={item} onAnswer={onAnswer} feedback={null} />)
    expect(screen.getByText(item.prompt)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '$60' }))
    expect(onAnswer).toHaveBeenCalledWith(1)
  })
})
```

Add to `src/round/RoundScreen.test.tsx`. This is a full round against the real generator, choosing the correct option by reading the module's own answer. Import `moneyMaths` and `createRng`, and mock the seed:
```tsx
import { moneyMaths } from '@/games/money-maths'
import { createRng } from '@/lib/rng'

  it('plays a full Money Maths round with the choice grid', async () => {
    vi.setSystemTime(1234)
    const items = moneyMaths.generate(1, createRng(1234)) // RoundScreen seeds with Date.now()
    const { send } = renderRound('/play/money-maths')
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    for (const it of items) {
      fireEvent.click(screen.getByRole('button', { name: moneyMaths.answerLabel(it) }))
      act(() => vi.advanceTimersByTime(250))
    }
    expect(screen.getByLabelText('Score 100 out of 100')).toBeInTheDocument()
    await flushPromises()
    expect(send.mock.calls[0]![0]).toMatchObject({ gameId: 'money-maths', accuracy: 1 })
  })
```
(`vi.setSystemTime` under fake timers fixes `Date.now()`, so the screen generates the same items. The clicks happen without advancing time, so the clock still reads 1234 at Start.)

- [ ] **Step 2: Run the tests to check they fail**

Run: `npx vitest run src/games/money-maths/module.test.tsx src/round/RoundScreen.test.tsx`
Expected: FAIL, because `./index` and `./MoneyMathsView` aren't found, and the round redirects.

- [ ] **Step 3: Implement**

`src/games/money-maths/MoneyMathsView.tsx`:
```tsx
import { ChoiceGrid } from '@/components/ChoiceGrid'
import type { ItemViewProps } from '@/games/types'
import type { MoneyItem } from './generate'
import styles from './MoneyMathsView.module.css'

export function MoneyMathsView({ item, onAnswer, feedback }: ItemViewProps<MoneyItem, number>) {
  return (
    <div className={styles.view}>
      <p className={styles.prompt} data-testid="prompt">
        {item.prompt}
      </p>
      <ChoiceGrid
        options={item.options}
        correctIndex={item.correctIndex}
        feedback={feedback}
        onChoose={onAnswer}
      />
    </div>
  )
}
```

`src/games/money-maths/MoneyMathsView.module.css`:
```css
.view {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.prompt {
  flex: 1;
  display: flex;
  align-items: center;
  font-size: clamp(1.35rem, 6vw, 1.75rem);
  font-weight: 600;
  line-height: 1.35;
  text-wrap: pretty;
}
```

`src/games/money-maths/index.ts`:
```ts
import type { GameModule } from '@/games/types'
import { generateItems, ITEMS_PER_ROUND, targetTimeMs, timeLimitMs, type MoneyItem } from './generate'
import { MoneyMathsView } from './MoneyMathsView'

export const moneyMaths: GameModule<MoneyItem, number> = {
  kind: 'items',
  id: 'money-maths',
  itemsPerRound: ITEMS_PER_ROUND,
  generate: (level, rng) => generateItems(level, rng, ITEMS_PER_ROUND),
  timeLimitMs,
  targetTimeMs,
  check: (item, index) => index === item.correctIndex,
  answerLabel: (item) => item.options[item.correctIndex]!,
  ItemView: MoneyMathsView,
}
```

`src/games/registry.ts`: import `moneyMaths` from `./money-maths` and add `'money-maths': moneyMaths,` to `GAME_MODULES`.

- [ ] **Step 4: Run all checks**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 5: Look at it**

Run `npm run dev`, open `/play/money-maths` at a 390 × 844 viewport, and play a round at L1. Check that the prompt is readable, the 4 buttons fit without scrolling, and wrong answers outline the right option. If you can't open a browser, say so in your report.

- [ ] **Step 6: Commit and deploy**

```bash
git add src/games/money-maths src/games/registry.ts src/round/RoundScreen.test.tsx
git commit -m "Add Money Maths game

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git checkout main && git merge --ff-only scaffold && git push origin main scaffold && git checkout scaffold
```

---

### Task 6: Table Reasoning generator

**Files:**
- Create: `src/games/table-reasoning/themes.ts`, `src/games/table-reasoning/levels.ts`, `src/games/table-reasoning/generate.ts`, `src/games/table-reasoning/generate.test.ts`

**Interfaces:**
- Consumes: `ChoiceItem`, `makeChoices`, `makeLabelChoices`, `roundTo`, `shuffle` (Task 2); `formatAud` (Task 2)
- Produces:
  - `type Unit = '$' | 'units' | 'hours'`
  - `type Table = { title: string; unit: Unit; rowNoun: string; colNoun: string; measure: string; columns: string[]; rows: { label: string; values: number[] }[] }`
  - `type QuestionType = 'difference' | 'total' | 'average' | 'pctChange' | 'share' | 'ratio' | 'pickRow' | 'avgPctChange'`
  - `type TableItem = ChoiceItem & { type: QuestionType; table: Table }`
  - `ITEMS_PER_ROUND = 10`, `levelSpec`, `generateItems`, `timeLimitMs`, `targetTimeMs`
  - `pctChange(from, to)`, `formatValue(n, unit)`, `formatPct(n, dp)`

- [ ] **Step 1: Write the failing tests**

`src/games/table-reasoning/generate.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the tests to check they fail**

Run: `npx vitest run src/games/table-reasoning`
Expected: FAIL, because the modules aren't found.

- [ ] **Step 3: Implement themes and levels**

`src/games/table-reasoning/themes.ts`:
```ts
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
```

`src/games/table-reasoning/levels.ts`:
```ts
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
```

- [ ] **Step 4: Implement the generator**

`src/games/table-reasoning/generate.ts`:
```ts
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
  | 'difference'
  | 'total'
  | 'average'
  | 'pctChange'
  | 'share'
  | 'ratio'
  | 'pickRow'
  | 'avgPctChange'
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
  makeChoices(roundTo(correct, dp), distractors.map((d) => roundTo(d, dp)), rng, {
    format: (n) => formatPct(n, dp),
    nudge: (n, r) => roundTo(n + (r.next() < 0.5 ? -1 : 1) * (dp === 0 ? r.int(2, 9) : r.int(5, 30) / 10), dp),
    allowNegative: true,
  })

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
        prompt: `How much higher was ${label(a)}’s ${t.measure} than ${label(b)}’s in ${t.columns[c]}?`,
        choices: valueChoices(
          v(a, c) - v(b, c),
          [Math.abs(v(a, otherC) - v(b, otherC)), Math.abs(v(a, c) - v(third, c)), v(a, c) + v(b, c)],
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
        prompt: `What was ${label(r)}’s total ${t.measure} across all ${t.colNoun}s shown?`,
        choices: valueChoices(sum(row), [sum(row) - row[x]!, sum(row) - row[y]!, sum(colVals(0))], t.unit, rng),
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
        choices: valueChoices(mean(col), [sum(col), sum(col) / (col.length - 1), median], t.unit, rng),
      }
    }
    case 'pctChange': {
      const r = rng.int(0, nRows - 1)
      const from = v(r, 0)
      const to = v(r, last)
      if (from === to) return null
      const change = pctChange(from, to)
      return {
        prompt: `What was the % change in ${label(r)}’s ${t.measure} from ${t.columns[0]} to ${t.columns[last]}, to the nearest whole %?`,
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
        prompt: `What % of ${t.columns[c]} ${t.measure} came from ${label(r)}, to the nearest whole %?`,
        choices: makeChoices(
          roundTo(share, 0),
          [
            (v(r, c) / sum(t.rows[r]!.values)) * 100,
            (v(r, c) / grand) * 100,
            (v(nextRow, c) / sum(colVals(c))) * 100,
          ].map((d) => roundTo(d, 0)),
          rng,
          { format: (n) => `${n}%`, nudge: (n, rr) => Math.max(1, n + (rr.next() < 0.5 ? -1 : 1) * rr.int(2, 9)) },
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
        prompt: `What is the ratio of ${label(a)}’s to ${label(b)}’s ${t.measure} in ${t.columns[c]}, in simplest form?`,
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
    const table = makeTable(rng.pick(THEMES), spec, rng)
    const built = ask(type, table, spec, rng)
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
    if (attempt >= MAX_ATTEMPTS) throw new Error(`Couldn’t generate ${count} items for level ${level}`)
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
```

Implementation notes for the engineer:
- **Ratio cells.** `ratio` overwrites two cells with `x·k·step` and `y·k·step`, choosing `k` so both stay within `[min, max]` and on the level's step. If no `k` fits (a big ratio on a narrow range), it returns `null` and the caller rerolls.
- **Prompt uniqueness.** Prompts repeat rarely, because the theme/row/column space is small at L1. The dedupe loop handles it.
- **The `total` test.** It finds the named row with `` `${r.label}’s` ``, so keep that exact possessive form in the prompts.
- **`total` distractor collisions.** When `twoOf` picks two cells with equal values, the `total` distractors collide. `makeChoices` nudges to fill the gap, which is fine.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/games/table-reasoning`
Expected: PASS. If a level throws "Couldn’t generate a table question" (for example `pickRow` at 5 rows), raise `MAX_ATTEMPTS` for `makeItem` to 5000 and rerun. If it still throws, make `pickRow` force a trap: multiply the largest-% row's first value down until another row has the larger absolute increase. Then re-check the test.

- [ ] **Step 6: Run all checks and commit**

Run: `npm run typecheck && npm run lint && npm test`
```bash
git add src/games/table-reasoning
git commit -m "Add Table Reasoning question generator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Table Reasoning view, module and registry, then deploy

**Files:**
- Create: `src/games/table-reasoning/TableReasoningView.tsx`, `src/games/table-reasoning/TableReasoningView.module.css`, `src/games/table-reasoning/index.ts`, `src/games/table-reasoning/module.test.tsx`
- Modify: `src/games/registry.ts`

**Interfaces:**
- Consumes: `ChoiceGrid` (Task 3); `TableItem`, `formatValue`, `generateItems`, `timeLimitMs`, `targetTimeMs`, `ITEMS_PER_ROUND` (Task 6)
- Produces: `tableReasoning: GameModule<TableItem, number>`, registered as `'table-reasoning'`

- [ ] **Step 1: Write the failing test**

`src/games/table-reasoning/module.test.tsx`:
```tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import { getGameModule } from '@/games/registry'
import { createRng } from '@/lib/rng'
import type { TableItem } from './generate'
import { tableReasoning } from './index'
import { TableReasoningView } from './TableReasoningView'

const item: TableItem = {
  type: 'difference',
  prompt: 'How much higher was Store A’s sales than Store B’s in Feb?',
  table: {
    title: 'Sales by store ($)',
    unit: '$',
    rowNoun: 'store',
    colNoun: 'month',
    measure: 'sales',
    columns: ['Jan', 'Feb'],
    rows: [
      { label: 'Store A', values: [1200, 1500] },
      { label: 'Store B', values: [900, 1100] },
    ],
  },
  options: ['$400', '$300', '$2,600', '$350'],
  correctIndex: 0,
}

describe('tableReasoning module', () => {
  it('checks the chosen index and is registered', () => {
    expect(tableReasoning.check(item, 0)).toBe(true)
    expect(tableReasoning.answerLabel(item)).toBe('$400')
    expect(tableReasoning.generate(1, createRng(1))).toHaveLength(10)
    expect(getGameModule('table-reasoning')).toBe(tableReasoning)
  })
})

describe('TableReasoningView', () => {
  it('renders the table with headers and formatted cells', () => {
    render(<TableReasoningView item={item} onAnswer={vi.fn()} feedback={null} />)
    const table = screen.getByRole('table', { name: 'Sales by store ($)' })
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['', 'Jan', 'Feb'])
    expect(within(table).getByRole('rowheader', { name: 'Store A' })).toBeInTheDocument()
    expect(within(table).getByText('$1,500')).toBeInTheDocument()
  })

  it('answers with the tapped index', () => {
    const onAnswer = vi.fn()
    render(<TableReasoningView item={item} onAnswer={onAnswer} feedback={null} />)
    fireEvent.click(screen.getByRole('button', { name: '$300' }))
    expect(onAnswer).toHaveBeenCalledWith(1)
  })
})
```

- [ ] **Step 2: Run the test to check it fails**

Run: `npx vitest run src/games/table-reasoning/module.test.tsx`
Expected: FAIL, because the modules aren't found.

- [ ] **Step 3: Implement**

`src/games/table-reasoning/TableReasoningView.tsx`:
```tsx
import { ChoiceGrid } from '@/components/ChoiceGrid'
import type { ItemViewProps } from '@/games/types'
import { formatValue, type TableItem } from './generate'
import styles from './TableReasoningView.module.css'

export function TableReasoningView({ item, onAnswer, feedback }: ItemViewProps<TableItem, number>) {
  const { table } = item
  return (
    <div className={styles.view}>
      <div className={styles.scroll}>
        <table className={styles.table} aria-label={table.title}>
          <caption className={styles.caption}>{table.title}</caption>
          <thead>
            <tr>
              <th scope="col" />
              {table.columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.values.map((v, i) => (
                  <td key={i}>{formatValue(v, table.unit)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.prompt} data-testid="prompt">
          {item.prompt}
        </p>
      </div>
      <ChoiceGrid
        options={item.options}
        correctIndex={item.correctIndex}
        feedback={feedback}
        onChoose={onAnswer}
      />
    </div>
  )
}
```

`src/games/table-reasoning/TableReasoningView.module.css`:
```css
.view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Table and question scroll if needed; the answers stay put at the bottom. */
.scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.caption {
  caption-side: top;
  text-align: left;
  padding-bottom: var(--space-2);
  color: var(--ink-muted);
  font-size: var(--text-sm);
  font-weight: 600;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.table th,
.table td {
  padding: 6px 4px;
  border-bottom: 1px solid var(--surface-raised);
  text-align: right;
  white-space: nowrap;
}

.table thead th {
  color: var(--ink-muted);
  font-weight: 600;
}

.table tbody th {
  text-align: left;
  font-weight: 600;
}

.prompt {
  font-size: var(--text-lg);
  font-weight: 600;
  line-height: 1.35;
  text-wrap: pretty;
}
```

`src/games/table-reasoning/index.ts`:
```ts
import type { GameModule } from '@/games/types'
import { generateItems, ITEMS_PER_ROUND, targetTimeMs, timeLimitMs, type TableItem } from './generate'
import { TableReasoningView } from './TableReasoningView'

export const tableReasoning: GameModule<TableItem, number> = {
  kind: 'items',
  id: 'table-reasoning',
  itemsPerRound: ITEMS_PER_ROUND,
  generate: (level, rng) => generateItems(level, rng, ITEMS_PER_ROUND),
  timeLimitMs,
  targetTimeMs,
  check: (item, index) => index === item.correctIndex,
  answerLabel: (item) => item.options[item.correctIndex]!,
  ItemView: TableReasoningView,
}
```

`src/games/registry.ts`: add `'table-reasoning': tableReasoning,`.

- [ ] **Step 4: Run all checks**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 5: Look at it**

Run `npm run dev`. At a 390 × 844 viewport, play `/play/table-reasoning`. Then set the level to 17 for testing. The simplest way is in the browser console: edit `localStorage` key `brian.progress.v1.<userId>` so `games['table-reasoning'].level = 17`, then reload. Check that a 6 × 4 `$` table fits without horizontal scrolling, and that the answer grid stays visible. If cells overflow at 6 × 4 with values like `$9,999`, reduce the table font to `0.82rem` below 400 px wide using a media query. Report what you saw, or that you couldn't check.

- [ ] **Step 6: Commit and deploy**

```bash
git add src/games/table-reasoning src/games/registry.ts
git commit -m "Add Table Reasoning game

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git checkout main && git merge --ff-only scaffold && git push origin main scaffold && git checkout scaffold
```

---

### Task 8: Rule Switch generator

**Files:**
- Create: `src/games/rule-switch/levels.ts`, `src/games/rule-switch/generate.ts`, `src/games/rule-switch/generate.test.ts`

**Interfaces:**
- Consumes: `Rng`
- Produces:
  - `type Rule = 'colour' | 'shape' | 'fill'`
  - `type Side = 'left' | 'right'`
  - `type Card = { colour: 'blue' | 'orange'; shape: 'circle' | 'square'; fill: 'solid' | 'outline' }`
  - `type RuleItem = { rule: Rule; card: Card; correct: Side }`
  - `ITEMS_PER_ROUND = 20`
  - `rulesFor(level): Rule[]`, `switchP(level)`, `sideOf(card, rule): Side`, `isConflict(card, rule, rules): boolean`
  - `generateItems(level, rng, count?)`, `timeLimitMs`, `targetTimeMs`
  - `LEFT: Record<Rule, string>` and `RIGHT: Record<Rule, string>`, the attribute value that goes on each side

- [ ] **Step 1: Write the failing tests**

`src/games/rule-switch/generate.test.ts`:
```ts
import { createRng } from '@/lib/rng'
import { generateItems, isConflict, rulesFor, sideOf, switchP, targetTimeMs, timeLimitMs, type Card } from './generate'

const card: Card = { colour: 'blue', shape: 'square', fill: 'solid' }

describe('Rule Switch basics', () => {
  it('maps each attribute to a side', () => {
    expect(sideOf(card, 'colour')).toBe('left')
    expect(sideOf(card, 'shape')).toBe('right')
    expect(sideOf(card, 'fill')).toBe('left')
  })

  it('calls a card a conflict when another active rule points the other way', () => {
    expect(isConflict(card, 'colour', ['colour', 'shape'])).toBe(true)
    expect(isConflict({ ...card, shape: 'circle' }, 'colour', ['colour', 'shape'])).toBe(false)
  })

  it('adds fill as a rule from level 14', () => {
    expect(rulesFor(13)).toEqual(['colour', 'shape'])
    expect(rulesFor(14)).toEqual(['colour', 'shape', 'fill'])
  })

  it('switches more often and allows less time as levels rise', () => {
    expect(switchP(1)).toBeCloseTo(1 / 6)
    expect(switchP(20)).toBeCloseTo(1 / 2)
    expect(timeLimitMs(1)).toBe(3000)
    expect(timeLimitMs(20)).toBe(1000)
    expect(targetTimeMs(1)).toBe(1500)
  })
})

describe('Rule Switch generator', () => {
  for (let level = 1; level <= 20; level++) {
    it(`level ${level}: switches, conflicts and answers`, () => {
      const rules = rulesFor(level)
      for (let seed = 1; seed <= 200; seed++) {
        const items = generateItems(level, createRng(seed))
        expect(items).toHaveLength(20)
        let switches = 0
        let conflicts = 0
        items.forEach((item, i) => {
          expect(rules).toContain(item.rule)
          expect(item.correct).toBe(sideOf(item.card, item.rule))
          if (level < 14) expect(item.card.fill).toBe('solid')
          const conflict = isConflict(item.card, item.rule, rules)
          if (conflict) conflicts++
          if (i > 0 && item.rule !== items[i - 1]!.rule) {
            switches++
            expect(conflict).toBe(true)
          }
        })
        expect(switches).toBeGreaterThanOrEqual(2)
        expect(conflicts).toBeGreaterThanOrEqual(12)
      }
    })
  }
})
```

- [ ] **Step 2: Run the tests to check they fail**

Run: `npx vitest run src/games/rule-switch`
Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement**

`src/games/rule-switch/levels.ts`:
```ts
// Rule Switch difficulty per level (spec §4.2). All values [tunable].
export const ITEMS_PER_ROUND = 20
export const FILL_FROM_LEVEL = 14
export const MIN_SWITCHES = 2
/** At least this share of cards make the rule matter (another attribute points the other way). */
export const MIN_CONFLICT_SHARE = 0.6
export const SWITCH_P_L1 = 1 / 6
export const SWITCH_P_L20 = 1 / 2
export const LIMIT_MS_L1 = 3000
export const LIMIT_MS_L20 = 1000
export const TARGET_SHARE = 0.5
```

`src/games/rule-switch/generate.ts`:
```ts
import type { Rng } from '@/lib/rng'
import {
  FILL_FROM_LEVEL,
  ITEMS_PER_ROUND,
  LIMIT_MS_L1,
  LIMIT_MS_L20,
  MIN_CONFLICT_SHARE,
  MIN_SWITCHES,
  SWITCH_P_L1,
  SWITCH_P_L20,
  TARGET_SHARE,
} from './levels'

export { ITEMS_PER_ROUND } from './levels'

export type Rule = 'colour' | 'shape' | 'fill'
export type Side = 'left' | 'right'
export type Card = { colour: 'blue' | 'orange'; shape: 'circle' | 'square'; fill: 'solid' | 'outline' }
export type RuleItem = { rule: Rule; card: Card; correct: Side }

/** The attribute value that sorts left / right under each rule. */
export const LEFT = { colour: 'blue', shape: 'circle', fill: 'solid' } as const satisfies Record<Rule, string>
export const RIGHT = { colour: 'orange', shape: 'square', fill: 'outline' } as const satisfies Record<Rule, string>

const MAX_ATTEMPTS = 1000
const clampLevel = (level: number) => Math.min(20, Math.max(1, Math.round(level)))
const lerp = (a: number, b: number, level: number) => a + ((clampLevel(level) - 1) * (b - a)) / 19

export const rulesFor = (level: number): Rule[] =>
  clampLevel(level) >= FILL_FROM_LEVEL ? ['colour', 'shape', 'fill'] : ['colour', 'shape']

export const switchP = (level: number) => lerp(SWITCH_P_L1, SWITCH_P_L20, level)
export const timeLimitMs = (level: number) => Math.round(lerp(LIMIT_MS_L1, LIMIT_MS_L20, level))
export const targetTimeMs = (level: number) => Math.round(TARGET_SHARE * timeLimitMs(level))

export const sideOf = (card: Card, rule: Rule): Side => (card[rule] === LEFT[rule] ? 'left' : 'right')

export const isConflict = (card: Card, rule: Rule, rules: readonly Rule[]) =>
  rules.some((r) => r !== rule && sideOf(card, r) !== sideOf(card, rule))

function randomCard(rules: readonly Rule[], rng: Rng): Card {
  return {
    colour: rng.pick(['blue', 'orange'] as const),
    shape: rng.pick(['circle', 'square'] as const),
    fill: rules.includes('fill') ? rng.pick(['solid', 'outline'] as const) : 'solid',
  }
}

function conflictCard(rule: Rule, rules: readonly Rule[], rng: Rng): Card {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const card = randomCard(rules, rng)
    if (isConflict(card, rule, rules)) return card
  }
  throw new Error('Couldn’t make a conflict card')
}

function ruleSequence(level: number, count: number, rng: Rng): Rule[] {
  const rules = rulesFor(level)
  const p = switchP(level)
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const seq: Rule[] = [rng.pick(rules)]
    for (let i = 1; i < count; i++) {
      const prev = seq[i - 1]!
      seq.push(rng.next() < p ? rng.pick(rules.filter((r) => r !== prev)) : prev)
    }
    const switches = seq.filter((r, i) => i > 0 && r !== seq[i - 1]).length
    if (switches >= MIN_SWITCHES) return seq
  }
  throw new Error(`Couldn’t make a rule sequence for level ${level}`)
}

export function generateItems(level: number, rng: Rng, count = ITEMS_PER_ROUND): RuleItem[] {
  const rules = rulesFor(level)
  const seq = ruleSequence(level, count, rng)
  const cards = seq.map((rule, i) =>
    i > 0 && rule !== seq[i - 1] ? conflictCard(rule, rules, rng) : randomCard(rules, rng),
  )
  // Top up conflicts on random non-conflict cards until the share is met.
  const need = Math.ceil(MIN_CONFLICT_SHARE * count)
  const plain = cards.map((c, i) => i).filter((i) => !isConflict(cards[i]!, seq[i]!, rules))
  let conflicts = count - plain.length
  while (conflicts < need) {
    const pick = plain.splice(rng.int(0, plain.length - 1), 1)[0]!
    cards[pick] = conflictCard(seq[pick]!, rules, rng)
    conflicts++
  }
  return seq.map((rule, i) => ({ rule, card: cards[i]!, correct: sideOf(cards[i]!, rule) }))
}
```

- [ ] **Step 4: Run all checks and commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.
```bash
git add src/games/rule-switch
git commit -m "Add Rule Switch card generator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Rule Switch view, module and registry, then deploy

**Files:**
- Create: `src/games/rule-switch/RuleSwitchView.tsx`, `src/games/rule-switch/RuleSwitchView.module.css`, `src/games/rule-switch/index.ts`, `src/games/rule-switch/module.test.tsx`
- Modify: `src/games/registry.ts`, `src/round/RoundScreen.module.css` (segment gap), `src/games/speed-arithmetic/module.test.tsx` and `src/round/RoundScreen.test.tsx` (they use `rule-switch` as the "unbuilt" game, so switch them to `detail-recall`)

**Interfaces:**
- Consumes: `RuleItem`, `Side`, `LEFT`, `RIGHT`, `generateItems`, `timeLimitMs`, `targetTimeMs`, `ITEMS_PER_ROUND` (Task 8)
- Produces: `ruleSwitch: GameModule<RuleItem, Side>`, registered as `'rule-switch'`

- [ ] **Step 1: Write the failing tests**

`src/games/rule-switch/module.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { getGameModule } from '@/games/registry'
import { createRng } from '@/lib/rng'
import type { RuleItem } from './generate'
import { ruleSwitch } from './index'
import { RuleSwitchView } from './RuleSwitchView'

const item: RuleItem = { rule: 'shape', card: { colour: 'blue', shape: 'square', fill: 'solid' }, correct: 'right' }

describe('ruleSwitch module', () => {
  it('checks the side and labels the answer with the rule', () => {
    expect(ruleSwitch.check(item, 'right')).toBe(true)
    expect(ruleSwitch.check(item, 'left')).toBe(false)
    expect(ruleSwitch.answerLabel(item)).toBe('Right — shape')
    expect(ruleSwitch.itemsPerRound).toBe(20)
    expect(ruleSwitch.readyHint).toMatch(/rule can change/)
    expect(ruleSwitch.generate(1, createRng(1))).toHaveLength(20)
    expect(getGameModule('rule-switch')).toBe(ruleSwitch)
  })
})

describe('RuleSwitchView', () => {
  it('shows the cue and side labels for the current rule', () => {
    render(<RuleSwitchView item={item} onAnswer={vi.fn()} feedback={null} />)
    expect(screen.getByTestId('cue')).toHaveTextContent('SHAPE')
    expect(screen.getByRole('button', { name: 'Left: circle' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Right: square' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Blue solid square' })).toBeInTheDocument()
  })

  it('answers by tap or arrow key, once, ignoring repeats', () => {
    const onAnswer = vi.fn()
    render(<RuleSwitchView item={item} onAnswer={onAnswer} feedback={null} />)
    fireEvent.keyDown(window, { key: 'ArrowLeft', repeat: true })
    expect(onAnswer).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.click(screen.getByRole('button', { name: 'Left: circle' }))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledWith('right')
  })

  it('locks input and marks the right side during feedback', () => {
    const onAnswer = vi.fn()
    render(
      <RuleSwitchView item={item} onAnswer={onAnswer} feedback={{ correct: false, answerLabel: 'Right — shape' }} />,
    )
    expect(screen.getByRole('button', { name: 'Right: square' })).toHaveAttribute('data-state', 'answer')
    fireEvent.click(screen.getByRole('button', { name: 'Left: circle' }))
    expect(onAnswer).not.toHaveBeenCalled()
  })
})
```

In `src/games/speed-arithmetic/module.test.tsx` and `src/round/RoundScreen.test.tsx`, change `'rule-switch'` / `'/play/rule-switch'` to `'detail-recall'` / `'/play/detail-recall'`.

- [ ] **Step 2: Run the tests to check they fail**

Run: `npx vitest run src/games/rule-switch`
Expected: FAIL, because `./index` and `./RuleSwitchView` aren't found.

- [ ] **Step 3: Implement**

`src/games/rule-switch/RuleSwitchView.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import type { ItemViewProps } from '@/games/types'
import { LEFT, RIGHT, type Card, type Rule, type RuleItem, type Side } from './generate'
import styles from './RuleSwitchView.module.css'

const CUE: Record<Rule, string> = { colour: 'COLOUR', shape: 'SHAPE', fill: 'FILL' }
const SYMBOL: Record<string, string> = {
  blue: 'Blue',
  orange: 'Orange',
  circle: '●',
  square: '■',
  solid: 'Solid',
  outline: 'Outline',
}

function CardShape({ card }: { card: Card }) {
  const colour = card.colour === 'blue' ? 'var(--rs-blue)' : 'var(--rs-orange)'
  const solid = card.fill === 'solid'
  const paint = { fill: solid ? colour : 'none', stroke: colour, strokeWidth: 8 }
  const name = `${card.colour[0]!.toUpperCase()}${card.colour.slice(1)} ${card.fill} ${card.shape}`
  return (
    <svg className={styles.card} viewBox="0 0 120 120" role="img" aria-label={name}>
      {card.shape === 'circle' ? <circle cx="60" cy="60" r="44" {...paint} /> : <rect x="16" y="16" width="88" height="88" rx="6" {...paint} />}
    </svg>
  )
}

export function RuleSwitchView({ item, onAnswer, feedback }: ItemViewProps<RuleItem, Side>) {
  const answered = useRef(false)

  function answer(side: Side) {
    if (feedback || answered.current) return
    answered.current = true
    onAnswer(side)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowLeft') answer('left')
      else if (e.key === 'ArrowRight') answer('right')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const sideButton = (side: Side) => {
    const value = (side === 'left' ? LEFT : RIGHT)[item.rule]
    const state = feedback && !feedback.correct && side === item.correct ? 'answer' : 'idle'
    return (
      <button
        type="button"
        className={styles.side}
        data-state={state}
        disabled={feedback !== null}
        aria-label={`${side === 'left' ? 'Left' : 'Right'}: ${value}`}
        onClick={() => answer(side)}
      >
        {SYMBOL[value]}
      </button>
    )
  }

  return (
    <div className={styles.view}>
      <p className={styles.cue} data-testid="cue">
        {CUE[item.rule]}
      </p>
      <div className={styles.cardArea}>
        <CardShape card={item.card} />
      </div>
      <div className={styles.sides}>
        {sideButton('left')}
        {sideButton('right')}
      </div>
    </div>
  )
}
```

`src/games/rule-switch/RuleSwitchView.module.css`:
```css
/* Colour-blind-safe pair, distinct from the track colours. */
.view {
  --rs-blue: #3d8bfd;
  --rs-orange: #ff8a1f;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cue {
  text-align: center;
  color: var(--track);
  font-size: clamp(1.75rem, 9vw, 2.5rem);
  font-weight: 800;
  letter-spacing: 0.08em;
}

.cardArea {
  flex: 1;
  display: grid;
  place-items: center;
}

.card {
  width: min(45vw, 180px);
  height: auto;
}

.sides {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.side {
  min-height: 88px;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--ink);
  font-size: var(--text-xl);
  font-weight: 700;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  transition: transform var(--dur-fast) var(--ease-out);
}

.side:active:not(:disabled) {
  transform: scale(0.97);
  background: var(--surface-raised);
}

.side[data-state='answer'] {
  border-color: var(--correct);
}
```

`src/games/rule-switch/index.ts`:
```ts
import type { GameModule } from '@/games/types'
import { generateItems, ITEMS_PER_ROUND, targetTimeMs, timeLimitMs, type RuleItem, type Side } from './generate'
import { RuleSwitchView } from './RuleSwitchView'

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

export const ruleSwitch: GameModule<RuleItem, Side> = {
  kind: 'items',
  id: 'rule-switch',
  itemsPerRound: ITEMS_PER_ROUND,
  readyHint: 'Sort each card by the rule shown. The rule can change at any time.',
  generate: (level, rng) => generateItems(level, rng, ITEMS_PER_ROUND),
  timeLimitMs,
  targetTimeMs,
  check: (item, side) => side === item.correct,
  answerLabel: (item) => `${cap(item.correct)} — ${item.rule}`,
  ItemView: RuleSwitchView,
}
```

`src/games/registry.ts`: add `'rule-switch': ruleSwitch,`.

`src/round/RoundScreen.module.css`: in `.segments`, change `gap: 4px;` to `gap: clamp(2px, 1vw, 4px);`. That keeps 20 segments of at least 6 px wide at 320 px.

- [ ] **Step 4: Run all checks**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 5: Look at it**

Run `npm run dev`. Play `/play/rule-switch` at 320 px and 390 px widths. Check that the 20-segment strip fits on one line, the cue is unmissable, and the shapes are clearly different in both themes. Report what you saw, or that you couldn't check.

- [ ] **Step 6: Commit and deploy**

```bash
git add src/games/rule-switch src/games/registry.ts src/round src/games/speed-arithmetic/module.test.tsx
git commit -m "Add Rule Switch game

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git checkout main && git merge --ff-only scaffold && git push origin main scaffold && git checkout scaffold
```

---

### Task 10: Sequence Recall levels, sequence generator and run reducer

**Files:**
- Create: `src/games/sequence-recall/levels.ts`, `src/games/sequence-recall/run.ts`, `src/games/sequence-recall/run.test.ts`

**Interfaces:**
- Consumes: `Rng`; `RunResult` (Task 1)
- Produces:
  - `levels.ts`: `gridSize(level)`, `startLength(level)`, `targetLength(level)`, `flashMs(level)`, `gapMs(level)`, `allowRepeats(level)`, `LEAD_IN_MS = 600`, `MAX_MISTAKES = 2`, `TAP_GAP_CAP_MS = 5000`, `SUCCESS_PAUSE_MS = 400`, `MISTAKE_PAUSE_MS = 1000`
  - `run.ts`:
    - `generateSequence(length, level, rng): number[]` (tile indexes `0 … size² − 1`)
    - `type RunPhase = 'show' | 'input' | 'feedback' | 'done'`
    - `type RunState`, with fields as in Step 3
    - `type RunEvent = { type: 'shown'; now: number } | { type: 'tap'; tile: number; now: number } | { type: 'next'; sequence: number[] }`
    - `initRun(sequence: number[]): RunState`
    - `runReducer(state, event): RunState`
    - `nextLength(state): number`
    - `scoreRun(longest, level): number`
    - `runResult(state, level): RunResult`

- [ ] **Step 1: Write the failing tests**

`src/games/sequence-recall/run.test.ts`:
```ts
import { createRng } from '@/lib/rng'
import { allowRepeats, flashMs, gapMs, gridSize, startLength, targetLength } from './levels'
import { generateSequence, initRun, nextLength, runReducer, runResult, scoreRun, type RunEvent, type RunState } from './run'

const play = (state: RunState, ...events: RunEvent[]) => events.reduce(runReducer, state)
const tapAll = (seq: number[], start: number) => seq.map((tile, i) => ({ type: 'tap' as const, tile, now: start + (i + 1) * 500 }))

describe('Sequence Recall levels', () => {
  it('grows the grid and start length with level', () => {
    expect([gridSize(1), gridSize(7), gridSize(14)]).toEqual([3, 4, 5])
    expect([startLength(1), startLength(4), startLength(20)]).toEqual([3, 4, 9])
    expect(targetLength(1)).toBe(5)
    expect(flashMs(1)).toBe(700)
    expect(flashMs(20)).toBe(350)
    expect(gapMs(20)).toBe(150)
    expect([allowRepeats(7), allowRepeats(8)]).toEqual([false, true])
  })
})

describe('generateSequence', () => {
  it('stays on the grid, never repeats below L8, never doubles up', () => {
    for (let level = 1; level <= 20; level++) {
      for (let seed = 1; seed <= 100; seed++) {
        const n = gridSize(level) ** 2
        const seq = generateSequence(startLength(level) + 3, level, createRng(seed))
        expect(seq).toHaveLength(startLength(level) + 3)
        seq.forEach((t, i) => {
          expect(t).toBeGreaterThanOrEqual(0)
          expect(t).toBeLessThan(n)
          if (i > 0) expect(t).not.toBe(seq[i - 1])
        })
        if (!allowRepeats(level)) expect(new Set(seq).size).toBe(seq.length)
      }
    }
  })

  it('allows repeats once a sequence is longer than the grid', () => {
    const seq = generateSequence(12, 1, createRng(1)) // 3 × 3 grid
    expect(seq).toHaveLength(12)
    seq.forEach((t, i) => i > 0 && expect(t).not.toBe(seq[i - 1]))
  })
})

describe('run reducer', () => {
  it('grows after a success, holds after a mistake, and ends after two mistakes', () => {
    let s = initRun([0, 1, 2])
    s = play(s, { type: 'shown', now: 0 }, ...tapAll([0, 1, 2], 0))
    expect(s).toMatchObject({ phase: 'feedback', lastOk: true, longest: 3, successes: 1, attempts: 1 })
    expect(nextLength(s)).toBe(4)

    s = play(s, { type: 'next', sequence: [3, 4, 5, 6] }, { type: 'shown', now: 5000 })
    s = play(s, { type: 'tap', tile: 3, now: 5500 }, { type: 'tap', tile: 8, now: 6000 })
    expect(s).toMatchObject({ phase: 'feedback', lastOk: false, mistakes: 1, wrongTile: 8, inputIndex: 1 })
    expect(nextLength(s)).toBe(4)

    s = play(s, { type: 'next', sequence: [1, 2, 3, 4] }, { type: 'shown', now: 9000 }, { type: 'tap', tile: 0, now: 9500 })
    expect(s.mistakes).toBe(2)
    s = play(s, { type: 'next', sequence: [5, 6, 7, 8] })
    expect(s.phase).toBe('done')
    expect(s).toMatchObject({ longest: 3, attempts: 3, successes: 1 })
  })

  it('ignores taps outside input and events in the wrong phase', () => {
    const s = initRun([0, 1, 2])
    expect(runReducer(s, { type: 'tap', tile: 0, now: 1 })).toBe(s)
    expect(runReducer(s, { type: 'next', sequence: [1] })).toBe(s)
    const shown = runReducer(s, { type: 'shown', now: 0 })
    expect(runReducer(shown, { type: 'shown', now: 5 })).toBe(shown)
  })

  it('caps the gap between taps at 5 s', () => {
    let s = play(initRun([0, 1, 2]), { type: 'shown', now: 0 })
    s = play(s, { type: 'tap', tile: 0, now: 600000 }, { type: 'tap', tile: 1, now: 600400 })
    expect(s.tapMs).toEqual([5000, 400])
  })
})

describe('scoreRun / runResult', () => {
  it('scores steps past the start length the same at every level', () => {
    for (const level of [1, 20]) {
      const start = startLength(level)
      expect(scoreRun(0, level)).toBe(0)
      expect(scoreRun(start, level)).toBe(27)
      expect(scoreRun(start + 1, level)).toBe(53)
      expect(scoreRun(start + 2, level)).toBe(80)
      expect(scoreRun(start + 3, level)).toBe(100)
      expect(scoreRun(start + 9, level)).toBe(100)
    }
  })

  it('reports accuracy, average tap time and the summary stats', () => {
    let s = play(initRun([0, 1, 2]), { type: 'shown', now: 0 }, ...tapAll([0, 1, 2], 0))
    s = play(s, { type: 'next', sequence: [0, 1, 2, 3] }, { type: 'shown', now: 0 }, { type: 'tap', tile: 5, now: 1000 })
    expect(runResult(s, 1)).toEqual({
      score: 27,
      accuracy: 0.5,
      avgResponseMs: 625,
      stats: [
        { label: 'Longest', value: '3' },
        { label: 'Target', value: '5' },
      ],
    })
  })
})
```

- [ ] **Step 2: Run the tests to check they fail**

Run: `npx vitest run src/games/sequence-recall`
Expected: FAIL, because the modules aren't found.

- [ ] **Step 3: Implement**

`src/games/sequence-recall/levels.ts`:
```ts
// Sequence Recall difficulty per level (spec §5.3). All values [tunable].
export const LEAD_IN_MS = 600
export const MAX_MISTAKES = 2
export const TAP_GAP_CAP_MS = 5000
export const SUCCESS_PAUSE_MS = 400
export const MISTAKE_PAUSE_MS = 1000
/** Successes past the start length needed to reach the target. */
export const TARGET_STEPS = 2
export const REPEATS_FROM_LEVEL = 8

const clampLevel = (level: number) => Math.min(20, Math.max(1, Math.round(level)))
const lerp = (a: number, b: number, level: number) => Math.round(a + ((clampLevel(level) - 1) * (b - a)) / 19)

export const gridSize = (level: number) => (clampLevel(level) <= 6 ? 3 : clampLevel(level) <= 13 ? 4 : 5)
export const startLength = (level: number) => 3 + Math.floor((clampLevel(level) - 1) / 3)
export const targetLength = (level: number) => startLength(level) + TARGET_STEPS
export const flashMs = (level: number) => lerp(700, 350, level)
export const gapMs = (level: number) => lerp(250, 150, level)
export const allowRepeats = (level: number) => clampLevel(level) >= REPEATS_FROM_LEVEL
```

`src/games/sequence-recall/run.ts`:
```ts
import type { RunResult } from '@/games/types'
import type { Rng } from '@/lib/rng'
import { allowRepeats, gridSize, MAX_MISTAKES, startLength, TAP_GAP_CAP_MS, TARGET_STEPS, targetLength } from './levels'

/** Tiles lit in order. No tile twice in a row; no repeats at all below L8 while the grid has room. */
export function generateSequence(length: number, level: number, rng: Rng): number[] {
  const cells = gridSize(level) ** 2
  const unique = !allowRepeats(level) && length <= cells
  const seq: number[] = []
  while (seq.length < length) {
    const tile = rng.int(0, cells - 1)
    if (tile === seq[seq.length - 1]) continue
    if (unique && seq.includes(tile)) continue
    seq.push(tile)
  }
  return seq
}

export type RunPhase = 'show' | 'input' | 'feedback' | 'done'

export type RunState = {
  phase: RunPhase
  sequence: readonly number[]
  inputIndex: number
  mistakes: number
  longest: number
  attempts: number
  successes: number
  /** Gaps between taps (first tap measured from the end of the show), capped. */
  tapMs: readonly number[]
  lastTapAt: number
  /** Outcome of the attempt just finished; null while one is in progress. */
  lastOk: boolean | null
  wrongTile: number | null
}

/** Every event carries what it needs, so the reducer stays pure. */
export type RunEvent =
  | { type: 'shown'; now: number }
  | { type: 'tap'; tile: number; now: number }
  | { type: 'next'; sequence: number[] }

export function initRun(sequence: number[]): RunState {
  return {
    phase: 'show',
    sequence,
    inputIndex: 0,
    mistakes: 0,
    longest: 0,
    attempts: 0,
    successes: 0,
    tapMs: [],
    lastTapAt: 0,
    lastOk: null,
    wrongTile: null,
  }
}

export function runReducer(state: RunState, event: RunEvent): RunState {
  switch (event.type) {
    case 'shown':
      if (state.phase !== 'show') return state
      return { ...state, phase: 'input', lastTapAt: event.now }

    case 'tap': {
      if (state.phase !== 'input') return state
      const gap = Math.min(TAP_GAP_CAP_MS, Math.max(0, event.now - state.lastTapAt))
      const base = { ...state, tapMs: [...state.tapMs, gap], lastTapAt: event.now }
      if (event.tile !== state.sequence[state.inputIndex]) {
        return {
          ...base,
          phase: 'feedback',
          mistakes: state.mistakes + 1,
          attempts: state.attempts + 1,
          lastOk: false,
          wrongTile: event.tile,
        }
      }
      const inputIndex = state.inputIndex + 1
      if (inputIndex < state.sequence.length) return { ...base, inputIndex }
      return {
        ...base,
        inputIndex,
        phase: 'feedback',
        attempts: state.attempts + 1,
        successes: state.successes + 1,
        longest: Math.max(state.longest, state.sequence.length),
        lastOk: true,
      }
    }

    case 'next':
      if (state.phase !== 'feedback') return state
      if (state.mistakes >= MAX_MISTAKES) return { ...state, phase: 'done' }
      return { ...state, phase: 'show', sequence: event.sequence, inputIndex: 0, lastOk: null, wrongTile: null }
  }
}

/** Length of the next attempt: one longer after a success, the same after a mistake. */
export const nextLength = (state: RunState) => state.sequence.length + (state.lastOk ? 1 : 0)

/** 80 at the target (level up), the same at every level. */
export function scoreRun(longest: number, level: number): number {
  const steps = longest >= startLength(level) ? longest - startLength(level) + 1 : 0
  return Math.min(100, Math.round((80 * steps) / (TARGET_STEPS + 1)))
}

export function runResult(state: RunState, level: number): RunResult {
  const avg = state.tapMs.length ? state.tapMs.reduce((s, x) => s + x, 0) / state.tapMs.length : 0
  return {
    score: scoreRun(state.longest, level),
    accuracy: state.attempts ? state.successes / state.attempts : 0,
    avgResponseMs: Math.round(avg),
    stats: [
      { label: 'Longest', value: String(state.longest) },
      { label: 'Target', value: String(targetLength(level)) },
    ],
  }
}
```
(Check the expected `avgResponseMs` in the runResult test: the taps were at 500/1000/1500 from 0, giving gaps of 500, 500 and 500. Then the next show ended at 0 and a tap came at 1000, giving 1000. The mean is 2500 / 4 = 625. This matches.)

- [ ] **Step 4: Run all checks and commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.
```bash
git add src/games/sequence-recall
git commit -m "Add Sequence Recall run reducer, sequence generator and scoring

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: RunRound wrapper and the RoundScreen run branch

**Files:**
- Create: `src/round/RunRound.tsx`, `src/round/RunRound.test.tsx`
- Modify: `src/round/RoundScreen.tsx`

**Interfaces:**
- Consumes: `RunGameModule`, `RunResult` (Task 1); `useSaveRound`, `isPersonalBest`, `nextLevel`, `RoundSummary` (Task 1); `createRng`
- Produces: `RunRound` props `{ gameModule: RunGameModule; gameName: string; level: number; prevBest: number | null; seed: number; store: ProgressStore; onQuit(): void; onPlayAgain(): void; onDone(): void }`

- [ ] **Step 1: Write the failing test**

`src/round/RunRound.test.tsx`:
```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createProgressStore, type PendingRound, type SendResult } from '@/data/progress'
import type { RunGameModule, RunViewProps } from '@/games/types'
import { RunRound } from './RunRound'

function FakeRun({ level, onFinish, onQuit }: RunViewProps) {
  return (
    <>
      <p>running at {level}</p>
      <button
        onClick={() =>
          onFinish({ score: 80, accuracy: 0.75, avgResponseMs: 612.4, stats: [{ label: 'Longest', value: '5' }] })
        }
      >
        finish
      </button>
      <button onClick={onQuit}>quit</button>
    </>
  )
}

const fakeModule: RunGameModule = { kind: 'run', id: 'sequence-recall', readyHint: 'x', RunView: FakeRun }

function setup() {
  const send = vi.fn(async (_r: PendingRound): Promise<SendResult> => ({ ok: true }))
  const store = createProgressStore({ storage: null, key: 't', send, fetchServer: async () => [] })
  const onQuit = vi.fn()
  render(
    <RunRound
      gameModule={fakeModule}
      gameName="Sequence Recall"
      level={3}
      prevBest={70}
      seed={1}
      store={store}
      onQuit={onQuit}
      onPlayAgain={vi.fn()}
      onDone={vi.fn()}
    />,
  )
  return { send, store, onQuit }
}

describe('RunRound', () => {
  it('hosts the run, then shows the summary with its stats and saves once', async () => {
    const { send, store } = setup()
    expect(screen.getByText('running at 3')).toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByText('finish')))
    expect(screen.getByLabelText('Score 80 out of 100')).toBeInTheDocument()
    expect(screen.getByText('Longest')).toBeInTheDocument()
    expect(screen.getByText('3 → 4')).toBeInTheDocument()
    expect(screen.getByText('New personal best')).toBeInTheDocument()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![0]).toMatchObject({
      gameId: 'sequence-recall',
      level: 3,
      newLevel: 4,
      score: 80,
      accuracy: 0.75,
      avgResponseMs: 612,
    })
    expect(store.getGame('sequence-recall').level).toBe(4)
  })

  it('saves nothing when quit', () => {
    const { send, onQuit } = setup()
    fireEvent.click(screen.getByText('quit'))
    expect(onQuit).toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to check it fails**

Run: `npx vitest run src/round/RunRound.test.tsx`
Expected: FAIL, because `./RunRound` isn't found.

- [ ] **Step 3: Implement**

`src/round/RunRound.tsx`:
```tsx
import { useMemo, useState } from 'react'
import type { ProgressStore } from '@/data/progress'
import type { RunGameModule, RunResult } from '@/games/types'
import { createRng } from '@/lib/rng'
import { RoundSummary } from './RoundSummary'
import styles from './RoundScreen.module.css'
import { isPersonalBest, nextLevel } from './scoring'
import { useSaveRound } from './useSaveRound'

type Props = {
  gameModule: RunGameModule
  gameName: string
  level: number
  prevBest: number | null
  seed: number
  store: ProgressStore
  onQuit(): void
  onPlayAgain(): void
  onDone(): void
}

/** Hosts a run-format game, then shows the shared summary and saves the result once. */
export function RunRound(props: Props) {
  const { gameModule, level, store } = props
  const [rng] = useState(() => createRng(props.seed))
  const [result, setResult] = useState<RunResult | null>(null)
  const newLevel = result ? nextLevel(level, result.score) : level

  const input = useMemo(
    () =>
      result
        ? {
            gameId: gameModule.id,
            level,
            newLevel,
            score: result.score,
            accuracy: result.accuracy,
            avgResponseMs: Math.round(result.avgResponseMs),
          }
        : null,
    [result], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const saveStatus = useSaveRound(store, input)

  if (result) {
    return (
      <RoundSummary
        gameName={props.gameName}
        score={result.score}
        stats={result.stats}
        level={level}
        newLevel={newLevel}
        isPersonalBest={isPersonalBest(props.prevBest, result.score)}
        saveStatus={saveStatus}
        onPlayAgain={props.onPlayAgain}
        onDone={props.onDone}
      />
    )
  }

  const RunView = gameModule.RunView
  return (
    <div className={styles.run}>
      <RunView level={level} rng={rng} onFinish={(r) => setResult((prev) => prev ?? r)} onQuit={props.onQuit} />
    </div>
  )
}
```

`src/round/RoundScreen.tsx`:
- Remove the `kind !== 'items'` redirect added in Task 1.
- Change `Run` to `{ id: number; level: number; prevBest: number | null; seed: number; items: readonly unknown[] }`.
- `start()` becomes:
```tsx
  function start() {
    const seed = Date.now()
    setRun((prev) => ({
      id: (prev?.id ?? 0) + 1,
      level: progress.level,
      prevBest: progress.bestScore,
      seed,
      items: gameModule.kind === 'items' ? gameModule.generate(progress.level, createRng(seed)) : [],
    }))
  }
```
- Replace the `<RoundRun … />` element in the `run ? … : …` branch with:
```tsx
        gameModule.kind === 'run' ? (
          <RunRound
            key={run.id}
            gameModule={gameModule}
            gameName={game.name}
            level={run.level}
            prevBest={run.prevBest}
            seed={run.seed}
            store={store}
            onQuit={toLibrary}
            onPlayAgain={start}
            onDone={toLibrary}
          />
        ) : (
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
        )
```
  (and `import { RunRound } from './RunRound'`).
- Hint: `{gameModule.readyHint ?? (gameModule.kind === 'items' ? \`${gameModule.itemsPerRound} questions, each against the clock.\` : '')}`. Run modules always have a `readyHint`, so the fallback branch only satisfies the types.

- [ ] **Step 4: Run all checks and commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.
```bash
git add src/round
git commit -m "Add RunRound host for run-format games

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Sequence Recall view, module and registry, then deploy

**Files:**
- Create: `src/games/sequence-recall/SequenceRecallView.tsx`, `src/games/sequence-recall/SequenceRecallView.module.css`, `src/games/sequence-recall/index.ts`, `src/games/sequence-recall/view.test.tsx`
- Modify: `src/games/registry.ts`
- Test: `src/round/RoundScreen.test.tsx` (add a Sequence Recall run)

**Interfaces:**
- Consumes: Task 10 (`initRun`, `runReducer`, `generateSequence`, `nextLength`, `runResult`, level helpers); `RunViewProps`, `RunGameModule` (Task 1)
- Produces: `sequenceRecall: RunGameModule`, registered as `'sequence-recall'`

- [ ] **Step 1: Write the failing tests**

`src/games/sequence-recall/view.test.tsx`:
```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { getGameModule } from '@/games/registry'
import { createRng } from '@/lib/rng'
import { sequenceRecall } from './index'
import { SequenceRecallView } from './SequenceRecallView'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const tiles = () => screen.getAllByRole('button', { name: /^Tile / })

/** Advances through the show, recording the order tiles light up. */
function watch(): number[] {
  const seen: number[] = []
  for (let t = 0; t < 20000 && !screen.queryByText('Your turn'); t += 25) {
    act(() => vi.advanceTimersByTime(25))
    const lit = tiles().findIndex((el) => el.dataset.state === 'lit')
    if (lit >= 0 && seen[seen.length - 1] !== lit) seen.push(lit)
  }
  return seen
}

const tap = (i: number) => fireEvent.click(tiles()[i]!)

describe('sequenceRecall module', () => {
  it('is a registered run game with a hint', () => {
    expect(sequenceRecall.kind).toBe('run')
    expect(sequenceRecall.readyHint).toMatch(/Two mistakes/)
    expect(getGameModule('sequence-recall')).toBe(sequenceRecall)
  })
})

describe('SequenceRecallView', () => {
  it('shows a 3 × 3 grid at L1, plays the sequence, then takes taps', () => {
    const onFinish = vi.fn()
    render(<SequenceRecallView level={1} rng={createRng(5)} onFinish={onFinish} onQuit={vi.fn()} />)
    expect(tiles()).toHaveLength(9)
    expect(screen.getByText('Watch…')).toBeInTheDocument()
    expect(tiles()[0]).toBeDisabled()
    const seq = watch()
    expect(seq).toHaveLength(3)
    expect(tiles()[0]).toBeEnabled()
    seq.forEach(tap)
    expect(tiles().every((t) => t.dataset.state === 'right')).toBe(true)
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByText('Watch…')).toBeInTheDocument()
    expect(watch()).toHaveLength(4)
  })

  it('finishes after two mistakes and reports the result once', () => {
    const onFinish = vi.fn()
    render(<SequenceRecallView level={1} rng={createRng(5)} onFinish={onFinish} onQuit={vi.fn()} />)
    for (let miss = 0; miss < 2; miss++) {
      const seq = watch()
      tap((seq[0]! + 1) % 9)
      expect(screen.getByLabelText(`${1 - miss} mistakes left`)).toBeInTheDocument()
      expect(tiles()[seq[0]!]!.dataset.state).toBe('answer')
      act(() => vi.advanceTimersByTime(1000))
    }
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 0, accuracy: 0 })
  })

  it('leaves no timers running after quitting mid-show', () => {
    const onQuit = vi.fn()
    const { unmount } = render(<SequenceRecallView level={1} rng={createRng(5)} onFinish={vi.fn()} onQuit={onQuit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Quit round' }))
    expect(onQuit).toHaveBeenCalled()
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
```

Add to `src/round/RoundScreen.test.tsx`. Test files must not import each other, so these helpers are duplicated at the top of the file:
```tsx
const tiles = () => screen.getAllByRole('button', { name: /^Tile / })
const tapTile = (i: number) => fireEvent.click(tiles()[i]!)
function watch(): number[] {
  const seen: number[] = []
  for (let t = 0; t < 20000 && !screen.queryByText('Your turn'); t += 25) {
    act(() => vi.advanceTimersByTime(25))
    const lit = tiles().findIndex((el) => el.dataset.state === 'lit')
    if (lit >= 0 && seen[seen.length - 1] !== lit) seen.push(lit)
  }
  return seen
}
```
and, inside the `describe`:
```tsx
  it('plays a Sequence Recall run to the target and levels up', async () => {
    const { send } = renderRound('/play/sequence-recall')
    expect(screen.getByText(/Two mistakes ends the run/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    for (let attempt = 0; attempt < 3; attempt++) {
      watch().forEach(tapTile)
      act(() => vi.advanceTimersByTime(400))
    }
    for (let miss = 0; miss < 2; miss++) {
      const seq = watch()
      tapTile((seq[0]! + 1) % 9)
      act(() => vi.advanceTimersByTime(1000))
    }
    expect(screen.getByLabelText('Score 80 out of 100')).toBeInTheDocument()
    expect(screen.getByText('1 → 2')).toBeInTheDocument()
    await flushPromises()
    expect(send.mock.calls[0]![0]).toMatchObject({ gameId: 'sequence-recall', score: 80, newLevel: 2 })
  })
```
(After 3 successes, at lengths 3, 4 and 5, the length is 6 and the grid is still 3 × 3, so `(seq[0] + 1) % 9` is a valid wrong tile.)

- [ ] **Step 2: Run the tests to check they fail**

Run: `npx vitest run src/games/sequence-recall src/round/RoundScreen.test.tsx`
Expected: FAIL, because the view and module aren't found, and `/play/sequence-recall` redirects.

- [ ] **Step 3: Implement**

`src/games/sequence-recall/SequenceRecallView.tsx`:
```tsx
import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import styles from '@/round/RoundScreen.module.css'
import type { RunViewProps } from '@/games/types'
import {
  flashMs,
  gapMs,
  gridSize,
  LEAD_IN_MS,
  MAX_MISTAKES,
  MISTAKE_PAUSE_MS,
  startLength,
  SUCCESS_PAUSE_MS,
} from './levels'
import { generateSequence, initRun, nextLength, runReducer, runResult } from './run'
import view from './SequenceRecallView.module.css'

const TAP_FLASH_MS = 150

type TileState = 'idle' | 'lit' | 'right' | 'wrong' | 'answer'

export function SequenceRecallView({ level, rng, onFinish, onQuit }: RunViewProps) {
  const size = gridSize(level)
  const [state, dispatch] = useReducer(runReducer, undefined, () =>
    initRun(generateSequence(startLength(level), level, rng)),
  )
  const [lit, setLit] = useState<number | null>(null)
  const [pressed, setPressed] = useState<number | null>(null)
  const finished = useRef(false)

  // Play the sequence. A new attempt always brings a new sequence array, so this reruns per attempt.
  useEffect(() => {
    if (state.phase !== 'show') return
    const timers: ReturnType<typeof setTimeout>[] = []
    const step = flashMs(level) + gapMs(level)
    state.sequence.forEach((tile, i) => {
      const on = LEAD_IN_MS + i * step
      timers.push(setTimeout(() => setLit(tile), on))
      timers.push(setTimeout(() => setLit(null), on + flashMs(level)))
    })
    const end = LEAD_IN_MS + state.sequence.length * step
    timers.push(setTimeout(() => dispatch({ type: 'shown', now: Date.now() }), end))
    return () => {
      timers.forEach(clearTimeout)
      setLit(null)
    }
  }, [state.phase, state.sequence, level])

  // Pause on feedback, then the next attempt (or the end).
  useEffect(() => {
    if (state.phase !== 'feedback') return
    const pause = state.lastOk ? SUCCESS_PAUSE_MS : MISTAKE_PAUSE_MS
    const t = setTimeout(
      () => dispatch({ type: 'next', sequence: generateSequence(nextLength(state), level, rng) }),
      pause,
    )
    return () => clearTimeout(t)
  }, [state.phase, state.attempts]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.phase !== 'done' || finished.current) return
    finished.current = true
    onFinish(runResult(state, level))
  }, [state.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Brief light on the tapped tile.
  useEffect(() => {
    if (pressed === null) return
    const t = setTimeout(() => setPressed(null), TAP_FLASH_MS)
    return () => clearTimeout(t)
  }, [pressed])

  function tap(tile: number) {
    if (state.phase !== 'input') return
    setPressed(tile)
    dispatch({ type: 'tap', tile, now: Date.now() })
  }

  function tileState(i: number): TileState {
    if (state.phase === 'show') return lit === i ? 'lit' : 'idle'
    if (state.phase === 'feedback') {
      if (state.lastOk) return 'right'
      if (i === state.wrongTile) return 'wrong'
      if (i === state.sequence[state.inputIndex]) return 'answer'
      return 'idle'
    }
    return pressed === i ? 'lit' : 'idle'
  }

  const left = Math.max(0, MAX_MISTAKES - state.mistakes)

  return (
    <>
      <div className={styles.top}>
        <button className={styles.quit} onClick={onQuit} aria-label="Quit round">
          ✕
        </button>
        <div className={view.status}>
          <span>{state.phase === 'show' ? 'Watch…' : state.phase === 'input' ? 'Your turn' : ' '}</span>
          <span className={view.lives} aria-label={`${left} mistakes left`}>
            {'●'.repeat(left)}
            {'○'.repeat(MAX_MISTAKES - left)}
          </span>
        </div>
      </div>
      <div className={view.stage}>
        <div className={view.grid} style={{ '--size': size } as CSSProperties}>
          {Array.from({ length: size * size }, (_, i) => (
            <button
              key={i}
              type="button"
              className={view.tile}
              data-state={tileState(i)}
              disabled={state.phase !== 'input'}
              aria-label={`Tile ${i + 1}`}
              onClick={() => tap(i)}
            />
          ))}
        </div>
      </div>
    </>
  )
}
```

`src/games/sequence-recall/SequenceRecallView.module.css`:
```css
.status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.lives {
  color: var(--track);
  letter-spacing: 0.2em;
}

.stage {
  flex: 1;
  display: grid;
  place-items: center;
}

.grid {
  width: min(100%, 26rem);
  aspect-ratio: 1;
  display: grid;
  grid-template-columns: repeat(var(--size), 1fr);
  gap: clamp(8px, 2.5vw, 12px);
}

.tile {
  border: 0;
  border-radius: var(--radius-md);
  background: var(--surface);
  touch-action: manipulation;
  transition: background 120ms var(--ease-out);
}

.tile:disabled {
  cursor: default;
}

.tile[data-state='lit'] {
  background: var(--track);
}

.tile[data-state='right'] {
  background: var(--correct);
}

.tile[data-state='wrong'] {
  background: var(--incorrect);
}

.tile[data-state='answer'] {
  box-shadow: inset 0 0 0 4px var(--correct);
}

@media (prefers-reduced-motion: reduce) {
  .tile {
    transition: none;
  }
}
```

`src/games/sequence-recall/index.ts`:
```ts
import type { RunGameModule } from '@/games/types'
import { SequenceRecallView } from './SequenceRecallView'

export const sequenceRecall: RunGameModule = {
  kind: 'run',
  id: 'sequence-recall',
  readyHint: 'Watch the tiles light up, then tap them in the same order. Two mistakes ends the run.',
  RunView: SequenceRecallView,
}
```

`src/games/registry.ts`: add `'sequence-recall': sequenceRecall,`.

Implementation notes for the engineer:
- In `view.test.tsx`, the "leaves no timers" test checks `vi.getTimerCount()` after unmount. The show effect's cleanup clears all of its timers, which is what makes this pass.
- `state.sequence` is a new array for every attempt, so the show effect reruns even when two attempts happen to have equal contents.
- "Play again" remounts `RunRound` (and so the view) through `key={run.id}` in `RoundScreen`, which gives a fresh run with a new seed.

- [ ] **Step 4: Run all checks**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 5: Look at it**

Run `npm run dev`. Play `/play/sequence-recall` at 390 px. Check that tiles light clearly in the memory (amber) track colour, that taps feel instant, that a mistake shows red plus the green-outlined correct tile, and that the summary shows Longest, Target and Level. Report what you saw, or that you couldn't check.

- [ ] **Step 6: Commit and deploy**

```bash
git add src/games/sequence-recall src/games/registry.ts src/round/RoundScreen.test.tsx
git commit -m "Add Sequence Recall game

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git checkout main && git merge --ff-only scaffold && git push origin main scaffold && git checkout scaffold
```

---

### Task 13: Update the progress doc

**Files:**
- Modify: `docs/PROGRESS.md`

- [ ] **Step 1: Update the doc**

- Set `_Last updated:` to today.
- In the Status table, set step 3 to "✅ Done, live: **owner phone check pending**", and step 4 to "⏭ Next".
- Add a "## Step 3 — what was built" section, a short paragraph in the same style as step 2's:
  - The 4 games and their folders
  - `ChoiceGrid` and `makeChoices`
  - `kind: 'items' | 'run'` modules, `RunRound` and `useSaveRound`
  - The spec and plan paths
- Replace "To do next session" with:
  1. The step 2 phone check (still pending), plus a step 3 phone check: play each new game once, check the summary and that a `rounds` row appears, and note any numbers that feel off for tuning.
  2. Step 4: brainstorm, then spec, plan and build.
- Add to "Known small items" any deferred review findings from this step's reviews.

- [ ] **Step 2: Commit and deploy**

```bash
git add docs/PROGRESS.md
git commit -m "Update progress: step 3 done

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git checkout main && git merge --ff-only scaffold && git push origin main scaffold && git checkout scaffold
```
