-- record_round: saves a round + progress once, ignores resends and stale levels, stays per-user.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');
insert into public.game_progress (user_id, game_id, level, best_score, rounds_played, last_played_at) values
  ('00000000-0000-0000-0000-00000000000b', 'speed-arithmetic', 9, 70, 5, '2026-10-01 10:00+00');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1-2: the first round is recorded with its progress
select is(
  public.record_round('10000000-0000-0000-0000-000000000001', 'speed-arithmetic', 3::smallint, 4::smallint, 85::smallint, 0.9::real, 2100, '2026-10-09 10:00+00'),
  true, 'first call records the round');
select results_eq(
  $$ select level::int, best_score::int, rounds_played from public.game_progress $$,
  $$ values (4, 85, 1) $$, 'progress created from the round');

-- 3-4: resending the same id changes nothing
select is(
  public.record_round('10000000-0000-0000-0000-000000000001', 'speed-arithmetic', 3::smallint, 4::smallint, 85::smallint, 0.9::real, 2100, '2026-10-09 10:00+00'),
  false, 'resend returns false');
select results_eq(
  $$ select (select count(*)::int from public.rounds), (select rounds_played from public.game_progress) $$,
  $$ values (1, 1) $$, 'resend adds no round and does not recount');

-- 5-6: an older round counts but does not roll the level back
select is(
  public.record_round('10000000-0000-0000-0000-000000000002', 'speed-arithmetic', 2::smallint, 2::smallint, 95::smallint, 1::real, 1500, '2026-10-09 09:00+00'),
  true, 'older round is recorded');
select results_eq(
  $$ select level::int, best_score::int, rounds_played, last_played_at from public.game_progress $$,
  $$ values (4, 95, 2, '2026-10-09 10:00+00'::timestamptz) $$, 'older round keeps the newer level');

-- 7-8: a newer round moves the level and keeps the best
select is(
  public.record_round('10000000-0000-0000-0000-000000000003', 'speed-arithmetic', 4::smallint, 5::smallint, 40::smallint, 0.5::real, 3000, '2026-10-09 11:00+00'),
  true, 'newer round is recorded');
select results_eq(
  $$ select level::int, best_score::int, rounds_played from public.game_progress $$,
  $$ values (5, 95, 3) $$, 'newer round sets the level and keeps the best');

-- 9: the rounds belong to the caller
select results_eq(
  $$ select count(*)::int from public.rounds where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  array[3], 'all rounds owned by A');

-- 10: the other user's progress is untouched
reset role;
select results_eq(
  $$ select level::int, rounds_played from public.game_progress where user_id = '00000000-0000-0000-0000-00000000000b' $$,
  $$ values (9, 5) $$, 'other user progress untouched');

-- 11: anon cannot call it
set local role anon;
select throws_ok(
  $$ select public.record_round('10000000-0000-0000-0000-000000000004', 'speed-arithmetic', 1::smallint, 1::smallint, 0::smallint, 0::real, 0, now()) $$,
  '42501', null, 'anon cannot execute record_round');

select * from finish();
rollback;
