import { beforeEach, describe, expect, it, vi } from 'vitest'

const authToken = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/server', () => ({ auth: { token: authToken } }))
vi.mock('@neondatabase/neon-js', () => ({ createClient: vi.fn() }))

import { DataApiAuthenticationError, requireDataApiToken } from './data-api'

describe('Neon Data API authentication', () => {
  beforeEach(() => vi.clearAllMocks())

  it('never downgrades a missing session token to an anonymous query', async () => {
    authToken.mockResolvedValue({ data: null, error: null })
    await expect(requireDataApiToken()).rejects.toBeInstanceOf(DataApiAuthenticationError)
  })

  it('returns an authenticated token when the session is ready', async () => {
    authToken.mockResolvedValue({ data: { token: 'jwt-token' }, error: null })
    await expect(requireDataApiToken()).resolves.toBe('jwt-token')
  })
})
