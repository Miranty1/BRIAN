# BRIAN — Build Handoff

A personal brain-training PWA inspired by Elevate. Scoping is finished; every decision below is settled unless it's marked **[tunable]**, which means a sensible default that's fine to adjust during build. The next session should start building.

---

## 1. Product summary

- **What:** a daily brain trainer for a single user. Short adaptive mini-games across four skill tracks, plus streaks and progress tracking.
- **Who:** the owner only. No monetisation, no onboarding funnel, no social features or leaderboards.
- **Platform:** mobile-first installable PWA that also works on a laptop.
- **Cost:** must run at **$0**. No paid APIs. Supabase free tier and Vercel Hobby only.
- **Locale:** Australian English throughout: AU spelling, metric units, AUD, 10% GST.

## 2. Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite (TypeScript) |
| Backend / DB / Auth | Supabase (Postgres, Auth, RLS) |
| Hosting | Vercel |
| PWA | `vite-plugin-pwa` (manifest, service worker, offline shell) |
| Validation | Zod schemas shared by the app and the content scripts |
| Charts | Any lightweight React chart lib (e.g. Recharts) |

**Auth:** one account, magic link or Google. Every user table has RLS policies of the form `user_id = auth.uid()`.

## 3. Core loop

### Daily workout
- **3 games, about 5 minutes.**
- **Slot 1 is always Word Bank.** Exception: if no Word Bank reviews are due *and* today's new-word cap is used up, the slot goes to another game.
- **Slots 2–3 are auto-picked.** Weighting favours (a) tracks with the lowest skill score and (b) games played least recently. Avoid repeating a game in the same workout, and prefer two different tracks.
- Finishing all 3 games counts as the day's training (see Streaks).

### Free play
- A library of all 9 games, always available. It doesn't count toward the streak.

### Round shell (shared by every game except Word Bank)
- **About 10 items per round.** Sequence Recall uses a run format (see its spec).
- **Level 1–20 per game.** The level controls concrete parameters: time per item, operand size, sequence length, word rarity, and so on.
- **Score 0–100** per round, from accuracy and speed. **[tunable]** Starting formula: `score = round(70 * accuracy + 30 * speedFactor)`, where `speedFactor = clamp(targetTimeForLevel / avgResponseTime, 0, 1)`.
- **Level change after each round [tunable]:** score ≥ 80 moves up 1; score ≤ 50 moves down 1; otherwise the level holds. Clamp to 1–20.
- **Feedback:** snappy correct and incorrect animations, then an end-of-round summary showing the score, any level change, and the personal best if beaten.

## 4. The 9 games

Track colours are used throughout the UI (see Design).

### Math (3 games, all generated in code with no content bank)
1. **Speed Arithmetic.** Rapid +, −, ×, ÷ problems.
   - At L1: single-digit + and −, generous time.
   - At L20: multi-digit × and ÷ (clean division only), mixed operations, tight time.
   - Built from scratch. Don't reuse MILO.
2. **Money Maths.** Real-world AUD problems: % discounts, adding or removing 10% GST, splitting bills, comparing unit prices, markups.
   - Low levels use round numbers and single steps.
   - High levels use awkward percentages, stacked discounts and multi-step problems.
3. **Table Reasoning.** A small randomly generated data table or chart (sales, prices, quantities), with a question that needs a calculation (% change, ratio, difference, average). Grad numerical-test style.
   - Higher levels bring larger tables, multi-step questions and less time.

### Verbal (3 games, content bank)
4. **Synonym Sprint.** Pick the word closest in meaning from 4 options. Word rarity band scales with level.
5. **Sentence Fix.** A sentence containing one error (grammar, punctuation, wordiness, AU spelling, word misuse).
   - Phone interaction: tap the faulty segment, then choose the fix from the options.
   - Error subtlety scales with level.
