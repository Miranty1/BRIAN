import type { Rng } from '@/lib/rng'

/** A multiple-choice item: Money Maths and Table Reasoning both build on this. */
export type ChoiceItem = { prompt: string; options: string[]; correctIndex: number }
export type Choices = { options: string[]; correctIndex: number }

const NUDGE_ATTEMPTS = 200

/** Half away from zero to `dp` places, with a tiny bias for float error. */
export function roundTo(n: number, dp: number): number {
  const f = 10 ** dp
  return (Math.sign(n) * Math.round(Math.abs(n) * f + 1e-6)) / f
}

/** Fisher–Yates; returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

function finish(correct: string, others: string[], rng: Rng): Choices {
  const options = shuffle([correct, ...others], rng)
  return { options, correctIndex: options.indexOf(correct) }
}

/**
 * Four distinct options: the correct value plus up to three distractors, compared after
 * formatting. Gaps are filled with `nudge(correct)`. Throws only if nudging can't find
 * distinct values (a bug in the caller's nudge).
 */
export function makeChoices(
  correct: number,
  distractors: readonly number[],
  rng: Rng,
  opts: { format(n: number): string; nudge(n: number, rng: Rng): number; allowNegative?: boolean },
): Choices {
  const correctLabel = opts.format(correct)
  const seen = new Set([correctLabel])
  const others: string[] = []
  const add = (n: number) => {
    if (others.length >= 3 || !Number.isFinite(n) || (n < 0 && !opts.allowNegative)) return
    const label = opts.format(n)
    if (seen.has(label)) return
    seen.add(label)
    others.push(label)
  }
  distractors.forEach(add)
  for (let i = 0; others.length < 3 && i < NUDGE_ATTEMPTS; i++) add(opts.nudge(correct, rng))
  if (others.length < 3) throw new Error(`Couldn’t make distinct options for ${correctLabel}`)
  return finish(correctLabel, others, rng)
}

/** Like makeChoices for text answers (rows, products, ratios). */
export function makeLabelChoices(
  correct: string,
  others: readonly string[],
  rng: Rng,
  opts: { count?: number; fill?(rng: Rng): string } = {},
): Choices {
  const want = (opts.count ?? 4) - 1
  const seen = new Set([correct])
  const picked: string[] = []
  const add = (label: string) => {
    if (picked.length >= want || seen.has(label)) return
    seen.add(label)
    picked.push(label)
  }
  others.forEach(add)
  for (let i = 0; opts.fill && picked.length < want && i < NUDGE_ATTEMPTS; i++) add(opts.fill(rng))
  if (picked.length < want) throw new Error(`Couldn’t make distinct options for ${correct}`)
  return finish(correct, picked, rng)
}
