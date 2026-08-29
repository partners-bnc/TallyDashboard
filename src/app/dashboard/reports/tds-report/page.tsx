import { redirect } from 'next/navigation'
import { TdsReport } from './TdsReport'
import { getCompanyContext, getTdsReportData } from '@/lib/data'
import { normalizePeriodQuery } from '@/lib/period'
import { currentFinancialYear, TDS_BOOKS_AS_OF_DATE } from '@/lib/tds'
import { isTdsMappingComplete } from '@/lib/compliance-data'
import { dashboardUrl } from '@/lib/dashboard-navigation'

export default async function TdsReportPage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string; ledger?: string; lockLedger?: string }> }) {
  const params = await searchParams
  const period = normalizePeriodQuery(params.from, params.to)
  const financialYear = currentFinancialYear()
  const from = period.from || financialYear.from
  const to = period.to || financialYear.to
  const asOf = TDS_BOOKS_AS_OF_DATE
  const orgId = params.org
  const company = orgId && params.company ? await getCompanyContext(orgId, params.company) : null
  
  if (!orgId || !company) {
    const search = new URLSearchParams()
    if (orgId) search.set('org', orgId)
    redirect(`/dashboard?${search.toString()}`)
  }

  // Check if mapping is complete. If not, redirect to compliance mapping page.
  const isComplete = await isTdsMappingComplete(orgId, company.id)
  if (!isComplete) {
    const search = new URLSearchParams()
    search.set('org', orgId)
    search.set('company', company.id)
    const returnUrl = dashboardUrl(
      '/dashboard/reports/tds-report',
      { orgId, companyId: company.id, from: params.from, to: params.to },
      { ledger: params.ledger, lockLedger: params.lockLedger },
    )
    search.set('returnTo', returnUrl)
    redirect(`/dashboard/compliance-mapping?${search.toString()}`)
  }

  let data = null
  if (period.isValid && asOf >= from) {
    data = await getTdsReportData(company.id, from, to, asOf)
  }
  const lockLedger = params.lockLedger === 'true'
  const initialLedger = params.ledger && data?.ledgerOptions.some((option) => option.id === params.ledger) ? params.ledger : 'all'
  
  return <TdsReport orgId={orgId} companyId={company.id} companyName={company.name} data={data} from={from} to={to} asOf={asOf} initialLedger={initialLedger} lockLedger={lockLedger} />
}
