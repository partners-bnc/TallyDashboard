import { describe, expect, it, vi } from 'vitest'
import { resolveActiveLedgers } from './centralized-mapping'
import { createNeonDataApiClient } from '@/lib/neon/data-api'

vi.mock('@/lib/neon/data-api', () => ({
  createNeonDataApiClient: vi.fn(),
}))

describe('resolveActiveLedgers', () => {
  it('resolves empty set when profile status is not complete', async () => {
    const mockClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(createNeonDataApiClient).mockReturnValue(mockClient as any)

    const result = await resolveActiveLedgers('company-123', 'TDS')
    expect(result.activeLedgerIds.size).toBe(0)
  })

  it('loads completed TDS selections from the final ledger mapping table', async () => {
    const fromCalls: string[] = []
    const mockClient = {
      from: vi.fn((table) => {
        fromCalls.push(table)
        return mockClient
      }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'profile-tds', status: 'complete' },
        error: null,
      }),
      then: vi.fn().mockImplementation((resolve) => Promise.resolve(resolve({
        data: [{ ledger_id: 'ledger-tds-rent' }, { ledger_id: 'ledger-tds-salary' }],
        error: null,
      }))),
    }
    vi.mocked(createNeonDataApiClient).mockReturnValue(mockClient as any)

    const result = await resolveActiveLedgers('company-123', 'TDS')

    expect(fromCalls).toEqual(['compliance_mapping_profiles', 'tds_ledger_mappings'])
    expect([...result.activeLedgerIds]).toEqual(['ledger-tds-rent', 'ledger-tds-salary'])
  })

  it('correctly resolves active ledgers: group + forced selections - deselections', async () => {
    const fromCalls: string[] = []
    const mockClient = {
      from: vi.fn((table) => {
        fromCalls.push(table)
        return mockClient
      }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(async () => {
        const table = fromCalls[fromCalls.length - 1]
        if (table === 'compliance_mapping_profiles') {
          return {
            data: {
              id: 'profile-123',
              status: 'complete',
              selected_groups: ['Unsecured Loans'],
              ledger_decisions: [
                { ledger_id: 'ledger-forced', selected: true, category: 'OTHER' },
                { ledger_id: 'ledger-deselected', selected: false, category: null },
              ],
            },
            error: null,
          }
        }
        return { data: null, error: null }
      }),
      then: vi.fn().mockImplementation((resolve) => {
        const table = fromCalls[fromCalls.length - 1]
        let data: any = []
        if (table === 'tb_ledger_groups') {
          data = [
            { id: 'group-loans', name: 'Unsecured Loans', parent_name: null, parent_group_id: null },
            { id: 'group-loans-sub', name: 'Director Loans', parent_name: 'Unsecured Loans', parent_group_id: 'group-loans' },
          ]
        } else if (table === 'tb_ledgers') {
          data = [
            { id: 'ledger-in-group', name: 'Loan from A', parent_name: 'Unsecured Loans', parent_group_id: 'group-loans' },
            { id: 'ledger-in-subgroup', name: 'Loan from Director B', parent_name: 'Director Loans', parent_group_id: 'group-loans-sub' },
            { id: 'ledger-forced', name: 'Capital from C', parent_name: 'Capital Account', parent_group_id: 'group-capital' },
            { id: 'ledger-deselected', name: 'Loan from D', parent_name: 'Unsecured Loans', parent_group_id: 'group-loans' },
            { id: 'ledger-outside', name: 'GST Payable', parent_name: 'Duties & Taxes', parent_group_id: 'group-taxes' },
          ]
        }
        return Promise.resolve(resolve({ data, error: null }))
      }),
    }
    vi.mocked(createNeonDataApiClient).mockReturnValue(mockClient as any)

    const result = await resolveActiveLedgers('company-123', 'PROMOTERS')
    expect(result.activeLedgerIds.has('ledger-in-group')).toBe(true)
    expect(result.activeLedgerIds.has('ledger-in-subgroup')).toBe(true) // recursive inclusion
    expect(result.activeLedgerIds.has('ledger-forced')).toBe(true) // forced inclusion
    expect(result.activeLedgerIds.has('ledger-deselected')).toBe(false) // forced exclusion
    expect(result.activeLedgerIds.has('ledger-outside')).toBe(false) // outside
    expect(fromCalls).toEqual(['compliance_mapping_profiles', 'tb_ledger_groups', 'tb_ledgers'])
  })

  it('excludes subgroup ledgers if parent is selected but subgroup was explicitly not selected (indicated by sibling selection)', async () => {
    const fromCalls: string[] = []
    const mockClient = {
      from: vi.fn((table) => {
        fromCalls.push(table)
        return mockClient
      }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(async () => {
        const table = fromCalls[fromCalls.length - 1]
        if (table === 'compliance_mapping_profiles') {
          return {
            data: {
              id: 'profile-999',
              status: 'complete',
              selected_groups: ['Duties & Taxes', 'GST'],
              ledger_decisions: [],
            },
            error: null,
          }
        }
        return { data: null, error: null }
      }),
      then: vi.fn().mockImplementation((resolve) => {
        const table = fromCalls[fromCalls.length - 1]
        let data: any = []
        if (table === 'tb_ledger_groups') {
          data = [
            { id: 'group-taxes', name: 'Duties & Taxes', parent_name: null, parent_group_id: null },
            { id: 'group-gst', name: 'GST', parent_name: 'Duties & Taxes', parent_group_id: 'group-taxes' },
            { id: 'group-tds', name: 'TDS', parent_name: 'Duties & Taxes', parent_group_id: 'group-taxes' },
          ]
        } else if (table === 'tb_ledgers') {
          data = [
            { id: 'ledger-gst', name: 'GST Input 18%', parent_name: 'GST', parent_group_id: 'group-gst' },
            { id: 'ledger-tds', name: 'TDS on Rent', parent_name: 'TDS', parent_group_id: 'group-tds' },
          ]
        }
        return Promise.resolve(resolve({ data, error: null }))
      }),
    }
    vi.mocked(createNeonDataApiClient).mockReturnValue(mockClient as any)

    const result = await resolveActiveLedgers('company-123', 'GST')
    expect(result.activeLedgerIds.has('ledger-gst')).toBe(true) // Selected child is active
    expect(result.activeLedgerIds.has('ledger-tds')).toBe(false) // Unselected sibling child is excluded
    expect(fromCalls).toEqual(['compliance_mapping_profiles', 'tb_ledger_groups', 'tb_ledgers'])
  })
})
