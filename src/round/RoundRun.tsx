import { useEffect, useReducer, useRef, useState } from 'react'
import type { ProgressStore, SaveStatus } from '@/data/progress'
import type { AnyGameModule } from '@/games/types'
import { initRound, lastResult, roundReducer, type RoundEvent, type RoundState } from './engine'
import { RoundSummary } from './RoundSummary'
import styles from './RoundScreen.module.css'
import { nextLevel, scoreRound } from './scoring'

export const CORRECT_PAUSE_MS = 250
export const WRONG_PAUSE_MS = 1000

type Props = {
  gameModule: AnyGameModule
  gameName: string
  level: number
  prevBest: number | null
  items: readonly unknown[]
  store: ProgressStore
  onQuit(): void
  onPlayAgain(): void
  onDone(): void
}

const reducer = (state: RoundState<unknown>, event: RoundEvent) => roundReducer(state, event)

export function RoundRun(props: Props) {
  const { gameModule, level, items, store } = props
  const limit = gameModule.timeLimitMs(level)
  const [state, dispatch] = useReducer(reducer, items, (it) => initRound(it, limit))
  const [saveStatus, setSaveStatus] = useState<SaveStatus | 'saving'>('saving')
  const saved = useRef(false)
  const result = lastResult(state)

  // Start once mounted (a second dispatch under StrictMode is ignored by the engine).
  useEffect(() => {
    dispatch({ type: 'start', now: Date.now() })
  }, [])

  // Per-item hard limit.
  useEffect(() => {
    if (state.phase !== 'item') return
    const remaining = Math.max(0, limit - (Date.now() - state.itemStartedAt))
    const t = setTimeout(() => dispatch({ type: 'timeout', now: Date.now() }), remaining)
    return () => clearTimeout(t)
  }, [state.phase, state.index, state.itemStartedAt, limit])

  // Feedback pause, then the next item.
  useEffect(() => {
    if (state.phase !== 'feedback') return
    const pause = result?.correct ? CORRECT_PAUSE_MS : WRONG_PAUSE_MS
    const t = setTimeout(() => dispatch({ type: 'next', now: Date.now() }), pause)
    return () => clearTimeout(t)
  }, [state.phase, state.index, result?.correct])

  const stats =
    state.phase === 'done' ? scoreRound(state.results, gameModule.targetTimeMs(level)) : null
  const newLevel = stats ? nextLevel(level, stats.score) : level

  // Save exactly once when the round finishes.
  useEffect(() => {
    if (!stats || saved.current) return
    saved.current = true
    void store
      .recordRound({
        gameId: gameModule.id,
        level,
        newLevel,
        score: stats.score,
        accuracy: stats.accuracy,
        avgResponseMs: Math.round(stats.avgResponseMs),
      })
      .then(setSaveStatus)
      .catch(() => setSaveStatus('pending'))
  }, [state.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (stats) {
    const isPersonalBest = props.prevBest === null ? stats.score > 0 : stats.score > props.prevBest
    return (
      <RoundSummary
        gameName={props.gameName}
        score={stats.score}
        accuracy={stats.accuracy}
        avgResponseMs={stats.avgResponseMs}
        level={level}
        newLevel={newLevel}
        isPersonalBest={isPersonalBest}
        saveStatus={saveStatus}
        onPlayAgain={props.onPlayAgain}
        onDone={props.onDone}
      />
    )
  }

  const item = state.items[state.index]
  const feedback =
    state.phase === 'feedback' && result
      ? { correct: result.correct, answerLabel: gameModule.answerLabel(item) }
      : null
  const ItemView = gameModule.ItemView

  return (
    <div className={styles.run}>
      <div className={styles.top}>
        <button className={styles.quit} onClick={props.onQuit} aria-label="Quit round">
          ✕
        </button>
        <ol
          className={styles.segments}
          aria-label={`Question ${state.index + 1} of ${state.items.length}`}
        >
          {state.items.map((_, i) => {
            const r = state.results[i]
            const status = r
              ? r.correct
                ? 'right'
                : 'wrong'
              : i === state.index
                ? 'current'
                : 'upcoming'
            return <li key={i} className={styles.segment} data-status={status} />
          })}
        </ol>
      </div>
      <div className={styles.timerTrack} aria-hidden="true">
        <div
          key={state.index}
          className={styles.timerFill}
          data-running={state.phase === 'item'}
          style={{ animationDuration: `${limit}ms` }}
        />
      </div>
      <div
        className={styles.stage}
        data-testid="stage"
        data-feedback={feedback ? (feedback.correct ? 'correct' : 'wrong') : undefined}
      >
        <ItemView
          key={state.index}
          item={item}
          feedback={feedback}
          onAnswer={(answer: unknown) =>
            dispatch({ type: 'answer', correct: gameModule.check(item, answer), now: Date.now() })
          }
        />
      </div>
    </div>
  )
}
