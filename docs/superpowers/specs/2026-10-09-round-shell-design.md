# BRIAN — Step 2: Round shell + Speed Arithmetic

## Context
Build step 2 of `brian-handoff.md`: the shared round framework every item-based game runs on. It covers the item loop, the per-item timer, scoring, level change, the round summary, and saving to `rounds` and `game_progress`. To prove the shell end to end, this step also ships **Speed Arithmetic**, the simplest code-only game. The other code-only games remain step 3.

Decisions made in brainstorming (2026-10-09):

| Topic | Decision |
|---|---|
| Proof game | Speed Arithmetic ships in this step |
| Architecture | Pure round engine + game plug-ins + one shared round screen |
| Timer | Hard per-item limit; running out counts as wrong |
| Wrong answer | Red shake, correct answer shown ~1 s, then next |
| Leaving mid-round | Discard; nothing saved, level unchanged |
| Offline finish | Save on device (outbox), sync later |
| Number pad | Auto-submit once typed digits = answer's digit count |

Out of scope: the other 8 games, Sequence Recall's run format (step 3 adapts the engine), the workout picker and streaks (step 4; `workout_id` stays null), and stats screens (step 8).

## 1. Units

```
/play/:gameId ─► RoundScreen ─► round engine (pure) ─► scoring
                      ▲                ▲
                      │           GameModule (speed-arithmetic)
                      ▼
                progress store ─► outbox (localStorage) ─► rpc record_round
```

### 1.1 Round engine — `src/round/engine.ts`
A pure reducer with no React, no DOM and no clock. Every event carries `now` (ms).

- **State:** `{ phase: 'ready' | 'item' | 'feedback' | 'done', items, index, itemStartedAt, results: ItemResult[], lastResult? }`
- **`ItemResult`:** `{ correct: boolean, timedOut: boolean, responseMs: number }`
- **Events:**
  - `start(now)`: `ready → item` for index 0; sets `itemStartedAt`.
  - `answer(correct, now)`: valid only in `item`. Records the result with `responseMs = now - itemStartedAt`, then `→ feedback`.
  - `timeout(now)`: valid only in `item`. Records `{ correct: false, timedOut: true, responseMs: now - itemStartedAt }` (≈ the limit, since the screen fires it when the limit expires), then `→ feedback`.
  - `next(now)`: valid only in `feedback`. Goes to the next `item` (resetting `itemStartedAt`), or to `done` after the last item.
- Events in the wrong phase are ignored (state returned unchanged).
- Correctness is decided by the caller using `GameModule.check`, so the engine stays item-type agnostic.

### 1.2 Scoring — `src/round/scoring.ts`
- `accuracy = correctCount / itemCount`
- `avgResponseMs` = mean `responseMs` over all items; timeouts are included at their elapsed time (≈ the full limit).
- `speedFactor = clamp(targetTimeMs / avgResponseMs, 0, 1)`
- `score = round(70 * accuracy + 30 * speedFactor)`
- `nextLevel(level, score)`: score ≥ 80 → +1; score ≤ 50 → −1; otherwise unchanged; clamped to 1–20.
- All thresholds are named constants (the handoff marks them [tunable]).

### 1.3 Game plug-in contract — `src/games/types.ts`
```ts
interface GameModule<Item, Answer> {
  id: GameId
  itemsPerRound: number                 // 10 for Speed Arithmetic
  generate(level: number, rng: Rng): Item[]
  timeLimitMs(level: number): number
  targetTimeMs(level: number): number
  check(item: Item, answer: Answer): boolean
  answerLabel(item: Item): string       // shown after a wrong answer
  ItemView: ComponentType<ItemViewProps<Item, Answer>>
}
interface ItemViewProps<Item, Answer> {
  item: Item
  onAnswer(answer: Answer): void
  feedback: null | { correct: boolean; answerLabel: string }
}
```
- `Rng` (`src/lib/rng.ts`): a seeded PRNG (mulberry32) with `int(min, max)` and `pick(array)`. The app seeds from `Date.now()`; tests use fixed seeds.
- Registry `src/games/registry.ts`: `GAME_MODULES: Partial<Record<GameId, GameModule>>`.

