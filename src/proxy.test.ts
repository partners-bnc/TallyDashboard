import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getUser, createServerClient } = vi.hoisted(() => {
  const getUser = vi.fn()
  const createServerClient = vi.fn(() => ({ auth: { getUser } }))
  return { getUser, createServerClient }
})

vi.mock('@supabase/ssr', () => ({ createServerClient }))

vi.mock('next/server', () => ({
  NextResponse: {
    next: vi.fn(() => ({ status: 200, headers: new Headers(), cookies: { set: vi.fn() } })),
    redirect: vi.fn((url: URL) => ({ status: 307, headers: new Headers([['location', url.toString()]]), cookies: { set: vi.fn() } })),
  },
}))

import { proxy } from './proxy'

function requestFor(pathname: string) {
  return {
    url: `https://tallybridge.test${pathname}`,
    nextUrl: { pathname },
    headers: new Headers(),
    cookies: { getAll: () => [], set: vi.fn() },
  } as unknown as NextRequest
}

describe('proxy authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it.each(['/', '/login'])('bypasses Supabase auth for public path %s', async (pathname) => {
    const response = await proxy(requestFor(pathname))

    expect(response.status).toBe(200)
    expect(createServerClient).not.toHaveBeenCalled()
    expect(getUser).not.toHaveBeenCalled()
  })

  it('redirects unauthenticated protected requests to login', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } })

    const response = await proxy(requestFor('/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://tallybridge.test/login')
    expect(getUser).toHaveBeenCalledOnce()
  })

  it('preserves authenticated protected access and public login access', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })

    const response = await proxy(requestFor('/dashboard/overview'))
    expect(response.status).toBe(200)

    const loginResponse = await proxy(requestFor('/login'))
    expect(loginResponse.status).toBe(200)
    expect(loginResponse.headers.get('location')).toBeNull()
    expect(getUser).toHaveBeenCalledOnce()
  })
})
