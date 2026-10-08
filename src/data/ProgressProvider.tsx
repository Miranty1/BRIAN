import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useAuth } from '@/auth/AuthProvider'
import type { GameId } from '@/games/games'
import {
  createProgressStore,
  DEFAULT_PROGRESS,
  type GameProgress,
  type ProgressStore,
} from './progress'
import { browserStorage, createSupabaseAdapters } from './supabaseProgress'

// eslint-disable-next-line react/only-export-components
export const ProgressContext = createContext<ProgressStore | null>(null)

/** One store per signed-in user. Syncs on sign-in/app load and whenever the device comes back online. */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const store = useMemo(() => {
    if (!userId) return null
    const { sendRound, fetchServerProgress } = createSupabaseAdapters(userId)
    return createProgressStore({
      storage: browserStorage(),
      key: `brian.progress.v1.${userId}`,
      send: sendRound,
      fetchServer: fetchServerProgress,
    })
  }, [userId])

  // Dispose is deferred a tick so StrictMode's simulated unmount/remount (same store) doesn't kill it.
  const pendingDispose = useRef<{ store: ProgressStore; timer: number } | null>(null)

  useEffect(() => {
    if (!store) return
    if (pendingDispose.current?.store === store) {
      clearTimeout(pendingDispose.current.timer)
      pendingDispose.current = null
    }
    void store.pullServerProgress().then(() => store.flush())
    const onOnline = () => void store.flush()
    // iOS PWAs often miss `online`; coming back to the foreground is a good moment to retry too.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void store.flush()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      pendingDispose.current = { store, timer: window.setTimeout(() => store.dispose(), 0) }
    }
  }, [store])

  return <ProgressContext.Provider value={store}>{children}</ProgressContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useProgressStore(): ProgressStore | null {
  return useContext(ProgressContext)
}

const noopSubscribe = () => () => {}

// eslint-disable-next-line react/only-export-components
export function useGameProgress(gameId: GameId | undefined): GameProgress {
  const store = useProgressStore()
  return useSyncExternalStore(store?.subscribe ?? noopSubscribe, () =>
    store && gameId ? store.getGame(gameId) : DEFAULT_PROGRESS,
  )
}
