import { redirect } from 'next/navigation'
import { OperatingExpenditure } from './OperatingExpenditure'
import { getCompanyContext, getOperatingExpenditureReportData } from '@/lib/data'
import { normalizePeriodQuery } from '@/lib/period'
import { currentFinancialYear } from '@/lib/tds'
import { isMappingComplete } from '@/lib/compliance-data'

export default async function OperatingExpenditurePage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string }> }) {
  const params = await searchParams
  const period = normalizePeriodQuery(params.from, params.to)
  const financialYear = currentFinancialYear()
  const from = period.from || financialYear.from
  const to = period.to || financialYear.to

  const orgId = params.org
  const company = orgId && params.company ? await getCompanyContext(orgId, params.company) : null

  if (!orgId || !company) {
    const search = new URLSearchParams()
    if (orgId) search.set('org', orgId)
    redirect(`/dashboard?${search.toString()}`)
  }

  const isComplete = await isMappingComplete(orgId, company.id, 'OPEX')
  if (!isComplete) {
    const search = new URLSearchParams()
    search.set('org', orgId)
    search.set('company', company.id)
    search.set('type', 'OPEX')
    const returnUrl = `/dashboard/reports/operating-expenditure?org=${encodeURIComponent(orgId)}&company=${encodeURIComponent(company.id)}`
    search.set('returnTo', returnUrl)
    redirect(`/dashboard/compliance-mapping?${search.toString()}`)
  }

  let data = null
  if (period.isValid) {
    data = await getOperatingExpenditureReportData(company.id, from, to)
  }

  return <OperatingExpenditure orgId={orgId} companyId={company.id} companyName={company.name} data={data} from={from} to={to} />
}
