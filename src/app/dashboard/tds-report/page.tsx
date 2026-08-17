import { redirect } from 'next/navigation'
import { TdsReport } from '@/components/tds-report'
import { getTdsReportData, listCompanies, listOrganizations } from '@/lib/data'
import { normalizePeriodQuery } from '@/lib/period'
import { currentFinancialYear, isIsoDate } from '@/lib/tds'

export default async function TdsReportPage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string; asOf?: string }> }) {
  const params = await searchParams
  const period = normalizePeriodQuery(params.from, params.to)
  const financialYear = currentFinancialYear()
  const from = period.from || financialYear.from
  const to = period.to || financialYear.to
  const asOf = isIsoDate(params.asOf) ? params.asOf : to
  const organizations = await listOrganizations()
  const orgId = params.org && organizations.some((organization) => organization.id === params.org) ? params.org : undefined
  const companies = orgId ? await listCompanies(orgId) : []
  const company = params.company ? companies.find((candidate) => candidate.id === params.company) : undefined
  if (!orgId || !company) {
    const search = new URLSearchParams()
    if (orgId) search.set('org', orgId)
    redirect(`/dashboard?${search.toString()}`)
  }
  let data = null
  if (period.isValid && asOf >= from) {
    try { data = await getTdsReportData(company.id, from, to, asOf) } catch { data = null }
  }
  return <TdsReport orgId={orgId} companyId={company.id} companyName={company.name} data={data} from={from} to={to} asOf={asOf} />
}
