import { useEffect, useRef } from 'react'
import type { ItemViewProps } from '@/games/types'
import { LEFT, RIGHT, type Card, type Rule, type RuleItem, type Side } from './generate'
import styles from './RuleSwitchView.module.css'

const CUE: Record<Rule, string> = { colour: 'COLOUR', shape: 'SHAPE', fill: 'FILL' }
const SYMBOL: Record<string, string> = {
  blue: 'Blue',
  orange: 'Orange',
  circle: '●',
  square: '■',
  solid: 'Solid',
  outline: 'Outline',
}

function CardShape({ card }: { card: Card }) {
  const colour = card.colour === 'blue' ? 'var(--rs-blue)' : 'var(--rs-orange)'
  const solid = card.fill === 'solid'
  const paint = { fill: solid ? colour : 'none', stroke: colour, strokeWidth: 8 }
  const name = `${card.colour[0]!.toUpperCase()}${card.colour.slice(1)} ${card.fill} ${card.shape}`
  return (
    <svg className={styles.card} viewBox="0 0 120 120" role="img" aria-label={name}>
      {card.shape === 'circle' ? (
        <circle cx="60" cy="60" r="44" {...paint} />
      ) : (
        <rect x="16" y="16" width="88" height="88" rx="6" {...paint} />
      )}
    </svg>
  )
}

export function RuleSwitchView({ item, onAnswer, feedback }: ItemViewProps<RuleItem, Side>) {
  const answered = useRef(false)

  function answer(side: Side) {
    if (feedback || answered.current) return
    answered.current = true
    onAnswer(side)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowLeft') answer('left')
      else if (e.key === 'ArrowRight') answer('right')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const sideButton = (side: Side) => {
    const value = (side === 'left' ? LEFT : RIGHT)[item.rule]
    const state = feedback && !feedback.correct && side === item.correct ? 'answer' : 'idle'
    return (
      <button
        type="button"
        className={styles.side}
        data-state={state}
        disabled={feedback !== null}
        aria-label={`${side === 'left' ? 'Left' : 'Right'}: ${value}`}
        onClick={() => answer(side)}
      >
        {SYMBOL[value]}
      </button>
    )
  }

  return (
    <div className={styles.view}>
      <p className={styles.cue} data-testid="cue">
        {CUE[item.rule]}
      </p>
      <div className={styles.cardArea}>
        <CardShape card={item.card} />
      </div>
      <div className={styles.sides}>
        {sideButton('left')}
        {sideButton('right')}
      </div>
    </div>
  )
}
