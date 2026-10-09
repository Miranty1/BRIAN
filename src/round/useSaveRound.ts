import { useEffect, useRef, useState } from 'react'
import type { ProgressStore, RoundInput, SaveStatus } from '@/data/progress'

/** Saves the round once, the first time `input` is non-null, and reports how it went. */
export function useSaveRound(
  store: ProgressStore,
  input: RoundInput | null,
): SaveStatus | 'saving' {
  const [status, setStatus] = useState<SaveStatus | 'saving'>('saving')
  const saved = useRef(false)

  useEffect(() => {
    if (!input || saved.current) return
    saved.current = true
    void store
      .recordRound(input)
      .then(setStatus)
      .catch(() => setStatus('pending'))
  }, [input, store])

  return status
}
