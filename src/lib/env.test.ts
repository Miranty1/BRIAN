import { checkEnv, parseEnv } from './env'

describe('parseEnv', () => {
  it('returns the Supabase config when both vars are present', () => {
    expect(
      parseEnv({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'anon' }),
    ).toEqual({ supabaseUrl: 'http://127.0.0.1:54321', supabaseAnonKey: 'anon' })
  })

  it('throws a readable error when a var is missing', () => {
    expect(() => parseEnv({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321' })).toThrow(
      /VITE_SUPABASE_ANON_KEY/,
    )
  })

  it('rejects a URL that is not a URL', () => {
    expect(() => parseEnv({ VITE_SUPABASE_URL: 'nope', VITE_SUPABASE_ANON_KEY: 'anon' })).toThrow(
      /VITE_SUPABASE_URL/,
    )
  })
})

describe('checkEnv', () => {
  it('lists every missing or invalid var instead of throwing', () => {
    expect(checkEnv({ VITE_SUPABASE_URL: 'nope' })).toEqual({
      ok: false,
      invalid: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    })
  })

  it('returns the config when valid', () => {
    expect(
      checkEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).toEqual({ ok: true, env: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' } })
  })
})