### 1.4 Round screen — `src/round/RoundScreen.tsx`, route `/play/:gameId`
- An unknown or unbuilt game redirects to `/play`.
- **Ready:** game name, track colour, current level, **Start** button.
- **Item:** a quit ✕ (returns to `/play`, nothing saved), a 10-segment progress strip, and a timer bar in the track colour draining over `timeLimitMs`. When it hits zero it dispatches `timeout`.
- **Feedback:** correct → green pulse, `next` after **250 ms**. Wrong or timeout → red shake and the `answerLabel` shown, `next` after **1000 ms**. With `prefers-reduced-motion`, the shake becomes a colour change.
- **Done:** `RoundSummary` shows the score (0–100), accuracy %, average time (s, one decimal), the level change ("Level 4 → 5" / "Level holds at 4" / "Level 5 → 4"), "New personal best" when beaten, the save status, and **Play again** / **Done**.
- The timer uses `performance.now()` with `requestAnimationFrame` for the bar, and a `setTimeout` for the timeout event.

### 1.5 Number pad — `src/components/NumberPad.tsx`
- Digits 0–9 and backspace in a 3 × 4 grid, each key at least 56 px tall. No minus or decimal point.
- Props: `{ answerLength: number, onSubmit(value: string), disabled }`. It submits automatically when `value.length === answerLength`, then clears.
- Physical keyboard: digits and Backspace while mounted and enabled.

## 2. Speed Arithmetic — `src/games/speed-arithmetic/`
- Item: `{ a: number, b: number, op: '+' | '−' | '×' | '÷', answer: number }`, displayed as `a op b`. Answers are whole numbers ≥ 0.
- Each item picks an operation uniformly from the level's pool, then operands from that operation's ranges:
  - `−`: draw two numbers from the range and order them so `a ≥ b`.
  - `÷`: draw divisor `d` and quotient `q`, then `a = d·q`, `b = d`.
- No duplicate `(a, op, b)` within a round; regenerate on collision.

| Level | + / − operands | × operands | ÷ (divisor, quotient) |
|---|---|---|---|
| 1 | 1–9, 1–9 | — | — |
| 2 | 1–20, 1–9 | — | — |
| 3 | 10–99, 1–9 | — | — |
| 4 | 10–99, 1–9 | 2–5, 1–9 | — |
| 5 | 10–99, 1–9 | 2–9, 2–9 | — |
| 6 | 10–99, 1–9 | 2–9, 2–9 | 2–9, 2–9 |
| 7 | 10–99, 10–99 | 2–9, 2–9 | 2–9, 2–9 |
| 8–9 | 10–99, 10–99 | 2–12, 2–12 | 2–12, 2–12 |
| 10–11 | 10–99, 10–99 | 11–29, 2–9 | 2–9, 11–25 |
| 12–13 | 10–99, 10–99 | 11–49, 2–9 | 2–9, 11–49 |
| 14–16 | 100–999, 100–999 | 11–99, 2–9 | 2–9, 11–49 |
| 17–20 | 100–999, 100–999 | 11–25, 11–25 | 2–9, quotient chosen so the dividend is 100–999 |

- `timeLimitMs(level) = round(10000 − (level − 1) × 5000 / 19)`, so 10 s at L1 and 5 s at L20.
- `targetTimeMs(level) = round(0.4 × timeLimitMs(level))`.
- `answerLabel = String(answer)`. `check(item, typed) = Number(typed) === item.answer`.
- The ItemView shows the problem large, the typed digits below it, and the NumberPad with `answerLength = String(answer).length`.
- All numbers above are [tunable] constants in one level table.

## 3. Saving and sync

