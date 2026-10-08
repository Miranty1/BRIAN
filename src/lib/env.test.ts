import { parseEnv } from './env'

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
