import {
  createContext,
  useContext,
  useEffect,
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
import { browserStorage, fetchServerProgress, sendRound } from './supabaseProgress'

// eslint-disable-next-line react/only-export-components
export const ProgressContext = createContext<ProgressStore | null>(null)

/** One store per signed-in user. Syncs on sign-in/app load and whenever the device comes back online. */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const store = useMemo(
    () =>
      userId
        ? createProgressStore({
            storage: browserStorage(),
            key: `brian.progress.v1.${userId}`,
            send: sendRound,
            fetchServer: fetchServerProgress,
          })
        : null,
    [userId],
  )

  useEffect(() => {
    if (!store) return
    void store.pullServerProgress().then(() => store.flush())
    const onOnline = () => void store.flush()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
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
