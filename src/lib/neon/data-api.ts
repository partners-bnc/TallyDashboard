import 'server-only'

import { cache } from 'react'
import { createClient } from '@neondatabase/neon-js'
import { auth } from '@/lib/auth/server'
import type { Database } from '@/lib/types'

export class DataApiAuthenticationError extends Error {
  constructor(message = 'An authenticated Neon Data API token is required') {
    super(message)
    this.name = 'DataApiAuthenticationError'
  }
}

const getJwt = cache(async (): Promise<string> => {
  const { data, error } = await auth.token()
  if (error) throw new Error(`Could not obtain Neon Data API token: ${error.message}`)
  if (!data?.token) throw new DataApiAuthenticationError()
  return data.token
})

export const requireDataApiToken = () => getJwt()

const noStoreFetch: typeof fetch = (input, init) => fetch(input, {
  ...init,
  cache: 'no-store',
})

const getDataApiClient = cache(() => {
  const url = process.env.NEXT_PUBLIC_NEON_DATA_API_URL
  if (!url) throw new Error('NEXT_PUBLIC_NEON_DATA_API_URL is required')

  return createClient<Database>({
    dataApi: {
      url,
      getToken: getJwt,
      options: { global: { fetch: noStoreFetch } },
    },
  })
})

export function createNeonDataApiClient() {
  return getDataApiClient()
}
