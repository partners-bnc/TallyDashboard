import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_NEON_DATA_API_URL: z.string().url(),
  NEON_AUTH_BASE_URL: z.string().url(),
  NEON_AUTH_COOKIE_SECRET: z.string().min(32),
})

export function getPublicEnv() {
  return envSchema.parse({
    NEXT_PUBLIC_NEON_DATA_API_URL: process.env.NEXT_PUBLIC_NEON_DATA_API_URL,
    NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL,
    NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET,
  })
}
