import { redirect } from 'next/navigation'
import { getCompanyContext, getFundsFlowData, getOrganization, getDetailedFundsFlowReportData } from '@/lib/data'
import { FundsFlow } from '@/components/funds-flow'
import { normalizePeriodQuery } from '@/lib/period'

export default async function FundsFlowPage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string }> }) {
  const params = await searchParams
  const period = normalizePeriodQuery(params.from, params.to)
  const orgId = params.org
  const [organization, company] = orgId && params.company
    ? await Promise.all([getOrganization(orgId), getCompanyContext(orgId, params.company)])
    : [null, null]

  if (!orgId || !organization || !company) {
    const search = new URLSearchParams()
    if (orgId) search.set('org', orgId)
    redirect(`/dashboard?${search.toString()}`)
  }

  let data = null
  let detailedData = null
  if (period.isValid) {
    const fromVal = period.from || undefined
    const toVal = period.to || undefined
    const [res1, res2] = await Promise.all([
      getFundsFlowData(company.id, fromVal, toVal),
      getDetailedFundsFlowReportData(company.id, fromVal, toVal),
    ])
    data = res1
    detailedData = res2
  }

  return (
    <FundsFlow 
      orgId={orgId} 
      companyId={company.id} 
      companyName={company.name} 
      orgName={organization.name}
      data={data} 
      detailedData={detailedData}
      from={period.from || ''} 
      to={period.to || ''} 
    />
  )
}
