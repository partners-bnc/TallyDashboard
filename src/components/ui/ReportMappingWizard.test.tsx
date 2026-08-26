import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CentralizedMappingData } from '@/lib/centralized-mapping'
import { ReportMappingWizard } from './ReportMappingWizard'
import { saveComplianceMapping } from '@/app/dashboard/compliance-mapping/actions'

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => navigation }))
vi.mock('@/components/ui/Header', () => ({ default: () => null }))
vi.mock('@/app/dashboard/compliance-mapping/actions', () => ({ saveComplianceMapping: vi.fn() }))

const baseData = (overrides: Partial<CentralizedMappingData['company']> = {}): CentralizedMappingData => ({
  orgId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  company: {
    companyId: '33333333-3333-4333-8333-333333333333',
    companyName: 'Example Company',
    configured: false,
    groups: [{
      groupId: '44444444-4444-4444-8444-444444444444',
      name: 'Unsecured Loans',
      parentName: null,
      parentGroupId: null,
      selected: true,
      autoSuggested: true,
    }],
    ledgers: [{
      ledgerId: '55555555-5555-4555-8555-555555555555',
      ledgerName: 'Loan from Promoter A',
      parentName: 'Unsecured Loans',
      parentGroupId: '44444444-4444-4444-8444-444444444444',
      selected: true,
      category: 'OTHER',
    }],
    ...overrides,
  },
})

describe('ReportMappingWizard', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      writable: true,
      value: vi.fn(() => ({
        beginPath: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
      })),
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(saveComplianceMapping).mockResolvedValue({ ok: true })
  })

  afterEach(cleanup)

  it('renders the ledger groups and ledger candidates', () => {
    render(<ReportMappingWizard
      initialData={baseData()}
      complianceType="PROMOTERS"
      title="Promoters Mapping"
      description="Select promoters groups and ledgers."
      returnTo="/dashboard"
    />)

    expect(screen.getAllByText('Unsecured Loans')[0]).toBeInTheDocument()
    expect(screen.getByText('Loan from Promoter A')).toBeInTheDocument()
  })

  it('submits mapping payload on save', async () => {
    render(<ReportMappingWizard
      initialData={baseData()}
      complianceType="PROMOTERS"
      title="Promoters Mapping"
      description="Select promoters groups and ledgers."
      returnTo="/dashboard"
    />)

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Mapping' }))

    await waitFor(() => expect(saveComplianceMapping).toHaveBeenCalledWith({
      orgId: '11111111-1111-4111-8111-111111111111',
      companyId: '33333333-3333-4333-8333-333333333333',
      complianceType: 'PROMOTERS',
      selectedGroups: ['Unsecured Loans'],
      ledgerDecisions: [{
        ledgerId: '55555555-5555-4555-8555-555555555555',
        selected: true,
        category: 'OTHER',
      }],
    }))
  })

  it('recursively updates subgroups and candidate ledgers when a group is toggled', async () => {
    const hierarchicalData = baseData({
      groups: [
        {
          groupId: 'parent-group-id',
          name: 'Parent Group',
          parentName: null,
          parentGroupId: null,
          selected: false,
          autoSuggested: false,
        },
        {
          groupId: 'child-group-id',
          name: 'Child Group',
          parentName: 'Parent Group',
          parentGroupId: 'parent-group-id',
          selected: true,
          autoSuggested: false,
        }
      ],
      ledgers: [
        {
          ledgerId: 'child-ledger-id',
          ledgerName: 'Child Ledger',
          parentName: 'Child Group',
          parentGroupId: 'child-group-id',
          selected: true,
          category: 'OTHER',
        }
      ]
    })

    render(<ReportMappingWizard
      initialData={hierarchicalData}
      complianceType="PROMOTERS"
      title="Promoters Mapping"
      description="Select promoters groups and ledgers."
      returnTo="/dashboard"
    />)

    // Child group should show up on the right side under Child Group header because child is selected
    // (and parent is automatically selected via upward propagation)
    expect(screen.getByText('Child Ledger')).toBeInTheDocument()

    // Uncheck Child Group
    const childGroupItem = screen.getAllByText('Child Group')[0]
    fireEvent.click(childGroupItem)

    // After unchecking, Child Group and Parent Group should become unselected, so Child Ledger should be hidden
    expect(screen.queryByText('Child Ledger')).not.toBeInTheDocument()
  })

  it('excludes parent group ledgers when only the subgroup is selected', () => {
    const hierarchicalData = baseData({
      groups: [
        {
          groupId: 'parent-group-id',
          name: 'Parent Group',
          parentName: null,
          parentGroupId: null,
          selected: false,
          autoSuggested: false,
        },
        {
          groupId: 'child-group-id',
          name: 'Child Group',
          parentName: 'Parent Group',
          parentGroupId: 'parent-group-id',
          selected: true,
          autoSuggested: false,
        }
      ],
      ledgers: [
        {
          ledgerId: 'parent-ledger-id',
          ledgerName: 'Parent Ledger',
          parentName: 'Parent Group',
          parentGroupId: 'parent-group-id',
          selected: true,
          category: 'OTHER',
        },
        {
          ledgerId: 'child-ledger-id',
          ledgerName: 'Child Ledger',
          parentName: 'Child Group',
          parentGroupId: 'child-group-id',
          selected: true,
          category: 'OTHER',
        }
      ]
    })

    render(<ReportMappingWizard
      initialData={hierarchicalData}
      complianceType="PROMOTERS"
      title="Promoters Mapping"
      description="Select promoters groups and ledgers."
      returnTo="/dashboard"
    />)

    // Child Ledger should be visible because its group is directly selected
    expect(screen.getByText('Child Ledger')).toBeInTheDocument()

    // Parent Ledger should NOT be visible because its group is only an ancestor of a selected child, not directly selected
    expect(screen.queryByText('Parent Ledger')).not.toBeInTheDocument()
  })
})
