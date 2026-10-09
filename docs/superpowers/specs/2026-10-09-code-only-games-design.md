# BRIAN — Step 3: Code-only games

## Context
Build step 3 of `brian-handoff.md`: the remaining code-only games, **Money Maths**, **Table Reasoning**, **Rule Switch** and **Sequence Recall**, on top of the step 2 round shell. No content bank is involved.

Decisions made in brainstorming (2026-10-09):

| Topic | Decision |
|---|---|
| Money Maths / Table Reasoning answers | Multiple choice, 4 options, distractors built from real mistakes |
| Rule Switch | The rule cue is always visible and changes with no warning (task switching, not hidden-rule) |
| Rule Switch round length | 20 cards |
| Table Reasoning visuals | Tables only; charts deferred to polish (step 9) |
| Sequence Recall | Its own run loop; reuses the scoring, level change, summary and saving code |
| Build order | Money Maths → Table Reasoning → Rule Switch → Sequence Recall, each deployable on its own |

The owner will tune the numbers by playing, so every level parameter below is a **[tunable]** constant kept in that game's `levels.ts`.

Out of scope: charts, the workout picker (step 4), content games (steps 5–7), and stats (step 8).

## 1. Shared pieces

### 1.1 `ChoiceGrid` — `src/components/ChoiceGrid.tsx`
- Props: `{ options: readonly string[], onChoose(index: number): void, feedback: ItemFeedback | null, chosen: number | null, correctIndex: number }`.
- A 2 × 2 grid of large buttons, each at least 56 px tall. Long labels (such as product names) wrap.
- Keys 1–4 choose an option on desktop. Repeated keydown events (`e.repeat`) are ignored.
- During feedback, input is disabled. A correct choice turns green. A wrong choice turns red and the correct option is outlined green.

### 1.2 `makeChoices` — `src/games/choices.ts`
- `makeChoices(correct: number, distractors: number[], rng, opts: { format(n): string, nudge(n, rng): number })` returns `{ options: string[4], correctIndex }`.
- Options are compared **after formatting**, so `$12.50` and `$12.5` count as the same. Duplicates of the correct answer or of each other are dropped.
- If fewer than 3 distinct distractors remain, `nudge` fills the gap with nearby plausible values, for example ±5–15% rounded the same way. It never returns a negative value or the correct value.
- The 4 options are then shuffled with `rng`.
- A string variant, `makeLabelChoices(correct: string, others: string[], rng)`, handles pick-the-row and pick-the-product questions.

### 1.3 Multiple-choice item shape
Both math games use the same item and answer types:
```ts
type ChoiceItem = { prompt: string; options: string[]; correctIndex: number }
// Answer = the chosen index
check = (item, index) => index === item.correctIndex
answerLabel = (item) => item.options[item.correctIndex]
```
Table Reasoning extends this with a `table` field (§3).

### 1.4 Money format — `src/lib/money.ts`
- `formatAud(n)`: `$1,234.50`. It shows 2 decimal places when the amount has cents, and whole dollars (`$80`) otherwise. Within one item every option uses the same style: if any option has cents, all show 2 dp.
- `roundCents(n)` rounds half away from zero to the cent. All money maths goes through it at each displayed step, so the "correct" answer matches what a person working it out by hand would get.

### 1.5 Ready-screen hint
`GameModule` gains an optional `readyHint?: string`. `RoundScreen` shows it in place of the default "`N` questions, each against the clock."

### 1.6 Shared saving — `useSaveRound`
The "save exactly once when finished" logic moves from `RoundRun` into a hook, `src/round/useSaveRound.ts`: `useSaveRound(store, input | null) → SaveStatus | 'saving'`. `RoundRun` and the Sequence Recall run screen both use it. This is a refactor only, and it must not change Speed Arithmetic's behaviour.

### 1.7 Summary stats
`RoundSummary` takes `stats: { label: string; value: string }[]` in place of the fixed accuracy and average time fields. `RoundRun` passes Accuracy and Avg time as before. Sequence Recall passes Longest and Target (§5).

## 2. Money Maths — `src/games/money-maths/`
- 10 items per round. Each one is a short word problem with 4 money options (or 4 product labels for unit price).
- `generate` picks a problem type from the level's pool, then numbers from the level's ranges. There are no duplicate prompts within a round.

### 2.1 Problem types

