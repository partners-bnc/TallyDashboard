import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tdsMappingStorageKey } from '@/lib/tds-mapping'

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: '/dashboard/overview',
  params: new URLSearchParams('org=org-1&company=company-1'),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.params,
  useRouter: () => ({ replace: navigation.replace }),
}))

import { ComplianceGate } from './compliance-gate'

describe('ComplianceGate', () => {
  afterEach(cleanup)

  beforeEach(() => {
    navigation.replace.mockReset()
    navigation.pathname = '/dashboard/overview'
    navigation.params = new URLSearchParams('org=org-1&company=company-1')
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reviewRequiredCount: 1 }),
    }))
  })

  it('redirects when the database completion row is absent even if localStorage says complete', async () => {
    localStorage.setItem(tdsMappingStorageKey('user-1', 'org-1', 'company-1'), 'complete')
    render(<ComplianceGate userId="user-1"><p>Dashboard</p></ComplianceGate>)
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledOnce())
    expect(navigation.replace.mock.calls[0][0]).toContain('/dashboard/compliance-mapping?org=org-1&company=company-1')
    expect(localStorage.getItem(tdsMappingStorageKey('user-1', 'org-1', 'company-1'))).toBeNull()
  })

  it('renders the dashboard and maintains localStorage when the database row is complete', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ reviewRequiredCount: 0 }),
    } as Response)
    const result = render(<ComplianceGate userId="user-1"><p>Dashboard</p></ComplianceGate>)
    await waitFor(() => expect(result.getByText('Dashboard')).toBeInTheDocument())
    expect(navigation.replace).not.toHaveBeenCalled()
    expect(localStorage.getItem(tdsMappingStorageKey('user-1', 'org-1', 'company-1'))).toBe('complete')
  })

  it('never redirects the mapping route itself', async () => {
    navigation.pathname = '/dashboard/compliance-mapping'
    const result = render(<ComplianceGate userId="user-1"><p>Mapping</p></ComplianceGate>)
    await waitFor(() => expect(result.getByText('Mapping')).toBeInTheDocument())
    expect(navigation.replace).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
