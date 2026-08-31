import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from './providers'

const refresh = vi.hoisted(() => vi.fn())
const sessionState = vi.hoisted(() => ({
  data: null as { session: { id: string } } | null,
  isPending: false,
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/auth/client', () => ({ authClient: { useSession: () => sessionState } }))

describe('root theme foundation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionState.data = null
    sessionState.isPending = false
  })

  it('renders children inside the light Astryx provider', () => {
    const { getByText } = render(<Providers><span>Dashboard shell</span></Providers>)
    expect(getByText('Dashboard shell')).toBeInTheDocument()
  })

  it('refreshes protected route state when the Neon session changes', () => {
    const view = render(<Providers><span>Dashboard shell</span></Providers>)
    expect(refresh).not.toHaveBeenCalled()

    act(() => {
      sessionState.data = { session: { id: 'session-1' } }
      view.rerender(<Providers><span>Dashboard shell</span></Providers>)
    })

    expect(refresh).toHaveBeenCalledOnce()
  })
})

