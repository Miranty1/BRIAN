import { z } from 'zod'

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
})

export type AppEnv = { supabaseUrl: string; supabaseAnonKey: string }

export function parseEnv(raw: Record<string, unknown>): AppEnv {
  const result = EnvSchema.safeParse(raw)
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid or missing env vars: ${fields}. Copy .env.example to .env.local.`)
  }
  return {
    supabaseUrl: result.data.VITE_SUPABASE_URL,
    supabaseAnonKey: result.data.VITE_SUPABASE_ANON_KEY,
  }
}