| Type | Example prompt | Correct | Distractors |
|---|---|---|---|
| `discount` | "A $80 jacket is 25% off. What do you pay?" | p × (1 − d) | p × (1 + d); p × d; p − d (treats % as $) |
| `addGst` | "$120 before GST. Price including 10% GST?" | p × 1.1 | p × 1.2; p; p × 0.1 (the GST alone) |
| `removeGst` | "$110 including GST. Price before GST?" | p ÷ 1.1 | p × 0.9; p − 10; p × 1.1 |
| `split` | "A $186 bill split 4 ways, plus a 10% tip. Each pays?" | p × (1 + t) ÷ n | p ÷ n (no tip); p × (1 + t) ÷ (n − 1); p ÷ n + t × p |
| `unitPrice` | "500 g for $4.20 or 750 g for $5.90. Which is better value?" | the cheapest per unit | the other products. 3 products at L5–9, 4 at L10+; the cheapest beats the next by at least 2% per unit |
| `markup` | "Cost $40, marked up 35%. Sale price?" | c × (1 + m) | c × m; c ÷ (1 − m); c + m |
| `stackedDiscount` | "$250, 20% off, then a further 10% off. Final price?" | p × (1 − a)(1 − b) | p × (1 − a − b); p × (1 − a); p × (1 − b) |
| `discountThenGst` | "$90 ex GST, 15% off, then add GST. Total?" | p × (1 − d) × 1.1 | p × (1 + 0.1 − d) (adds the percentages); p × (1 − d) (forgot GST); p × 1.1 |

The two-step types compute and round each step to the cent, in order.

### 2.2 Level table

| Levels | Pool | Prices | Percentages |
|---|---|---|---|
| 1–4 | discount, addGst, split (no tip) | multiples of $10, $20–$200 | 10, 20, 25, 50 |
| 5–9 | + removeGst, markup, unitPrice | whole dollars $10–$500 at 5–6, then prices with cents | + 5, 15, 30, 40 |
| 10–14 | + split with tip, discountThenGst | cents, $5–$999 | + 12.5, 17.5, 35 |
| 15–20 | + stackedDiscount; two-step types weighted ×2 | cents, $5–$2,500 | any whole % 5–60, plus 12.5 and 17.5 |

- `removeGst` prices are chosen so that p ÷ 1.1 lands on a whole cent at L5–9 (start from the ex-GST price and multiply up). At L10+ they need not.
- Split group sizes: 2–4 at L1–9, then 3–8.
- `timeLimitMs(level) = round(40000 − (level − 1) × 20000 / 19)`, so 40 s at L1 and 20 s at L20.
- `targetTimeMs(level) = round(0.5 × timeLimitMs(level))`.

### 2.3 View
The prompt sits in large text at the top, with the `ChoiceGrid` below.

## 3. Table Reasoning — `src/games/table-reasoning/`
- 10 items per round. Item: `ChoiceItem & { table: { title: string; unit: '$' | 'units' | 'hours'; columns: string[]; rows: { label: string; values: number[] }[] } }`.
- Themes provide the title, row labels, column labels and unit: store sales by month ($), supplier prices by product ($), units sold by product by quarter (units), and staff hours by week (hours). Labels are short, such as "Store A" or "Jan".

### 3.1 Question types

| Type | Example | Distractors |
|---|---|---|
| `difference` | "How many more units did B sell than D in Mar?" | the wrong column; the wrong row; the sum of the two cells |
| `total` | "Total sales for Store C across all months?" | total minus one cell (×2 different cells); the column total |
| `average` | "Average price of Product X across suppliers?" | the sum; the sum ÷ (n − 1); the median |
| `pctChange` | "% change for Store A from Jan to Apr (nearest whole %)?" | ÷ new instead of ÷ old; the sign flipped; the absolute difference shown as a % |
| `share` | "What % of Mar sales came from B (nearest whole %)?" | ÷ the row total; ÷ the grand total; the next row's share |
| `ratio` | "Ratio of A's to C's Feb sales (simplest form)?" | flipped; ratio with a wrong cell; unsimplified when that differs |
| `pickRow` | "Which store had the largest % increase from Jan to Apr?" | the largest absolute increase (made to differ on purpose); other rows |
| `avgPctChange` (L13+) | "Average % change across all stores, Jan to Feb (1 dp)?" | % change of the averages; the largest single change; ÷ new |

- The question states the rounding (nearest whole %, 1 dp, or simplest ratio), and options use exactly that rounding.
- Values for `ratio` are chosen so the simplest form has terms of 12 or less.
- For `pickRow`, the generator rerolls until the largest % change and the largest absolute change are different rows.