6. **Word Bank.** Vocabulary *expansion* using spaced repetition, so it teaches new words rather than testing known ones.
   - **New words:** about 3 per round, each with a definition, an example sentence, and a short etymology or usage note. **[tunable]** Daily new-word cap: 6.
   - **Reviews:** words that are due, up to about 10 per round, in varied formats: pick the meaning, choose the right word for a sentence (cloze), spot the misuse.
   - **SRS [tunable]:** a simplified SM-2 or fixed ladder (1 → 3 → 7 → 14 → 30 → 60 days). A correct answer advances one step; a miss resets to 1 day. A word counts as **mastered** once its interval reaches 30 days or more.
   - **No timer, no level ladder.** Round score is the % of reviews answered correctly. New words are introduced roughly in order of rarity band.

### Memory (2 games)
7. **Sequence Recall** (code). A grid of tiles lights up in sequence; repeat it back.
   - A run starts at a length set by level, and each success adds 1.
   - The run ends after 2 mistakes. Score is the longest length reached relative to the level's target.
   - Grid size and display speed scale with level.
8. **Detail Recall** (content bank). Study a short scenario (receipt, itinerary, message, notice) for a limited time, then answer questions from memory.
   - About 3 scenarios × 3–4 questions per round.
   - Higher levels bring shorter study time and denser detail.

### Focus (1 game, code)
9. **Rule Switch.** Cards vary by colour and shape. Sort each one left or right by the current rule (shown as a cue), which flips without warning.
   - Higher levels bring more frequent switches, less time per card, and possibly a third attribute.

**Parked (not v1):** Odd One Out, a reading comprehension game, push reminders.

## 5. Progress tracking

- **Streak calendar:**
  - A day counts if the full 3-game workout was completed, using local-timezone days.
  - **Freezes:** earn 1 per 7 days trained. A freeze is used automatically to cover a single missed day. **[tunable]** Holding cap: 2.
  - Show the current streak, longest streak and freezes held.
- **Skill scores (0–1000) per track:** Math, Verbal, Memory, Focus.
  - Based mainly on current levels, so the score only rises when you can genuinely handle harder material.
  - **[tunable]** Per game: `850 * (level-1)/19 + 150 * (avg of last 5 round scores / 100)`. The track score is the mean of its games.
  - **Word Bank component:** `1000 * min(mastered / 500, 1)`, averaged in with the other Verbal games.
  - Snapshot each track once per day (on first workout completion, or lazily on app open) for the **trend charts**.
- **Per-game history and personal bests:** current level, best score, recent rounds and a level-over-time sparkline.
- **Weekly summary:** shown on the first open of a new week. Covers days trained, strongest and weakest track, biggest skill gain, words mastered this week, and new personal bests. Compute it from existing data, either client-side or with a SQL view.

## 6. Content pipeline ($0, no API keys in the app)

