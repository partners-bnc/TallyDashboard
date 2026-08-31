import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardSelector } from './dashboard-selector'
import type { Company, Organization } from '@/lib/types'

const assignDocument = vi.hoisted(() => vi.fn())

vi.mock('@/lib/document-navigation', () => ({ assignDocument }))
vi.mock('@/components/ui/Header', () => ({ default: () => null }))
vi.mock('@/components/ui/Footer', () => ({ default: () => null }))

const organization: Organization = { id: 'org-1', name: 'Example Org', created_at: '2026-01-01' }
const company: Company = {
  id: 'company-1',
  org_id: 'org-1',
  name: 'Example Company',
  tally_company_guid: 'guid-1',
  last_successful_sync_at: null,
  last_sync_status: null,
  last_sync_error: null,
  is_active: true,
  updated_at: '2026-01-01',
}

describe('DashboardSelector', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('changes organization with a full document navigation', () => {
    render(<DashboardSelector organizations={[organization]} companies={[]} selectedOrganizationId={null} selectedCompanyId={null} />)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: organization.id } })
    expect(assignDocument).toHaveBeenCalledWith('/dashboard?org=org-1')
  })

  it('navigates directly to the selected company overview', () => {
    render(<DashboardSelector organizations={[organization]} companies={[company]} selectedOrganizationId={organization.id} selectedCompanyId={null} />)
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: company.id } })
    expect(assignDocument).toHaveBeenCalledWith('/dashboard/overview?org=org-1&company=company-1')
  })

  it('shows a genuine no-membership state instead of an empty selector', () => {
    render(<DashboardSelector organizations={[]} companies={[]} selectedOrganizationId={null} selectedCompanyId={null} />)
    expect(screen.getByRole('status')).toHaveTextContent('No workspace assigned')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
