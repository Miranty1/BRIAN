import {
  createProgressStore,
  type KeyValueStorage,
  type RoundInput,
  type SendResult,
  type ServerProgress,
} from './progress'

function memoryStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) }
}

const input = (overrides: Partial<RoundInput> = {}): RoundInput => ({
  gameId: 'speed-arithmetic',
  level: 3,
  newLevel: 4,
  score: 85,
  accuracy: 0.9,
  avgResponseMs: 2100,
  ...overrides,
})

function setup(
  opts: {
    send?: (r: unknown) => Promise<SendResult>
    fetchServer?: () => Promise<ServerProgress[] | null>
    storage?: KeyValueStorage | null
  } = {},
) {
  const storage = opts.storage === undefined ? memoryStorage() : opts.storage
  const send = vi.fn(opts.send ?? (async (): Promise<SendResult> => ({ ok: true })))
  const fetchServer = vi.fn(opts.fetchServer ?? (async () => []))
  let n = 0
  const store = createProgressStore({
    storage,
    key: 'k',
    send,
    fetchServer,
    newId: () => `id-${++n}`,
    now: () => new Date('2026-10-09T10:00:00.000Z'),
  })
  return { store, storage, send, fetchServer }
}

describe('progress store', () => {
  it('defaults an unplayed game to level 1', () => {
    const { store } = setup()
    expect(store.getGame('speed-arithmetic')).toEqual({
      level: 1,
      bestScore: null,
      roundsPlayed: 0,
      lastPlayedAt: null,
    })
  })

  it('updates progress immediately, sends the round and reports synced', async () => {
    const { store, send, storage } = setup()
    await expect(store.recordRound(input())).resolves.toBe('synced')
    expect(store.getGame('speed-arithmetic')).toEqual({
      level: 4,
      bestScore: 85,
      roundsPlayed: 1,
      lastPlayedAt: '2026-10-09T10:00:00.000Z',
    })
    expect(send).toHaveBeenCalledWith({
      ...input(),
      id: 'id-1',
      playedAt: '2026-10-09T10:00:00.000Z',
    })
    expect(store.pendingCount()).toBe(0)
    expect(
      JSON.parse((storage as ReturnType<typeof memoryStorage>).map.get('k')!).games,
    ).toHaveProperty('speed-arithmetic')
  })

  it('keeps the round when the network fails, and sends it on the next flush', async () => {
    let online = false
    const { store, send } = setup({
      send: async () => (online ? { ok: true } : { ok: false, retry: true, message: 'offline' }),
    })
    await expect(store.recordRound(input())).resolves.toBe('pending')
    expect(store.pendingCount()).toBe(1)
    expect(store.getGame('speed-arithmetic').level).toBe(4)
    online = true
    await store.flush()
    expect(store.pendingCount()).toBe(0)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('drops a round the database rejects so it cannot block the queue', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { store } = setup({
      send: async () => ({ ok: false, retry: false, message: 'violates check constraint' }),
    })
    await expect(store.recordRound(input())).resolves.toBe('rejected')
    expect(store.pendingCount()).toBe(0)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('sends queued rounds in order', async () => {
    let online = false
    const sent: string[] = []
    const { store } = setup({
      send: async (r) => {
        if (!online) return { ok: false, retry: true, message: 'offline' }
        sent.push((r as { id: string }).id)
        return { ok: true }
      },
    })
    await store.recordRound(input())
    await store.recordRound(input({ score: 40 }))
    online = true
    await store.flush()
    expect(sent).toEqual(['id-1', 'id-2'])
  })

  it('keeps the best score', async () => {
    const { store } = setup()
    await store.recordRound(input({ score: 90 }))
    await store.recordRound(input({ score: 60 }))
    expect(store.getGame('speed-arithmetic').bestScore).toBe(90)
    expect(store.getGame('speed-arithmetic').roundsPlayed).toBe(2)
  })

  it('reloads saved progress and outbox from storage', async () => {
    const storage = memoryStorage()
    const offline = async (): Promise<SendResult> => ({ ok: false, retry: true, message: 'x' })
    await setup({ storage, send: offline }).store.recordRound(input())
    const { store } = setup({ storage, send: offline })
    expect(store.getGame('speed-arithmetic').level).toBe(4)
    expect(store.pendingCount()).toBe(1)
  })

  it('merges server progress, keeping whichever record is newer', async () => {
    const { store } = setup({
      fetchServer: async () => [
        {
          gameId: 'speed-arithmetic',
          level: 9,
          bestScore: 99,
          roundsPlayed: 50,
          lastPlayedAt: '2026-10-09T09:00:00+00:00',
        },
        {
          gameId: 'money-maths',
          level: 6,
          bestScore: 70,
          roundsPlayed: 8,
          lastPlayedAt: '2026-10-08T09:00:00+00:00',
        },
      ],
    })
    await store.recordRound(input()) // local speed-arithmetic at 10:00
    await store.pullServerProgress()
    expect(store.getGame('speed-arithmetic').level).toBe(4)
    expect(store.getGame('money-maths').level).toBe(6)
  })

  it('adopts a newer server record', async () => {
    const { store } = setup({
      fetchServer: async () => [
        {
          gameId: 'speed-arithmetic',
          level: 9,
          bestScore: 99,
          roundsPlayed: 50,
          lastPlayedAt: '2026-10-09T11:00:00+00:00',
        },
      ],
    })
    await store.recordRound(input())
    await store.pullServerProgress()
    expect(store.getGame('speed-arithmetic').level).toBe(9)
  })

  it('keeps local when the server record is the same instant in a different format', async () => {
    const { store } = setup({
      fetchServer: async () => [
        {
          gameId: 'speed-arithmetic',
          level: 9,
          bestScore: 99,
          roundsPlayed: 50,
          lastPlayedAt: '2026-10-09T10:00:00+00:00',
        },
      ],
    })
    await store.recordRound(input())
    await store.pullServerProgress()
    expect(store.getGame('speed-arithmetic').level).toBe(4)
  })

  it('adopts a server record that is 1 ms newer despite a different suffix', async () => {
    const { store } = setup({
      fetchServer: async () => [
        {
          gameId: 'speed-arithmetic',
          level: 9,
          bestScore: 99,
          roundsPlayed: 50,
          lastPlayedAt: '2026-10-09T10:00:00.001+00:00',
        },
      ],
    })
    await store.recordRound(input())
    await store.pullServerProgress()
    expect(store.getGame('speed-arithmetic').level).toBe(9)
  })

  it('sends a round recorded while another send is pending, in order', async () => {
    const sent: string[] = []
    const gates: Array<() => void> = []
    const { store } = setup({
      send: (r) =>
        new Promise<SendResult>((resolve) => {
          gates.push(() => {
            sent.push((r as { id: string }).id)
            resolve({ ok: true })
          })
        }),
    })
    const first = store.recordRound(input())
    const second = store.recordRound(input({ score: 40 }))
    await vi.waitFor(() => expect(gates).toHaveLength(1))
    gates[0]!()
    await vi.waitFor(() => expect(gates).toHaveLength(2))
    gates[1]!()
    await expect(Promise.all([first, second])).resolves.toEqual(['synced', 'synced'])
    expect(sent).toEqual(['id-1', 'id-2'])
    expect(store.pendingCount()).toBe(0)
  })

  it('handles overlapping flush calls cleanly', async () => {
    let online = false
    const sent: string[] = []
    const { store } = setup({
      send: async (r) => {
        if (!online) return { ok: false, retry: true, message: 'offline' }
        sent.push((r as { id: string }).id)
        return { ok: true }
      },
    })
    await store.recordRound(input())
    online = true
    await Promise.all([store.flush(), store.flush()])
    expect(sent).toEqual(['id-1'])
    expect(store.pendingCount()).toBe(0)
  })

  it('works with no storage at all', async () => {
    const { store } = setup({ storage: null })
    await expect(store.recordRound(input())).resolves.toBe('synced')
    expect(store.getGame('speed-arithmetic').level).toBe(4)
  })

  it('notifies subscribers on change', async () => {
    const { store } = setup()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    await store.recordRound(input())
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    listener.mockClear()
    await store.recordRound(input())
    expect(listener).not.toHaveBeenCalled()
  })
})
