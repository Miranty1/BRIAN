-- Records one finished round and updates game_progress in a single call.
-- Idempotent: the client supplies the round id, so resending a synced round is a no-op.
-- Runs as the caller (security invoker), so the existing owner-only RLS still applies.
create or replace function public.record_round(
  p_id uuid,
  p_game_id text,
  p_level smallint,
  p_new_level smallint,
  p_score smallint,
  p_accuracy real,
  p_avg_response_ms integer,
  p_played_at timestamptz
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inserted uuid;
begin
  insert into public.rounds (id, game_id, level, score, accuracy, avg_response_ms, played_at)
  values (p_id, p_game_id, p_level, p_score, p_accuracy, p_avg_response_ms, p_played_at)
  on conflict (id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    return false;
  end if;

  insert into public.game_progress as gp
    (user_id, game_id, level, best_score, rounds_played, last_played_at)
  values (auth.uid(), p_game_id, p_new_level, p_score, 1, p_played_at)
  on conflict (user_id, game_id) do update set
    rounds_played = gp.rounds_played + 1,
    best_score = greatest(gp.best_score, excluded.best_score),
    -- A round that syncs late must not roll the level back.
    level = case
      when excluded.last_played_at >= coalesce(gp.last_played_at, '-infinity'::timestamptz)
        then excluded.level
      else gp.level
    end,
    last_played_at = greatest(gp.last_played_at, excluded.last_played_at);

  return true;
end;
$$;

revoke execute on function public.record_round(uuid, text, smallint, smallint, smallint, real, integer, timestamptz)
  from public, anon;
grant execute on function public.record_round(uuid, text, smallint, smallint, smallint, real, integer, timestamptz)
  to authenticated;
