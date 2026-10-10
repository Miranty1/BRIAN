import { useMemo, useState } from 'react'
import type { ProgressStore } from '@/data/progress'
import type { RunGameModule, RunResult } from '@/games/types'
import { createRng } from '@/lib/rng'
import { RoundSummary } from './RoundSummary'
import styles from './RoundScreen.module.css'
import { isPersonalBest, nextLevel } from './scoring'
import { useSaveRound } from './useSaveRound'

type Props = {
  gameModule: RunGameModule
  gameName: string
  level: number
  prevBest: number | null
  seed: number
  store: ProgressStore
  onQuit(): void
  onPlayAgain(): void
  onDone(): void
}

/** Hosts a run-format game, then shows the shared summary and saves the result once. */
export function RunRound(props: Props) {
  const { gameModule, level, store } = props
  const [rng] = useState(() => createRng(props.seed))
  const [result, setResult] = useState<RunResult | null>(null)
  const newLevel = result ? nextLevel(level, result.score) : level

  const input = useMemo(
    () =>
      result
        ? {
            gameId: gameModule.id,
            level,
            newLevel,
            score: result.score,
            accuracy: result.accuracy,
            avgResponseMs: Math.round(result.avgResponseMs),
          }
        : null,
    [result], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const saveStatus = useSaveRound(store, input)

  if (result) {
    return (
      <RoundSummary
        gameName={props.gameName}
        score={result.score}
        stats={result.stats}
        level={level}
        newLevel={newLevel}
        isPersonalBest={isPersonalBest(props.prevBest, result.score)}
        saveStatus={saveStatus}
        onPlayAgain={props.onPlayAgain}
        onDone={props.onDone}
      />
    )
  }

  const RunView = gameModule.RunView
  return (
    <div className={styles.run}>
      <RunView
        level={level}
        rng={rng}
        onFinish={(r) => setResult((prev) => prev ?? r)}
        onQuit={props.onQuit}
      />
    </div>
  )
}
