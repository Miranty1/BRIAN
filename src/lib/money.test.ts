import { formatAud, hasCents, roundCents } from './money'

describe('roundCents', () => {
  it('rounds half away from zero, despite float error', () => {
    expect(roundCents(1.005)).toBe(1.01)
    expect(roundCents(110 / 1.1)).toBe(100)
    expect(roundCents(2.344)).toBe(2.34)
    expect(roundCents(-1.005)).toBe(-1.01)
  })
})

describe('hasCents', () => {
  it('is false for whole dollars, including float noise', () => {
    expect(hasCents(80)).toBe(false)
    expect(hasCents(110 / 1.1)).toBe(false)
    expect(hasCents(12.5)).toBe(true)
  })
})

describe('formatAud', () => {
  it('shows cents only when there are some, unless told', () => {
    expect(formatAud(80)).toBe('$80')
    expect(formatAud(12.5)).toBe('$12.50')
    expect(formatAud(80, true)).toBe('$80.00')
    expect(formatAud(12.5, false)).toBe('$13')
  })

  it('adds thousands separators', () => {
    expect(formatAud(1234.5)).toBe('$1,234.50')
    expect(formatAud(2500)).toBe('$2,500')
  })
})