### 3.2 Level table

| Levels | Size (rows × cols) | Pool | Values |
|---|---|---|---|
| 1–5 | 3 × 2 to 4 × 3 | difference, total | multiples of 10, 10–200 |
| 6–12 | 4 × 3 to 5 × 4 | + average, pctChange, share, ratio | multiples of 5 at 6–8, then any whole number 10–999 |
| 13–20 | 5 × 4 to 6 × 4 | + pickRow, avgPctChange; two-step types weighted ×2 | any whole number 10–9,999 |

- `timeLimitMs(level) = round(60000 − (level − 1) × 30000 / 19)`, so 60 s at L1 and 30 s at L20.
- `targetTimeMs(level) = round(0.5 × timeLimitMs(level))`.

### 3.3 View
The table title and table sit at the top, at 14–15 px with tabular numerals, and the header row and first column are emphasised. The question comes next, then the `ChoiceGrid`. At 390 px wide a 6 × 4 table plus the grid must fit without horizontal scrolling. If the full screen doesn't fit vertically, the table and question scroll, and the `ChoiceGrid` stays pinned at the bottom.

## 4. Rule Switch — `src/games/rule-switch/`
- 20 items per round. `readyHint`: "Sort each card by the rule shown. The rule can change at any time."
- Attributes:
  - **colour:** blue (left) or orange (right). Both are colour-blind-safe and distinct from the track colours.
  - **shape:** circle (left) or square (right).
  - **fill** (L14+): solid (left) or outline (right).
- Item: `{ rule: 'colour' | 'shape' | 'fill', card: { colour, shape, fill }, correct: 'left' | 'right' }`. Answer: `'left' | 'right'`. `answerLabel`: for example "Right — shape".

### 4.1 Generation
- Card 1 picks a random rule from the level's rules. Each later card switches to a different rule with probability `switchP(level)`.
- Each round has at least 2 switches. If fewer occur, the generator forces switches at random positions from card 4 onward.
- **Conflict cards** (where the rule's side differs from at least one other attribute's side) make up at least 60% of the round, and every card straight after a switch is a conflict card.
- At L1–13 fill is always solid and isn't a rule. From L14 it varies and can be the rule.

### 4.2 Level table
- `switchP(level) = 1/6 + (level − 1) × (1/2 − 1/6) / 19`, so about 17% at L1 and 50% at L20.
- `timeLimitMs(level) = round(3000 − (level − 1) × 2000 / 19)`, so 3 s at L1 and 1 s at L20.
- `targetTimeMs(level) = round(0.5 × timeLimitMs(level))`.

### 4.3 View
- At the top is the cue: a large label (`COLOUR` / `SHAPE` / `FILL`) in the track colour. It changes in place with no transition.
- In the middle is the card, drawn as an SVG shape.
- At the bottom are two large buttons, each about half the screen wide. Each shows what goes there under the current rule ("Blue" / "Orange", ● / ■, "Solid" / "Outline").
- The ← and → keys answer on desktop, and `e.repeat` is ignored.
- The 20-segment progress strip must fit at 320 px wide. If needed, segments shrink to a minimum 6 px width with 2 px gaps.

## 5. Sequence Recall — `src/games/sequence-recall/`

### 5.1 Module contract
`GameModule` becomes a union with a discriminant:
```ts
type ItemGameModule<Item, Answer> = { kind: 'items' } & /* existing fields */
type RunGameModule = {
  kind: 'run'
  id: GameId
  readyHint: string
  RunView: ComponentType<RunViewProps>
}
type RunViewProps = {
  level: number
  rng: Rng
  onFinish(result: RunResult): void
  onQuit(): void
}
type RunResult = { score: number; accuracy: number; avgResponseMs: number; stats: { label: string; value: string }[] }
```
- `speedArithmetic` gains `kind: 'items'`.
- `RoundScreen` renders `RoundRun` for `'items'`, and `RunRound` for `'run'`. `RunRound` is a new wrapper that hosts the `RunView`, then shows `RoundSummary` using `nextLevel` and `useSaveRound`.

### 5.2 Run engine — `src/games/sequence-recall/run.ts` (pure reducer)
- **State:** `{ phase: 'show' | 'input' | 'feedback' | 'done', length, sequence: number[], inputIndex, mistakes, longest, attempts, successes, tapMs: number[], lastTapAt }`.
- **Events:** `shown(now)`, `tap(tile, now)`, `next(sequence)` (a fresh sequence comes from the caller, so the reducer stays deterministic).
- **Flow:**
  - `show` plays the sequence, then `shown` moves to `input`.
  - Each correct tap advances. Completing the sequence counts a success, sets `longest = max(longest, length)`, and moves to `feedback`. `next` then brings a **fresh** sequence at `length + 1`.
  - A wrong tap counts a mistake and moves to `feedback`, showing the correct next tile. After that, a fresh sequence comes at the **same** length. The 2nd mistake goes to `done`.
