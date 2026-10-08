import { isRetryable } from './supabaseProgress'

describe('isRetryable', () => {
  it.each([
    ['', true], // network failure: supabase-js reports no code
    [undefined, true],
    ['PGRST301', true], // expired JWT: retry after the session refreshes
    ['23514', false], // check constraint
    ['42501', false], // permission denied
    ['22P02', false], // invalid input syntax
  ])('code %s → retry %s', (code, expected) => {
    expect(isRetryable(code)).toBe(expected)
  })
})
