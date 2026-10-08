import { z } from 'zod'

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
})

export type AppEnv = { supabaseUrl: string; supabaseAnonKey: string }

export type EnvCheck = { ok: true; env: AppEnv } | { ok: false; invalid: string[] }

export function checkEnv(raw: Record<string, unknown>): EnvCheck {
  const result = EnvSchema.safeParse(raw)
  if (!result.success) {
    return { ok: false, invalid: result.error.issues.map((i) => i.path.join('.')) }
  }
  return {
    ok: true,
    env: {
      supabaseUrl: result.data.VITE_SUPABASE_URL,
      supabaseAnonKey: result.data.VITE_SUPABASE_ANON_KEY,
    },
  }
}

export function parseEnv(raw: Record<string, unknown>): AppEnv {
  const result = checkEnv(raw)
  if (!result.ok) {
    throw new Error(
      `Invalid or missing env vars: ${result.invalid.join(', ')}. Copy .env.example to .env.local.`,
    )
  }
  return result.env
}
