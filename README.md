# BRIAN

A personal daily brain trainer. Mobile-first PWA built with React, Vite and Supabase. See `brian-handoff.md` for the full product spec.

## Local development

Requires Node 22+, the [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker (for the local Supabase stack).

```sh
npm install
npm run db:start          # starts local Supabase; prints the API URL and anon key
cp .env.example .env.local  # paste the anon key in
npm run db:reset          # applies supabase/migrations
npm run db:types          # regenerates src/lib/database.types.ts
npm run dev               # http://localhost:5173
```

Magic-link emails land in the local inbox at http://127.0.0.1:54324.

## Checks

```sh
npm run typecheck && npm run lint && npm test   # app
npm run db:test                                 # RLS tests (pgTAP), needs db:start
```

## Deploying (free tiers)

1. Create a free project at supabase.com, then `supabase link --project-ref <ref>` and `supabase db push`.
2. In Supabase → Authentication → URL Configuration, set the site URL to your Vercel URL and add it to the redirect URLs.
3. Import the repo into Vercel (Hobby). Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase → Project Settings → API.
4. Never put the service role key in a `VITE_` variable or in Vercel; it's only for local content scripts.

## Icons

Placeholder PWA icons are generated with `python3 scripts/make-icons.py public`.
