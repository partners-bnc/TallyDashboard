import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TdsReportData } from '@/lib/types'

const mocks = vi.hoisted(() => ({
  getCompanyContext: vi.fn(),
  getTdsReportData: vi.fn(),
  isTdsMappingComplete: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/data', () => ({ getCompanyContext: mocks.getCompanyContext, getTdsReportData: mocks.getTdsReportData }))
vi.mock('@/lib/compliance-data', () => ({ isTdsMappingComplete: mocks.isTdsMappingComplete }))
vi.mock('./TdsReport', () => ({ TdsReport: () => null }))

import TdsReportPage from './page'

const data = (from: string, to: string, latestActivityDate: string | null): TdsReportData => ({
  asOfDate: '2027-03-31',
  from,
  to,
  latestActivityDate,
  generatedAt: '2026-08-30T00:00:00.000Z',
  rows: [],
  kpis: { liabilityCreated: 0, deposited: 0, knockedOff: 0, remaining: 0, overdue: 0, clearedLate: 0, excess: 0 },
  ledgerOptions: [],
  ledgerPositions: [],
  reconciliation: [],
})

const renderPage = (params: { from?: string; to?: string } = {}) => TdsReportPage({
  searchParams: Promise.resolve({ org: 'org-1', company: 'company-1', ...params }),
})

describe('TDS report page period selection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-30T00:00:00Z'))
    mocks.getCompanyContext.mockResolvedValue({ id: 'company-1', name: 'Rajasthan' })
    mocks.isTdsMappingComplete.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('passes the latest-activity financial year to the report when URL dates are absent', async () => {
    mocks.getTdsReportData.mockResolvedValue(data('2024-04-01', '2025-03-31', '2025-03-20'))
    const result = await renderPage()

    expect(mocks.getTdsReportData).toHaveBeenCalledWith('company-1', '2026-04-01', '2027-03-31', '2027-03-31', { defaultToLatestActivity: true })
    expect(result.props).toMatchObject({ from: '2024-04-01', to: '2025-03-31' })
  })

  it.each([
    ['no activity', null],
    ['current-year activity', '2026-08-15'],
  ])('retains the current financial year for %s', async (_label, latestActivityDate) => {
    mocks.getTdsReportData.mockResolvedValue(data('2026-04-01', '2027-03-31', latestActivityDate))
    const result = await renderPage()

    expect(result.props).toMatchObject({ from: '2026-04-01', to: '2027-03-31' })
  })

  it('preserves explicit and partially explicit URL periods without automatic selection', async () => {
    mocks.getTdsReportData.mockImplementation(async (_companyId, from, to) => data(from, to, '2026-08-15'))

    const explicit = await renderPage({ from: '2024-07-01', to: '2025-01-31' })
    expect(explicit.props).toMatchObject({ from: '2024-07-01', to: '2025-01-31' })
    expect(mocks.getTdsReportData).toHaveBeenLastCalledWith('company-1', '2024-07-01', '2025-01-31', '2027-03-31', { defaultToLatestActivity: false })

    const partial = await renderPage({ from: '2024-07-01' })
    expect(partial.props).toMatchObject({ from: '2024-07-01', to: '2027-03-31' })
    expect(mocks.getTdsReportData).toHaveBeenLastCalledWith('company-1', '2024-07-01', '2027-03-31', '2027-03-31', { defaultToLatestActivity: false })
  })
})
