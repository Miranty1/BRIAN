import { useState, type CSSProperties } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import ui from '@/components/ui.module.css'
import { useGameProgress, useProgressStore } from '@/data/ProgressProvider'
import { gameById } from '@/games/games'
import { getGameModule } from '@/games/registry'
import { TRACKS } from '@/games/tracks'
import { createRng } from '@/lib/rng'
import { RoundRun } from './RoundRun'
import { RunRound } from './RunRound'
import styles from './RoundScreen.module.css'

type Run = {
  id: number
  level: number
  prevBest: number | null
  seed: number
  items: readonly unknown[]
}

export function RoundScreen() {
  const { gameId = '' } = useParams()
  const gameModule = getGameModule(gameId)
  const store = useProgressStore()
  const progress = useGameProgress(gameModule?.id)
  const navigate = useNavigate()
  const [run, setRun] = useState<Run | null>(null)

  if (!gameModule || !store) return <Navigate to="/play" replace />

  const activeModule = gameModule
  const game = gameById(gameModule.id)
  const track = TRACKS[game.track]
  const toLibrary = () => navigate('/play')

  function start() {
    const seed = Date.now()
    setRun((prev) => ({
      id: (prev?.id ?? 0) + 1,
      level: progress.level,
      prevBest: progress.bestScore,
      seed,
      items:
        activeModule.kind === 'items' ? activeModule.generate(progress.level, createRng(seed)) : [],
    }))
  }

  return (
    <div className={styles.screen} style={{ '--track': track.colour } as CSSProperties}>
      {run ? (
        gameModule.kind === 'run' ? (
          <RunRound
            key={run.id}
            gameModule={gameModule}
            gameName={game.name}
            level={run.level}
            prevBest={run.prevBest}
            seed={run.seed}
            store={store}
            onQuit={toLibrary}
            onPlayAgain={start}
            onDone={toLibrary}
          />
        ) : (
          <RoundRun
            key={run.id}
            gameModule={gameModule}
            gameName={game.name}
            level={run.level}
            prevBest={run.prevBest}
            items={run.items}
            store={store}
            onQuit={toLibrary}
            onPlayAgain={start}
            onDone={toLibrary}
          />
        )
      ) : (
        <div className={styles.ready}>
          <button className={styles.quit} onClick={toLibrary} aria-label="Back to games">
            ✕
          </button>
          <div className={styles.readyBody}>
            <p className={styles.readyTrack}>{track.name}</p>
            <h1 className={styles.readyTitle}>{game.name}</h1>
            <p className={styles.readyLevel}>Level {progress.level}</p>
            <p className={styles.readyHint}>
              {gameModule.readyHint ??
                (gameModule.kind === 'items'
                  ? `${gameModule.itemsPerRound} questions, each against the clock.`
                  : '')}
            </p>
          </div>
          <button className={`${ui.button} ${styles.trackButton} ${styles.start}`} onClick={start}>
            Start
          </button>
        </div>
      )}
    </div>
  )
}
