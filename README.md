# BRIAN

A personal daily brain trainer. Mobile-first PWA built with React, Vite and Supabase. See `brian-handoff.md` for the full product spec.

The app talks to a hosted Supabase project on the free tier. There's no local database, so no Docker is needed.

## First-time setup

Requires Node 22+ and the [Supabase CLI](https://supabase.com/docs/guides/cli).

1. Create a free project at [supabase.com](https://supabase.com). Save the database password it asks for.
2. In the project, go to **Authentication → URL Configuration**. Set the site URL to `http://localhost:5173` and add `http://localhost:5173` and `http://localhost:4173` to the redirect URLs.
3. Then:

```sh
npm install
supabase login            # opens the browser once
npm run db:link           # pick your project; enter the database password
npm run db:push           # creates the tables and security rules
npm run db:test           # checks each user can only see their own data (no Docker needed)
npm run db:types          # regenerates src/lib/database.types.ts
cp .env.example .env.local  # fill in the URL and anon key from Project Settings → API
npm run dev               # http://localhost:5173
```

## Changing the database

Add a new file in `supabase/migrations/` (never edit one that's already been pushed), then:

```sh
npm run db:push:dry   # preview what will run
npm run db:push
npm run db:test
npm run db:types
```

Note that `db:push` changes your live database. The free tier has no automatic backups.

## Checks

```sh
npm run typecheck && npm run lint && npm test   # app
npm run db:test                                 # database security tests (pgTAP via scripts/db-test.mjs, rolled back after)
```

## Deploying to Vercel (free)

1. Import the repo into Vercel (Hobby plan). Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Add your Vercel URL to Supabase's site URL and redirect URLs.
3. Never put the service role key in a `VITE_` variable or in Vercel. It's only for local content scripts.

## Notes

- The free tier sends only a few auth emails per hour, so don't spam the magic-link button.
- Free Supabase projects pause after a week of no activity. Open the dashboard to wake one up.
- Placeholder PWA icons are generated with `python3 scripts/make-icons.py public`.
