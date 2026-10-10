// Sequence Recall difficulty per level (spec §5.3). All values [tunable].
export const LEAD_IN_MS = 600
export const MAX_MISTAKES = 2
export const TAP_GAP_CAP_MS = 5000
export const SUCCESS_PAUSE_MS = 400
export const MISTAKE_PAUSE_MS = 1000
/** Successes past the start length needed to reach the target. */
export const TARGET_STEPS = 2
export const REPEATS_FROM_LEVEL = 8

const clampLevel = (level: number) => Math.min(20, Math.max(1, Math.round(level)))
const lerp = (a: number, b: number, level: number) => Math.round(a + ((clampLevel(level) - 1) * (b - a)) / 19)

export const gridSize = (level: number) => (clampLevel(level) <= 6 ? 3 : clampLevel(level) <= 13 ? 4 : 5)
export const startLength = (level: number) => 3 + Math.floor((clampLevel(level) - 1) / 3)
export const targetLength = (level: number) => startLength(level) + TARGET_STEPS
export const flashMs = (level: number) => lerp(700, 350, level)
export const gapMs = (level: number) => lerp(250, 150, level)
export const allowRepeats = (level: number) => clampLevel(level) >= REPEATS_FROM_LEVEL
