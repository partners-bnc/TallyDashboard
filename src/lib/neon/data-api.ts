import 'server-only'

import { createClient } from '@neondatabase/neon-js'
import { auth } from '@/lib/auth/server'
import type { Database } from '@/lib/types'

async function getJwt(): Promise<string | null> {
  const { data, error } = await auth.token()
  if (error) throw new Error(`Could not obtain Neon Data API token: ${error.message}`)
  return data?.token ?? null
}

export function createNeonDataApiClient() {
  const url = process.env.NEXT_PUBLIC_NEON_DATA_API_URL
  if (!url) throw new Error('NEXT_PUBLIC_NEON_DATA_API_URL is required')

  return createClient<Database>({
    dataApi: { url, getToken: getJwt },
  })
}
