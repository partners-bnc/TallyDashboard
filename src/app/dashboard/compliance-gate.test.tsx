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
  })

  it('redirects a selected workspace when the local completion flag is absent', async () => {
    render(<ComplianceGate userId="user-1"><p>Dashboard</p></ComplianceGate>)
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledOnce())
    expect(navigation.replace.mock.calls[0][0]).toContain('/dashboard/compliance-mapping?org=org-1&company=company-1')
  })

  it('renders the dashboard when the scoped completion flag exists', async () => {
    localStorage.setItem(tdsMappingStorageKey('user-1', 'org-1', 'company-1'), 'complete')
    const result = render(<ComplianceGate userId="user-1"><p>Dashboard</p></ComplianceGate>)
    await waitFor(() => expect(result.getByText('Dashboard')).toBeInTheDocument())
    expect(navigation.replace).not.toHaveBeenCalled()
  })

  it('never redirects the mapping route itself', async () => {
    navigation.pathname = '/dashboard/compliance-mapping'
    const result = render(<ComplianceGate userId="user-1"><p>Mapping</p></ComplianceGate>)
    await waitFor(() => expect(result.getByText('Mapping')).toBeInTheDocument())
    expect(navigation.replace).not.toHaveBeenCalled()
  })
})