- **Content games:** Synonym Sprint, Sentence Fix, Word Bank, Detail Recall. The math games, Sequence Recall and Rule Switch are pure code.
- **Seed:**
  - Generate a large initial bank using Claude Code (the owner's subscription), aiming for about 1,000+ items per content game.
  - Spread items across difficulty or rarity bands so every level has material.
  - Save as JSON in `content/seed/<game>.json`.
- **Validation:** a Zod schema per game. A script validates every item, dedupes it (normalised word or sentence), and rejects malformed items before upload.
- **Upload:** a local Node script using the Supabase **service role key from a local `.env` that is never committed**. Inserts go into `content_items`.
- **Unseen tracking:** record which items the user has seen. Serve unseen items first; recycle only once a band is exhausted.
- **Low-pool warning:** when a game's unseen pool drops below about 50 items (per band or overall), show a banner in the app.
- **Refill:** the owner runs a refill workflow.
  - Command: `npm run content:brief -- --game <id> --band <n> --count 200`.
  - It writes a generation brief: schema, examples, band definition, and existing words to avoid.
  - The owner generates the items with Claude Code or a local Ollama model, then runs `npm run content:import <file>`, which validates, dedupes and uploads.
- No LLM calls at runtime. No paid APIs anywhere.

### Item shapes (starting point; finalise as Zod schemas)
- **Synonym Sprint:** `{ word, band, correct, distractors[3] }`
- **Sentence Fix:** `{ sentence, segments[], errorSegmentIndex, errorType, options[], correctOptionIndex, explanation, band }`
- **Word Bank:** `{ word, partOfSpeech, definition, example, note, band, distractorDefinitions[3], clozeSentences[], misuseSentence, misuseExplanation }`
- **Detail Recall:** `{ type, title, body, band, questions: [{ prompt, options[], correctIndex }] }`

## 7. Data model (draft)

- `content_items`: id, game_id, band, payload `jsonb`, source (`seed`, `claude-code` or `ollama`), created_at. Readable by authenticated users; written only via the service role.
- `item_seen`: user_id, item_id, seen_at
- `game_progress`: user_id, game_id, level, best_score, rounds_played, last_played_at
- `rounds`: id, user_id, game_id, level, score, accuracy, avg_response_ms, workout_id (nullable), played_at
- `workouts`: id, user_id, local_date, game_ids[], completed_at
- `streak_freezes`: id, user_id, earned_at, used_on (nullable)
- `skill_snapshots`: user_id, track, local_date, score (unique per user + track + date)
- `vocab_cards`: user_id, item_id, step or interval_days, due_on, reps, lapses, status (`new`, `learning` or `mastered`), last_reviewed_at

Game definitions (id, track, name, colour, level-parameter tables) live **in code**, not the DB.

## 8. Design

- **Clean and calm**, with **one bold colour per track** (Math, Verbal, Memory, Focus) so you always know which track you're in.
- **Dark mode by default**, with a light mode available.
- **Snappy micro-animations** on correct and incorrect answers and level-ups. Polished, but not childish or bouncy.
- **Mobile-first:** large tap targets and on-screen number pads (no OS keyboard for numeric answers). Fully usable on desktop, where keyboard input for answers is a nice-to-have.
- **Home screen:**
  - A "Today's workout" card with 3 game tiles and progress.
  - A streak strip.
  - Skill score tiles for the 4 tracks.
  - Free-play library entry.
  - A low-content banner when needed.
- **Other screens:** Stats (trend charts, calendar, per-game history), the weekly summary, and Settings (theme, account).
- **Look:** take Elevate's level of polish without copying its look.

## 9. Suggested build order

1. Scaffold: Vite + React + TS, PWA plugin, Supabase client, auth, RLS'd schema and migrations, routing, theme tokens and track colours.
2. Round shell: shared game framework covering item loop, timer, scoring, level adjust, round summary, and writing to `rounds` and `game_progress`.
3. Code-only games first: Speed Arithmetic, Money Maths, Table Reasoning, Sequence Recall, Rule Switch. These prove the shell.
4. Daily workout picker and home screen, plus streaks and freezes.
5. Content pipeline: Zod schemas, seed, import and brief scripts, unseen tracking, low-pool banner.
6. Content games: Synonym Sprint, Sentence Fix, Detail Recall.
7. Word Bank: SRS, new-word cap, review formats, mastery tracking.
8. Stats: skill scores and snapshots, trend charts, per-game history and personal bests, weekly summary.
9. Polish: animations, PWA install and offline shell, a pass on desktop layout.

Generate the seed content in parallel once the schemas from step 5 are fixed.

## 10. Constraints and non-goals

- $0 to run. No paid APIs, no runtime LLM calls, no API keys shipped to the client.
- Single user. No social features, leaderboards, subscriptions or onboarding funnel.
- No push notifications in v1.
- No speaking or microphone games.
- Nothing reused from MILO.

## 11. Suggested skills

- **frontend-design** or **impeccable**: track colour system, dark-first theme, game-screen layouts.
- **emil-design-eng**: feedback micro-animations and the feel of the game interactions.
- **grill-me**: only if a significant ambiguity comes up mid-build (e.g. the exact Rule Switch mechanics). Otherwise the decisions above stand.
- **handoff**: at the end of each build session, to carry progress forward.
