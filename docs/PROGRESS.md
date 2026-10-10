# BRIAN — Build progress

Where the build is up to, against the 9-step order in `brian-handoff.md` §9. Update this at the end of each session.

_Last updated: 2026-10-10_

## Status

| Step | What | State |
|---|---|---|
| 1 | Scaffold: Vite/React/TS, PWA, Supabase auth + RLS schema, routing, theme | ✅ Done, live |
| 2 | Round shell + Speed Arithmetic (proof game) | ✅ Done, live — **owner phone check pending** (below) |
| 3 | Other code-only games: Money Maths, Table Reasoning, Sequence Recall, Rule Switch | ✅ Done, live — **owner phone check pending** (below) |
| 4 | Daily workout picker, home screen, streaks + freezes | ⏭ Next |
| 5 | Content pipeline (Zod schemas, seed/import/brief scripts, unseen tracking, low-pool banner) | Not started |
| 6 | Content games: Synonym Sprint, Sentence Fix, Detail Recall | Not started |
| 7 | Word Bank (SRS) | Not started |
| 8 | Stats: skill scores, snapshots, trend charts, history, weekly summary | Not started |
| 9 | Polish: animations, PWA install/offline, desktop pass | Not started |

## Where things live

- **Live app:** https://brian-azure.vercel.app (Vercel Hobby; every push to `main` deploys).
- **Repo:** github.com/Miranty1/BRIAN. Work happens on `scaffold`, fast-forwarded into `main` to deploy. Both are at the same commit.
- **Supabase:** hosted free-tier project `wiauxtxyuutapztwhjdi`, linked with the CLI. There's no local DB or Docker. See the README for the commands.
- **Sign-in:** an email code plus a magic link (the code exists so the installed iPhone app can sign itself in). Emails go through the owner's Gmail SMTP (app password), with a custom Magic Link template that shows `{{ .Token }}`.
- **Specs and plans:** `docs/superpowers/specs/` (designs) and `docs/superpowers/plans/` (task-by-task plans).

## Step 2 — what was built

Pure round engine (`src/round/engine.ts`) + scoring (`src/round/scoring.ts`). Games plug in via `GameModule` (`src/games/types.ts`) and a registry (`src/games/registry.ts`). Speed Arithmetic is in `src/games/speed-arithmetic/`, and the shared `NumberPad` is in `src/components/`. Round UI is `src/round/RoundScreen.tsx`, `RoundRun.tsx` and `RoundSummary.tsx`, at route `/play/:gameId`. Progress is kept in an offline-first store with a localStorage outbox (`src/data/progress.ts`) and synced through the idempotent Postgres function `record_round` (migration `20261009000000_record_round.sql`).

Decisions: a hard per-item timer; a wrong answer shows the correct answer for about 1 s; leaving mid-round saves nothing; offline rounds are saved on the device and synced later; the number pad auto-submits at the answer's digit count.

## Step 3 — what was built

Four games on top of the round shell, each in `src/games/<game>/` (levels, generator, view, module):
- **Money Maths** and **Table Reasoning** are multiple choice. They share `ChoiceGrid` (`src/components/`), `makeChoices`/`makeLabelChoices` (`src/games/choices.ts`) and `formatAud`/`roundCents` (`src/lib/money.ts`). Wrong options are built from real mistakes, such as ×0.9 instead of ÷1.1 for GST, or the largest raw change instead of the largest % change.
- **Rule Switch** is a 20-card round with the cue always shown. FILL is added as a rule from L14.
- **Sequence Recall** is a run-format game. Modules are now `kind: 'items' | 'run'`. A run module brings its own pure reducer (`run.ts`) and view, and `src/round/RunRound.tsx` hosts it and then shows the shared summary. Saving is shared through `src/round/useSaveRound.ts`.

Every generator is tested at all 20 levels × 200 seeds, and each correct answer is checked again independently. Spec: `docs/superpowers/specs/2026-10-09-code-only-games-design.md`. Plan: `docs/superpowers/plans/2026-10-09-code-only-games.md`. All level numbers are `[tunable]` constants in each game's `levels.ts`.

## To do next session

1. **Owner phone checks** (not yet done). Step 2:
   - Reopen the installed app (twice if Play still says "Coming soon"), play a round, and check the summary says "Saved". Check that `rounds` and `game_progress` rows appear in Supabase.
   - Background the app mid-question for about 30 s; the average time should stay at or under the limit.
   - In flight mode, finish a round and see "Saved on this phone…". Reconnect and reopen the app; the round should sync.
   Step 3:
   - Play each new game once, and check that the summary appears and a `rounds` row lands in Supabase.
   - Play a **Table Reasoning round at a high level** (L17+) with the Safari toolbar showing. The answer buttons should stay pinned while the table scrolls. This layout was never checked in a browser.
   - Rule Switch at small widths: does the 20-segment strip fit, and is the cue easy to see?
   - Note any level numbers that feel too easy or too hard, for tuning.
2. **Then start step 4** (daily workout picker, home screen, streaks + freezes): brainstorm, then spec, plan and build.

## Known small items (deferred, non-blocking)

These come from the step 2 code reviews and were judged fine to leave for now:
- `AbortSignal.timeout` (the sync's 10 s timeout) needs iOS 16+. On older iOS, rounds stay queued on the device until a feature-detect fallback is added.
- No tests yet for "Play again" or StrictMode in `RoundScreen`.
- Number pad: holding a key auto-repeats on a desktop keyboard (`e.repeat` isn't ignored).
- The faded "Coming soon" rows on Play (opacity 0.55) may fall below AA contrast.
- A few extra edge-case tests are missing in the engine, generator and progress store.
- Step 3 (from reviews):
  - Money Maths: "best value" questions all share one prompt, so a round has at most one. A tipped bill split divides the unrounded total (at most 1c off).
  - Table Reasoning: a few prompts read stiffly ("How much higher was price for…"). On landscape or very short screens the table's scroll area gets small.
  - Accessibility polish: right and wrong answers are shown by colour only (plus an outline). Sequence Recall's status has no live region, and the table's corner header is blank.
  - `formatAud` doesn't handle negative amounts nicely (money is never negative today).
