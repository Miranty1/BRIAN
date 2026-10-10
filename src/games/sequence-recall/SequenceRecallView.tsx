import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import styles from '@/round/RoundScreen.module.css'
import type { RunViewProps } from '@/games/types'
import {
  flashMs,
  gapMs,
  gridSize,
  LEAD_IN_MS,
  MAX_MISTAKES,
  MISTAKE_PAUSE_MS,
  startLength,
  SUCCESS_PAUSE_MS,
} from './levels'
import { generateSequence, initRun, nextLength, runReducer, runResult } from './run'
import view from './SequenceRecallView.module.css'

const TAP_FLASH_MS = 150

// Module-level clock: only called from timer callbacks and event handlers, never during render.
const now = () => Date.now()

type TileState = 'idle' | 'lit' | 'right' | 'wrong' | 'answer'

export function SequenceRecallView({ level, rng, onFinish, onQuit }: RunViewProps) {
  const size = gridSize(level)
  const [state, dispatch] = useReducer(runReducer, undefined, () =>
    initRun(generateSequence(startLength(level), level, rng)),
  )
  const [lit, setLit] = useState<number | null>(null)
  const [pressed, setPressed] = useState<number | null>(null)
  const finished = useRef(false)

  // Play the sequence. A new attempt always brings a new sequence array, so this reruns per attempt.
  useEffect(() => {
    if (state.phase !== 'show') return
    const timers: ReturnType<typeof setTimeout>[] = []
    const step = flashMs(level) + gapMs(level)
    state.sequence.forEach((tile, i) => {
      const on = LEAD_IN_MS + i * step
      timers.push(setTimeout(() => setLit(tile), on))
      timers.push(setTimeout(() => setLit(null), on + flashMs(level)))
    })
    const end = LEAD_IN_MS + state.sequence.length * step
    timers.push(setTimeout(() => dispatch({ type: 'shown', now: now() }), end))
    return () => {
      timers.forEach(clearTimeout)
      setLit(null)
    }
  }, [state.phase, state.sequence, level])

  // Pause on feedback, then the next attempt (or the end).
  useEffect(() => {
    if (state.phase !== 'feedback') return
    const pause = state.lastOk ? SUCCESS_PAUSE_MS : MISTAKE_PAUSE_MS
    const t = setTimeout(
      () => dispatch({ type: 'next', sequence: generateSequence(nextLength(state), level, rng) }),
      pause,
    )
    return () => clearTimeout(t)
  }, [state.phase, state.attempts]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.phase !== 'done' || finished.current) return
    finished.current = true
    onFinish(runResult(state, level))
  }, [state.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Brief light on the tapped tile.
  useEffect(() => {
    if (pressed === null) return
    const t = setTimeout(() => setPressed(null), TAP_FLASH_MS)
    return () => clearTimeout(t)
  }, [pressed])

  function tap(tile: number) {
    if (state.phase !== 'input') return
    setPressed(tile)
    dispatch({ type: 'tap', tile, now: now() })
  }

  function tileState(i: number): TileState {
    if (state.phase === 'show') return lit === i ? 'lit' : 'idle'
    if (state.phase === 'feedback') {
      if (state.lastOk) return 'right'
      if (i === state.wrongTile) return 'wrong'
      if (i === state.sequence[state.inputIndex]) return 'answer'
      return 'idle'
    }
    return pressed === i ? 'lit' : 'idle'
  }

  const left = Math.max(0, MAX_MISTAKES - state.mistakes)

  return (
    <>
      <div className={styles.top}>
        <button className={styles.quit} onClick={onQuit} aria-label="Quit round">
          ✕
        </button>
        <div className={view.status}>
          <span>{state.phase === 'show' ? 'Watch…' : state.phase === 'input' ? 'Your turn' : ' '}</span>
          <span className={view.lives} aria-label={`${left} mistakes left`}>
            {'●'.repeat(left)}
            {'○'.repeat(MAX_MISTAKES - left)}
          </span>
        </div>
      </div>
      <div className={view.stage}>
        <div className={view.grid} style={{ '--size': size } as CSSProperties}>
          {Array.from({ length: size * size }, (_, i) => (
            <button
              key={i}
              type="button"
              className={view.tile}
              data-state={tileState(i)}
              disabled={state.phase !== 'input'}
              aria-label={`Tile ${i + 1}`}
              onClick={() => tap(i)}
            />
          ))}
        </div>
      </div>
    </>
  )
}
