-- RLS: each user sees and writes only their own rows; content_items is read-only to clients.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- Fixtures (as postgres, bypassing RLS)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

insert into public.content_items (id, game_id, band, payload, source) values
  ('11111111-1111-1111-1111-111111111111', 'word-bank', 1, '{"word":"laconic"}', 'seed');

insert into public.item_seen (user_id, item_id) values
  ('00000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111');
insert into public.game_progress (user_id, game_id) values
  ('00000000-0000-0000-0000-00000000000b', 'speed-arithmetic');
insert into public.workouts (id, user_id, local_date, game_ids) values
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-00000000000b',
   '2026-10-08', array['word-bank', 'speed-arithmetic', 'rule-switch']);
insert into public.rounds (user_id, game_id, level, score, accuracy) values
  ('00000000-0000-0000-0000-00000000000b', 'speed-arithmetic', 1, 80, 0.9);
insert into public.streak_freezes (user_id) values ('00000000-0000-0000-0000-00000000000b');
insert into public.skill_snapshots (user_id, track, local_date, score) values
  ('00000000-0000-0000-0000-00000000000b', 'math', '2026-10-08', 100);
insert into public.vocab_cards (user_id, item_id) values
  ('00000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111');

-- Act as user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1-7: A cannot see B's rows
select is_empty($$ select 1 from public.item_seen $$, 'A cannot read B item_seen');
select is_empty($$ select 1 from public.game_progress $$, 'A cannot read B game_progress');
select is_empty($$ select 1 from public.workouts $$, 'A cannot read B workouts');
select is_empty($$ select 1 from public.rounds $$, 'A cannot read B rounds');
select is_empty($$ select 1 from public.streak_freezes $$, 'A cannot read B streak_freezes');
select is_empty($$ select 1 from public.skill_snapshots $$, 'A cannot read B skill_snapshots');
select is_empty($$ select 1 from public.vocab_cards $$, 'A cannot read B vocab_cards');

-- 8-14: A cannot write rows owned by B
select throws_ok(
  $$ insert into public.item_seen (user_id, item_id) values
     ('00000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'A cannot insert item_seen for B');
select throws_ok(
  $$ insert into public.game_progress (user_id, game_id) values
     ('00000000-0000-0000-0000-00000000000b', 'money-maths') $$,
  '42501', null, 'A cannot insert game_progress for B');
select throws_ok(
  $$ insert into public.workouts (user_id, local_date, game_ids) values
     ('00000000-0000-0000-0000-00000000000b', '2026-10-09', array['a','b','c']) $$,
  '42501', null, 'A cannot insert workouts for B');
select throws_ok(
  $$ insert into public.rounds (user_id, game_id, level, score, accuracy) values
     ('00000000-0000-0000-0000-00000000000b', 'rule-switch', 1, 50, 0.5) $$,
  '42501', null, 'A cannot insert rounds for B');
select throws_ok(
  $$ insert into public.streak_freezes (user_id) values ('00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'A cannot insert streak_freezes for B');
select throws_ok(
  $$ insert into public.skill_snapshots (user_id, track, local_date, score) values
     ('00000000-0000-0000-0000-00000000000b', 'focus', '2026-10-08', 1) $$,
  '42501', null, 'A cannot insert skill_snapshots for B');
select throws_ok(
  $$ insert into public.vocab_cards (user_id, item_id, status) values
     ('00000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'new') $$,
  '42501', null, 'A cannot insert vocab_cards for B');

-- 15-16: A cannot update or delete B's rows (silently affects 0 rows)
update public.rounds set score = 0;
delete from public.game_progress;
reset role;
select results_eq($$ select score::int from public.rounds $$, array[80], 'A update did not touch B rounds');
select results_eq($$ select count(*)::int from public.game_progress $$, array[1], 'A delete did not touch B game_progress');
set local role authenticated;

-- 17-22: A can write and read their own rows (user_id defaults to auth.uid())
select lives_ok($$ insert into public.game_progress (game_id) values ('money-maths') $$, 'A can insert own game_progress');
select lives_ok(
  $$ insert into public.workouts (local_date, game_ids) values ('2026-10-08', array['word-bank','money-maths','rule-switch']) $$,
  'A can insert own workout');
select lives_ok($$ insert into public.rounds (game_id, level, score, accuracy) values ('money-maths', 2, 60, 0.7) $$, 'A can insert own round');
select lives_ok($$ insert into public.vocab_cards (item_id) values ('11111111-1111-1111-1111-111111111111') $$, 'A can insert own vocab card');
select results_eq($$ select count(*)::int from public.game_progress $$, array[1], 'A sees exactly their own game_progress');
select results_eq(
  $$ select user_id from public.rounds $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid) $$,
  'A round is owned by A');

-- 23-25: content_items is read-only for clients
select results_eq($$ select count(*)::int from public.content_items $$, array[1], 'A can read content_items');
select throws_ok(
  $$ insert into public.content_items (game_id, band, payload, source) values ('x', 1, '{}', 'seed') $$,
  '42501', null, 'A cannot insert content_items');
set local role anon;
select throws_ok($$ select 1 from public.rounds $$, '42501', null, 'anon has no access to rounds');

select * from finish();
rollback;
