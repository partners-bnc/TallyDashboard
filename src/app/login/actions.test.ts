import { beforeEach, describe, expect, it, vi } from 'vitest'

const signIn = vi.hoisted(() => vi.fn())
const revalidatePath = vi.hoisted(() => vi.fn())
const redirect = vi.hoisted(() => vi.fn(() => {
  throw new Error('NEXT_REDIRECT')
}))

vi.mock('@/lib/auth/server', () => ({ auth: { signIn: { email: signIn } } }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({ redirect }))

import { login } from './actions'

describe('login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signIn.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  it('invalidates pre-session dashboard payloads before redirecting', async () => {
    const formData = new FormData()
    formData.set('email', 'demo@example.com')
    formData.set('password', 'correct-password')

    await expect(login({ error: '' }, formData)).rejects.toThrow('NEXT_REDIRECT')

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard', 'layout')
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })
})
