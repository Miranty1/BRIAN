/** Half away from zero, to the cent. The tiny bias absorbs float error like 1.005 * 100 = 100.4999… */
export function roundCents(n: number): number {
  return (Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-6)) / 100
}

export function hasCents(n: number): boolean {
  return Math.round(Math.abs(roundCents(n)) * 100) % 100 !== 0
}

/** "$1,234.50". Shows cents only when the amount has them, unless `withCents` says otherwise. */
export function formatAud(n: number, withCents: boolean = hasCents(n)): string {
  const digits = withCents ? 2 : 0
  const value = withCents ? roundCents(n) : Math.round(roundCents(n))
  return `$${value.toLocaleString('en-AU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}
