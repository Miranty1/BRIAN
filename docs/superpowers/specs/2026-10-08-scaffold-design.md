# BRIAN — Step 1: Scaffold

## Context
`brian-handoff.md` describes a fully scoped personal brain-training PWA (React + Vite + TS, Supabase, Vercel, $0). The repo is empty apart from that file. The user chose to build in slices, and this plan covers **only build step 1**: the scaffold, auth, the full RLS'd schema, routing, and theme tokens with track colours. The outcome is an installable, deployable shell that you can sign into, with placeholder screens. Later steps (the round shell, games and so on) get their own spec and plan.

Decisions made in brainstorming:
- Auth: **Supabase magic link** only.
- DB: **Supabase CLI with a local Docker stack**; migrations in `supabase/migrations`, pushed with `supabase db push`.
- Styling: **CSS custom properties + CSS Modules** with a `data-theme` attribute for dark (default) and light.
- Schema: **all 8 tables from handoff §7 in one initial migration**, with RLS.
- Defaults (not asked): npm, React Router, Vitest + React Testing Library, pgTAP via `supabase test db`.

## Deliverables

### 0. Spec doc
Write `docs/superpowers/specs/2026-10-08-scaffold-design.md`, summarising this plan, and commit it.

### 1. Project scaffold
- `npm create vite@latest` (react-ts) at the repo root. Strict TS and path alias `@/` → `src/`.
- Deps: `react-router-dom`, `@supabase/supabase-js`, `zod`. Dev deps: `vite-plugin-pwa`, `vitest`, `@testing-library/react`, `jsdom`, `eslint`, `prettier`.
- Scripts: `dev`, `build`, `preview`, `test`, `lint`, `typecheck`, `db:start` (`supabase start`), `db:reset`, `db:test` (`supabase test db`), `db:types` (generate `src/lib/database.types.ts`).
- `.gitignore` includes `.env`, `.env.local`, `node_modules`, `dist`, and `supabase/.temp`.
- `.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (plus a commented `SUPABASE_SERVICE_ROLE_KEY` for the later content scripts, never prefixed with `VITE_`).

### 2. PWA
- `vite-plugin-pwa` in `vite.config.ts`: `registerType: 'autoUpdate'`, manifest (name "BRIAN", `display: standalone`, dark `theme_color`/`background_color`, `lang: en-AU`), and 192/512/maskable icons in `public/`. Generate simple placeholder icons.
- Workbox precaches the app shell, with a navigate fallback to `index.html`.

### 3. Supabase
- `supabase init`; migration `supabase/migrations/<ts>_initial_schema.sql` creates the tables from handoff §7:
  - `content_items` (id uuid, game_id text, band int, payload jsonb, source text check in ('seed','claude-code','ollama'), created_at). RLS: `select` for `authenticated`; no insert/update/delete policies (service role bypasses RLS).
  - `item_seen`, `game_progress` (pk user_id+game_id), `rounds`, `workouts` (unique user_id+local_date), `streak_freezes`, `skill_snapshots` (unique user_id+track+local_date, track check in math/verbal/memory/focus), `vocab_cards` (pk user_id+item_id, status check). Each has `user_id uuid not null default auth.uid() references auth.users on delete cascade`, RLS enabled, and a single `for all` policy `using (user_id = auth.uid()) with check (user_id = auth.uid())`.
  - Indexes on `(user_id, game_id, played_at desc)` for rounds, `(user_id, due_on)` for vocab_cards, `(game_id, band)` for content_items, and `(user_id, item_id)` for item_seen.
- `supabase/tests/rls.test.sql` (pgTAP): two users; user A cannot read or write user B's rows in each user table; authenticated users can read `content_items` but cannot insert into it.
- `supabase/config.toml`: email auth enabled, site URL and redirect URLs for `http://localhost:5173` (the Vercel URL gets added at deploy).
- `src/lib/database.types.ts` generated from the local DB.

### 4. App structure
```
src/
  main.tsx, App.tsx            router + providers
  lib/supabase.ts              typed client from env (Zod-validated env)
  lib/env.ts                   zod parse of import.meta.env
  auth/AuthProvider.tsx        session context (getSession + onAuthStateChange)
  auth/RequireAuth.tsx         redirects to /login when signed out
  routes/Login.tsx             email field → signInWithOtp, "check your email" state
  routes/Home.tsx, Play.tsx (free-play library), Stats.tsx, Settings.tsx   placeholders
  components/AppShell.tsx      layout + bottom nav (mobile) / side nav (≥ 768px)
  theme/tokens.css             spacing, radii, type scale, motion durations, colours
  theme/ThemeProvider.tsx      data-theme on <html>, persisted to localStorage (try/catch), default dark
  games/tracks.ts              Track type + TRACKS map {id, name, colour var}
```
- Routes: `/login` (public), and `/`, `/play`, `/stats`, `/settings` behind `RequireAuth`. Settings has a theme toggle and sign-out.
- Tracks: Math, Verbal, Memory, Focus, each with a `--track-<id>` colour and a `-soft` variant tuned for both themes. One bold hue per track, calm neutral surfaces. Use the frontend-design skill when picking the palette.
- Large tap targets (min 44px) and AU English copy.

### 5. Deploy config
- `vercel.json` SPA rewrite to `/index.html`. README section: create a free Supabase project, `supabase link`, `supabase db push`, set the Vercel env vars, and add the Vercel URL to Supabase auth redirect URLs.

## Testing (TDD where there's logic)
- Vitest: `env.ts` rejects missing vars; `ThemeProvider` defaults to dark, toggles, and survives throwing `localStorage`; `RequireAuth` redirects with no session and renders children with one (mocked client); `TRACKS` has 4 entries with unique colours.
- pgTAP RLS suite via `npm run db:test`.

## Verification
1. `npm run db:start && npm run db:reset && npm run db:test`: migrations apply and the RLS tests pass.
2. `npm run typecheck && npm run lint && npm test`: all green.
3. `npm run dev`: sign in with a magic link via local Inbucket (`localhost:54324`), reach Home, navigate all 4 tabs, toggle the theme, sign out. Check at 400px and desktop widths.
4. `npm run build && npm run preview`: the manifest and service worker register (DevTools → Application) and the app shell loads offline.
5. Commit on a feature branch `scaffold`.

## Out of scope
The round shell, every game, the workout picker, streaks, the content pipeline, stats logic, and the Vercel deploy itself (documented only).
