import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TdsComplianceMappingData } from '@/lib/types'
import { TdsComplianceMappingClient } from './tds-compliance-mapping-client'
import { saveTdsComplianceMapping } from './actions'

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => navigation }))
vi.mock('@/components/ui/Header', () => ({ default: () => null }))
vi.mock('./actions', () => ({ saveTdsComplianceMapping: vi.fn() }))

const baseData = (overrides: Partial<TdsComplianceMappingData['company']> = {}): TdsComplianceMappingData => ({
  orgId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  company: {
    companyId: '33333333-3333-4333-8333-333333333333',
    companyName: 'Example Company',
    configured: false,
    tdsGroupFound: true,
    groups: [{
      groupId: '44444444-4444-4444-8444-444444444444',
      name: 'TDS',
      parentName: 'Duties & Taxes',
      parentGroupId: null,
      directLedgerCount: 1,
      isTdsRoot: true,
    }],
    ledgers: [{
      ledgerId: '55555555-5555-4555-8555-555555555555',
      ledgerName: 'TDS on Contractor',
      parentName: 'TDS',
      parentGroupId: '44444444-4444-4444-8444-444444444444',
      selected: true,
    }],
    ...overrides,
  },
})

describe('TDS compliance mapping client', () => {
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
    vi.mocked(saveTdsComplianceMapping).mockResolvedValue({ ok: true })
  })

  afterEach(cleanup)

  it('shows the missing-group message and disables confirmation', () => {
    render(<TdsComplianceMappingClient
      initialData={baseData({ tdsGroupFound: false, groups: [], ledgers: [] })}
      returnTo="/dashboard"
    />)

    expect(screen.getByText('No TDS ledger group was found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm TDS mapping' })).toBeDisabled()
  })

  it('submits only the selected candidate ledger IDs', async () => {
    render(<TdsComplianceMappingClient initialData={baseData()} returnTo="/dashboard" />)

    fireEvent.click(screen.getByRole('button', { name: 'Confirm TDS mapping' }))

    await waitFor(() => expect(saveTdsComplianceMapping).toHaveBeenCalledWith({
      orgId: '11111111-1111-4111-8111-111111111111',
      companyId: '33333333-3333-4333-8333-333333333333',
      selectedLedgerIds: ['55555555-5555-4555-8555-555555555555'],
    }))
  })

  it('removes a previously saved ledger from the replacement payload when deselected', async () => {
    render(<TdsComplianceMappingClient
      initialData={baseData({ configured: true })}
      returnTo="/dashboard"
    />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select TDS on Contractor' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm TDS mapping' }))

    await waitFor(() => expect(saveTdsComplianceMapping).toHaveBeenCalledWith(expect.objectContaining({
      selectedLedgerIds: [],
    })))
  })
})
