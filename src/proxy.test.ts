import { describe, expect, it, vi } from 'vitest'

const { middleware, handler } = vi.hoisted(() => {
  const proxyHandler = vi.fn(() => new Response(null, { status: 200 }))
  return {
    middleware: vi.fn(() => proxyHandler),
    handler: proxyHandler,
  }
})

vi.mock('@/lib/auth/server', () => ({ auth: { middleware } }))

import proxy, { config } from './proxy'

describe('Neon Auth proxy configuration', () => {
  it('uses the managed auth middleware for protected dashboard and read APIs', () => {
    expect(proxy).toBe(handler)
    expect(middleware).toHaveBeenCalledWith({ loginUrl: '/login' })
    expect(config.matcher).toContain('/dashboard/:path*')
    expect(config.matcher).toContain('/api/ledger/:path*')
  })
})
