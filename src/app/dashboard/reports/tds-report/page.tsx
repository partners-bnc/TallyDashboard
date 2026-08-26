import { redirect } from 'next/navigation'
import { TdsReport } from './TdsReport'
import { getTdsReportData, listCompanies, listOrganizations } from '@/lib/data'
import { normalizePeriodQuery } from '@/lib/period'
import { currentFinancialYear, TDS_BOOKS_AS_OF_DATE } from '@/lib/tds'
import { isTdsMappingComplete } from '@/lib/compliance-data'

export default async function TdsReportPage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string; ledger?: string; lockLedger?: string }> }) {
  const params = await searchParams
  const period = normalizePeriodQuery(params.from, params.to)
  const financialYear = currentFinancialYear()
  const from = period.from || financialYear.from
  const to = period.to || financialYear.to
  const asOf = TDS_BOOKS_AS_OF_DATE
  const organizations = await listOrganizations()
  const orgId = params.org && organizations.some((organization) => organization.id === params.org) ? params.org : undefined
  const companies = orgId ? await listCompanies(orgId) : []
  const company = params.company ? companies.find((candidate) => candidate.id === params.company) : undefined
  
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
    const returnUrl = `/dashboard/reports/tds-report?org=${encodeURIComponent(orgId)}&company=${encodeURIComponent(company.id)}`
    search.set('returnTo', returnUrl)
    redirect(`/dashboard/compliance-mapping?${search.toString()}`)
  }

  let data = null
  if (period.isValid && asOf >= from) {
    try { 
      data = await getTdsReportData(company.id, from, to, asOf) 
    } catch (e) { 
      console.error("TdsReportPage: Failed to load TDS report data:", e)
      data = null 
    }
  }
  const lockLedger = params.lockLedger === 'true'
  const initialLedger = params.ledger && data?.ledgerOptions.some((option) => option.id === params.ledger) ? params.ledger : 'all'
  
  return <TdsReport orgId={orgId} companyId={company.id} companyName={company.name} data={data} from={from} to={to} asOf={asOf} initialLedger={initialLedger} lockLedger={lockLedger} />
}
