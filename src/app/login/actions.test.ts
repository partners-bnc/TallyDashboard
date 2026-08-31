import { beforeEach, describe, expect, it, vi } from 'vitest'

const signIn = vi.hoisted(() => vi.fn())
const revalidatePath = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/server', () => ({ auth: { signIn: { email: signIn } } }))
vi.mock('next/cache', () => ({ revalidatePath }))

import { login } from './actions'

describe('login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signIn.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  it('invalidates pre-session dashboard payloads before returning success to the client', async () => {
    const formData = new FormData()
    formData.set('email', 'demo@example.com')
    formData.set('password', 'correct-password')

    await expect(login({ error: '', success: false }, formData)).resolves.toEqual({ error: '', success: true })

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard', 'layout')
  })
})
