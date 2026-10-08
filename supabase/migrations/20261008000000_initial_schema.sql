-- BRIAN initial schema (handoff §7).
-- Every per-user table is locked to its owner with RLS: user_id = auth.uid().
-- content_items is read-only for signed-in users; writes go through the service role only.

-- ---------------------------------------------------------------------------
-- Content bank
-- ---------------------------------------------------------------------------
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  band smallint not null check (band >= 1),
  payload jsonb not null,
  source text not null check (source in ('seed', 'claude-code', 'ollama')),
  created_at timestamptz not null default now()
);
create index content_items_game_band_idx on public.content_items (game_id, band);

alter table public.content_items enable row level security;
create policy "content_items readable by signed-in users"
  on public.content_items for select to authenticated using (true);
revoke insert, update, delete, truncate on public.content_items from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Per-user tables
-- ---------------------------------------------------------------------------
create table public.item_seen (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id uuid not null references public.content_items on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table public.game_progress (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  game_id text not null,
  level smallint not null default 1 check (level between 1 and 20),
  best_score smallint check (best_score between 0 and 100),
  rounds_played integer not null default 0 check (rounds_played >= 0),
  last_played_at timestamptz,
  primary key (user_id, game_id)
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  local_date date not null,
  game_ids text[] not null check (cardinality(game_ids) = 3),
  completed_at timestamptz,
  unique (user_id, local_date)
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  game_id text not null,
  level smallint not null check (level between 1 and 20),
  score smallint not null check (score between 0 and 100),
  accuracy real not null check (accuracy between 0 and 1),
  avg_response_ms integer check (avg_response_ms >= 0),
  workout_id uuid references public.workouts on delete set null,
  played_at timestamptz not null default now()
);
create index rounds_user_game_played_idx on public.rounds (user_id, game_id, played_at desc);
create index rounds_workout_idx on public.rounds (workout_id);

create table public.streak_freezes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  earned_at timestamptz not null default now(),
  used_on date
);
create index streak_freezes_user_idx on public.streak_freezes (user_id);

create table public.skill_snapshots (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  track text not null check (track in ('math', 'verbal', 'memory', 'focus')),
  local_date date not null,
  score smallint not null check (score between 0 and 1000),
  primary key (user_id, track, local_date)
);

create table public.vocab_cards (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id uuid not null references public.content_items on delete cascade,
  interval_days integer not null default 0 check (interval_days >= 0),
  due_on date not null default current_date,
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  status text not null default 'new' check (status in ('new', 'learning', 'mastered')),
  last_reviewed_at timestamptz,
  primary key (user_id, item_id)
);
create index vocab_cards_user_due_idx on public.vocab_cards (user_id, due_on);

-- ---------------------------------------------------------------------------
-- Owner-only RLS on every per-user table
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'item_seen', 'game_progress', 'workouts', 'rounds',
    'streak_freezes', 'skill_snapshots', 'vocab_cards'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner only" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t
    );
    execute format('revoke all on public.%I from anon', t);
  end loop;
end
$$;