### 3.1 Progress store — `src/data/progress.ts`
- `localStorage` key `brian.progress.v1.<userId>`: `{ games: Record<GameId, GameProgress>, outbox: PendingRound[] }`.
- `GameProgress`: `{ level, bestScore | null, roundsPlayed, lastPlayedAt | null }`. A game with no entry defaults to level 1.
- `PendingRound`: `{ id (crypto.randomUUID()), gameId, level, newLevel, score, accuracy, avgResponseMs, playedAt (ISO) }`.
- `recordRound(result)`: updates `games[gameId]` immediately (level = newLevel, best = max, roundsPlayed + 1, lastPlayedAt), appends to the outbox, then calls `flush()`. Returns whether the round is pending or synced.
- `flush()`: sends outbox entries in order through the RPC. On success it removes the entry. On a network or fetch error it stops and keeps the rest. On a Postgres error it logs, drops that entry and continues. Concurrent calls share one in-flight run.
- Flush triggers: after `recordRound`, on sign-in or app load, and on the window `online` event.
- `pullServerProgress()`: on app load, reads `game_progress` and merges per game, keeping whichever record has the later `lastPlayedAt`.
- Storage failures fall back to an in-memory store with the same API.
- A `useGameProgress(gameId)` hook exposes the current progress to screens.

### 3.2 Database — new migration `…_record_round.sql`
- No schema changes: `rounds.id` is already the primary key, and the client supplies it.
- `public.record_round(p_id uuid, p_game_id text, p_level smallint, p_new_level smallint, p_score smallint, p_accuracy real, p_avg_response_ms integer, p_played_at timestamptz) returns boolean`
  - `language plpgsql security invoker`, with `set search_path = ''`.
  - Inserts into `public.rounds (id, game_id, level, score, accuracy, avg_response_ms, played_at)` with `on conflict (id) do nothing`. If nothing was inserted, it returns `false` (a duplicate).
  - Otherwise it upserts `game_progress` for `(auth.uid(), p_game_id)`: `rounds_played + 1`, `best_score = greatest(...)`. `level` and `last_played_at` are set only when `p_played_at >= coalesce(last_played_at, '-infinity')`. Returns `true`.
  - `grant execute` to `authenticated` only; revoke from `public` and `anon`.
- RLS still governs every row it touches, because it runs as the caller.

## 4. Other UI changes
- **Play:** a game with a module is a link showing "Level N"; the others show "Coming soon" and aren't tappable.
- **Home:** unchanged.

## 5. Testing
- **Unit (Vitest):**
  - `rng`: deterministic sequences for a seed.
  - `scoring`: formula values, clamping, level thresholds at exactly 50, 51, 79 and 80, and the 1/20 bounds.
  - `engine`: phase order, wrong-phase events ignored, timeout result, done after the last item.
  - `speed-arithmetic`: for every level 1–20 × 200 seeds, every item fits the level's pool and ranges, the answer is correct and ≥ 0, division is exact, there are no duplicates, and there are `itemsPerRound` items. Also the time-limit endpoints.
  - `NumberPad`: auto-submit at length, backspace, keyboard input.
  - `progress`: optimistic update, outbox kept on network error, dropped on a Postgres error, merge keeps the newer record, in-memory fallback.
- **Component:** `RoundScreen` plays a full round with fake timers and a mocked progress store. It covers correct, wrong and timeout paths, the summary contents, and that quitting saves nothing.
- **Database (`npm run db:test`, new `record_round.test.sql`):** inserts a round and updates progress; a resend is a no-op; an older `played_at` doesn't change the level but still counts toward the best and the play count; another user's progress is untouched; `anon` can't execute it.

## 6. Verification
1. `npm run typecheck && npm run lint && npm test` and `npm run db:push && npm run db:test` all pass.
2. Deploy via `main`. On the phone: play a round, check the summary and that the level changed; check the `rounds` and `game_progress` rows in Supabase.
3. Turn on flight mode, finish a round and see "Saved on this phone…"; reconnect and confirm the row appears and the outbox empties.
