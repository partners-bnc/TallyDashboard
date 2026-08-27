import { redirect } from 'next/navigation'
import { getCompanyContext, getFundsFlowData, getOrganization } from '@/lib/data'
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
  if (period.isValid) {
    data = await getFundsFlowData(company.id, period.from || undefined, period.to || undefined)
  }

  return (
    <FundsFlow 
      orgId={orgId} 
      companyId={company.id} 
      companyName={company.name} 
      orgName={organization.name}
      data={data} 
      from={period.from} 
      to={period.to} 
    />
  )
}