- There is no timer on input, because this tests memory, not speed. `tapMs` records the gap between taps for `avgResponseMs`, and gaps are capped at 5 s so leaving the app doesn't skew the average.
- The sequence is shown to the player in full on every attempt (no Simon-style appending).

### 5.3 Level table
- **Grid:** 3 × 3 at L1–6, 4 × 4 at L7–13, 5 × 5 at L14–20.
- **Start length:** `3 + floor((level − 1) / 3)`, so 3 at L1 and 9 at L20.
- **Target:** start length + 2.
- **Display:** each tile lights for `700 − (level − 1) × 350 / 19` ms (700 ms at L1, 350 ms at L20), with a gap of `250 − (level − 1) × 100 / 19` ms (250 down to 150 ms). There's a 600 ms pause before the first tile.
- **Repeats:** from L8 a tile may appear more than once, but never twice in a row. Below L8 there are no repeats.

### 5.4 Scoring
- Steps reached: `s = longest − start + 1` (0 if no sequence was completed).
- `score = min(100, round(80 × s / 3))`. This works the same at every level: reaching the target (`s = 3`) scores 80, which moves the level up. One short of it scores 53 (holds). Only completing the start length scores 27, and never completing it scores 0, which both move the level down. Going one past the target scores 100.
- `accuracy = successes / attempts`.
- `avgResponseMs` = the mean of the capped tap gaps (0 if there were no taps).
- Summary stats: "Longest: N" and "Target: T".
- `nextLevel` and the save path are the same as for other games.

### 5.5 View
- A square grid of tiles sized to fit the screen width, with gaps of at least 8 px. During `show`, tiles light in the track colour. During `input`, a tap lights the tile briefly.
- Feedback: a completed sequence flashes the grid green for 400 ms. A mistake flashes the tapped tile red and the correct tile green for 1000 ms.
- A status line shows "Watch…" / "Your turn" and the mistakes left (●● / ●○).
- The quit ✕ returns to `/play` without saving, the same as other games.
- `prefers-reduced-motion` swaps flashes for plain colour changes.

## 6. Testing
- **`makeChoices`:** always 4 distinct formatted options with the correct one included; nudging fills in collisions; it's deterministic per seed.
- **`formatAud` / `roundCents`:** cents vs whole dollars, consistent style within an item, thousands separators, and half-cent rounding.
- **Per-game generators** (for every level 1–20 × 200 seeds):
  - The item fits the level's pool, sizes and ranges.
  - The correct option recomputes from the item's own numbers.
  - There are 4 distinct options (Money Maths and Table Reasoning).
  - There are no duplicate prompts.
  - Rule Switch has ≥ 2 switches, ≥ 60% conflict cards, and conflict cards after every switch.
  - Sequence Recall respects the repeat rules.
- **Hand-checked cases:** remove GST from $110 gives $100.00 (with $99.00 as a distractor); stacked 20% then 10% off $250 gives $180.00 (with $175.00 as a distractor); and `pickRow` traps always differ.
- **Sequence Recall:** the run reducer covers growth on success, same length after a mistake, done after 2 mistakes, `longest` tracking and tap-gap capping. The score formula is checked at s = 0, 1, 2, 3 and 4, at both L1 and L20.
- **Components:** `ChoiceGrid` (tap, 1–4 keys, repeat ignored, feedback states); the Rule Switch view (arrow keys, labels follow the rule); and `RoundScreen` playing a full Money Maths round and a full Sequence Recall run with fake timers and a mocked store.
- **Regression:** the existing Speed Arithmetic and `RoundScreen` tests still pass after the `useSaveRound` and `RoundSummary` refactor.

## 7. Delivery and verification
- Build in the order Money Maths → Table Reasoning → Rule Switch → Sequence Recall. After each game, run `npm run typecheck && npm run lint && npm test`, then fast-forward `main` so the owner can try it on the phone.
- No database changes: `game_id` is free text, and `record_round` already accepts any game.
- On the phone, for each game: play a round, check the summary and level change, check the `rounds` row in Supabase, and check the layout at the phone's width.
