import { describe, expect, it } from 'vitest'
import { dashboardUrl, overviewUrl, queryString, workspaceSelectorUrl } from './dashboard-navigation'

describe('dashboard navigation', () => {
  it('builds canonical workspace URLs without empty query values', () => {
    expect(workspaceSelectorUrl('org 1')).toBe('/dashboard?org=org+1')
    expect(overviewUrl({ orgId: 'org-1', companyId: 'company-1', from: '', to: '2026-08-27' }))
      .toBe('/dashboard/overview?org=org-1&company=company-1&to=2026-08-27')
  })

  it('preserves workspace context and route-specific values', () => {
    expect(dashboardUrl(
      '/dashboard/reports/tds-report',
      { orgId: 'org-1', companyId: 'company-1', from: '2026-04-01', to: '2027-03-31' },
      { ledger: 'ledger-1', lockLedger: 'true' },
    )).toBe('/dashboard/reports/tds-report?org=org-1&company=company-1&from=2026-04-01&to=2027-03-31&ledger=ledger-1&lockLedger=true')
  })

  it('does not emit a trailing question mark', () => {
    expect(queryString({ org: null, company: undefined })).toBe('')
    expect(dashboardUrl('/dashboard')).toBe('/dashboard')
  })
})
