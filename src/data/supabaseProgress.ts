import type { GameId } from '@/games/games'
import { supabase } from '@/lib/supabase'
import type { KeyValueStorage, PendingRound, SendResult, ServerProgress } from './progress'

/** Postgres errors (5-char SQLSTATE) won't succeed on retry; anything else (network, auth) might. */
export function isRetryable(code: string | undefined): boolean {
  return !/^[0-9A-Z]{5}$/.test(code ?? '')
}

export async function sendRound(round: PendingRound): Promise<SendResult> {
  try {
    const { error } = await supabase.rpc('record_round', {
      p_id: round.id,
      p_game_id: round.gameId,
      p_level: round.level,
      p_new_level: round.newLevel,
      p_score: round.score,
      p_accuracy: round.accuracy,
      p_avg_response_ms: round.avgResponseMs,
      p_played_at: round.playedAt,
    })
    if (!error) return { ok: true }
    return { ok: false, retry: isRetryable(error.code), message: error.message }
  } catch (e) {
    return { ok: false, retry: true, message: String(e) }
  }
}

export async function fetchServerProgress(): Promise<ServerProgress[] | null> {
  const { data, error } = await supabase
    .from('game_progress')
    .select('game_id, level, best_score, rounds_played, last_played_at')
  if (error || !data) return null
  return data.map((row) => ({
    gameId: row.game_id as GameId,
    level: row.level,
    bestScore: row.best_score,
    roundsPlayed: row.rounds_played,
    lastPlayedAt: row.last_played_at,
  }))
}

/** localStorage if it works; null (memory only) in private mode or when blocked. */
export function browserStorage(): KeyValueStorage | null {
  try {
    const probe = 'brian.probe'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}
