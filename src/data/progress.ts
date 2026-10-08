import type { GameId } from '@/games/games'

export type GameProgress = {
  level: number
  bestScore: number | null
  roundsPlayed: number
  lastPlayedAt: string | null
}

export type PendingRound = {
  id: string
  gameId: GameId
  level: number
  newLevel: number
  score: number
  accuracy: number
  avgResponseMs: number
  playedAt: string
}

export type RoundInput = Omit<PendingRound, 'id' | 'playedAt'>
export type SaveStatus = 'synced' | 'pending' | 'rejected'
export type SendResult = { ok: true } | { ok: false; retry: boolean; message: string }
export type ServerProgress = GameProgress & { gameId: GameId }
export type KeyValueStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type ProgressStore = {
  getGame(gameId: GameId): GameProgress
  pendingCount(): number
  /** Updates local progress immediately, queues the round, then tries to send it. */
  recordRound(input: RoundInput): Promise<SaveStatus>
  flush(): Promise<void>
  pullServerProgress(): Promise<void>
  subscribe(listener: () => void): () => void
  /** Stops all work for this store (user changed). Later calls are no-ops; in-flight work is abandoned. */
  dispose(): void
}

export type ProgressStoreOptions = {
  /** null = keep everything in memory (storage blocked). */
  storage: KeyValueStorage | null
  key: string
  send(round: PendingRound): Promise<SendResult>
  fetchServer(): Promise<ServerProgress[] | null>
  newId?: () => string
  now?: () => Date
}

type Persisted = { games: Partial<Record<GameId, GameProgress>>; outbox: PendingRound[] }

export const DEFAULT_PROGRESS: GameProgress = Object.freeze({
  level: 1,
  bestScore: null,
  roundsPlayed: 0,
  lastPlayedAt: null,
})

/** crypto.randomUUID needs a secure context (and iOS 15.4+); build a v4 UUID by hand otherwise. */
function defaultNewId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : -Infinity)

export function createProgressStore(opts: ProgressStoreOptions): ProgressStore {
  const newId = opts.newId ?? defaultNewId
  const now = opts.now ?? (() => new Date())
  const listeners = new Set<() => void>()
  const rejected = new Set<string>()
  let inFlight: Promise<void> | null = null
  let disposed = false
  let state: Persisted = load()

  function load(): Persisted {
    try {
      const raw = opts.storage?.getItem(opts.key)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Persisted>
        return { games: parsed.games ?? {}, outbox: parsed.outbox ?? [] }
      }
    } catch {
      // Corrupt or unreadable storage: start fresh.
    }
    return { games: {}, outbox: [] }
  }

  function commit(next: Persisted) {
    state = next
    try {
      opts.storage?.setItem(opts.key, JSON.stringify(state))
    } catch {
      // Storage full or blocked: keep going in memory.
    }
    listeners.forEach((listener) => listener())
  }

  async function runFlush() {
    while (!disposed && state.outbox.length > 0) {
      const round = state.outbox[0]!
      let result: SendResult
      try {
        result = await opts.send(round)
      } catch (e) {
        result = { ok: false, retry: true, message: String(e) }
      }
      if (disposed || (!result.ok && result.retry)) return
      if (!result.ok) {
        console.error(`Dropped round ${round.id}: ${result.message}`)
        rejected.add(round.id)
      }
      commit({ ...state, outbox: state.outbox.filter((r) => r.id !== round.id) })
    }
  }

  async function flush(): Promise<void> {
    // One run at a time; a caller arriving mid-run waits, then runs again to catch new rounds.
    while (inFlight) await inFlight
    if (disposed) return
    inFlight = runFlush().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  return {
    getGame: (gameId) => state.games[gameId] ?? DEFAULT_PROGRESS,

    pendingCount: () => state.outbox.length,

    async recordRound(input) {
      if (disposed) return 'pending'
      const round: PendingRound = { ...input, id: newId(), playedAt: now().toISOString() }
      const prev = state.games[input.gameId] ?? DEFAULT_PROGRESS
      commit({
        games: {
          ...state.games,
          [input.gameId]: {
            level: input.newLevel,
            bestScore:
              prev.bestScore === null ? input.score : Math.max(prev.bestScore, input.score),
            roundsPlayed: prev.roundsPlayed + 1,
            lastPlayedAt: round.playedAt,
          },
        },
        outbox: [...state.outbox, round],
      })
      await flush()
      if (rejected.has(round.id)) return 'rejected'
      return state.outbox.some((r) => r.id === round.id) ? 'pending' : 'synced'
    },

    flush,

    async pullServerProgress() {
      const rows = await opts.fetchServer()
      if (!rows || disposed) return
      const games = { ...state.games }
      for (const { gameId, ...server } of rows) {
        const local = games[gameId]
        if (!local || time(server.lastPlayedAt) > time(local.lastPlayedAt)) games[gameId] = server
      }
      commit({ ...state, games })
    },

    dispose() {
      disposed = true
      listeners.clear()
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
