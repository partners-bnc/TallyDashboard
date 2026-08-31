import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoginNavigation } from './login-navigation'

const replaceDocument = vi.hoisted(() => vi.fn())

vi.mock('@/lib/document-navigation', () => ({ replaceDocument }))

describe('LoginNavigation', () => {
  it('starts a new document request after authentication succeeds', () => {
    const view = render(<LoginNavigation success={false} />)
    expect(replaceDocument).not.toHaveBeenCalled()

    view.rerender(<LoginNavigation success />)

    expect(replaceDocument).toHaveBeenCalledWith('/dashboard')
  })
})
