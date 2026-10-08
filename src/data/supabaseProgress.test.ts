import { isRetryable } from './supabaseProgress'

describe('isRetryable', () => {
  it.each([
    ['', true], // network failure: supabase-js reports no code
    [undefined, true],
    ['PGRST301', true], // expired JWT: retry after the session refreshes
    ['23514', false], // check constraint
    ['22P02', false], // invalid input syntax
    ['42501', true], // permission denied (e.g. no session yet): may succeed once signed in
    ['57014', true], // statement timeout
    ['40001', true], // serialisation failure
    ['08006', true], // connection failure
  ])('code %s → retry %s', (code, expected) => {
    expect(isRetryable(code)).toBe(expected)
  })
})
