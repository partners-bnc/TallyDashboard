import { beforeEach, describe, expect, it, vi } from 'vitest'

const authToken = vi.hoisted(() => vi.fn())
const createClient = vi.hoisted(() => vi.fn((config: {
  dataApi: { options: { global: { fetch: typeof fetch } } }
}) => {
  void config
  return { client: true }
}))

vi.mock('@/lib/auth/server', () => ({ auth: { token: authToken } }))
vi.mock('@neondatabase/neon-js', () => ({ createClient }))

import { createNeonDataApiClient, DataApiAuthenticationError, requireDataApiToken } from './data-api'

describe('Neon Data API authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_NEON_DATA_API_URL = 'https://data-api.example.test/rest/v1'
  })

  it('never downgrades a missing session token to an anonymous query', async () => {
    authToken.mockResolvedValue({ data: null, error: null })
    await expect(requireDataApiToken()).rejects.toBeInstanceOf(DataApiAuthenticationError)
  })

  it('returns an authenticated token when the session is ready', async () => {
    authToken.mockResolvedValue({ data: { token: 'jwt-token' }, error: null })
    await expect(requireDataApiToken()).resolves.toBe('jwt-token')
  })

  it('opts every Data API request out of the Next.js data cache', async () => {
    const networkFetch = vi.fn().mockResolvedValue(new Response())
    vi.stubGlobal('fetch', networkFetch)

    createNeonDataApiClient()
    const config = createClient.mock.calls[0][0]
    await config.dataApi.options.global.fetch('https://data-api.example.test/rest/v1/tb_organizations')

    expect(networkFetch).toHaveBeenCalledWith(
      'https://data-api.example.test/rest/v1/tb_organizations',
      { cache: 'no-store' },
    )
    vi.unstubAllGlobals()
  })
})
