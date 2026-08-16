import { redirect } from 'next/navigation'
import { getFundsFlowData, listCompanies, listOrganizations } from '@/lib/data'
import { FundsFlow } from '@/components/funds-flow'
import { normalizePeriodQuery } from '@/lib/period'

export default async function FundsFlowPage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string }> }) {
  const params = await searchParams
  const period = normalizePeriodQuery(params.from, params.to)
  const organizations = await listOrganizations()
  const orgId = params.org && organizations.some((org) => org.id === params.org) ? params.org : undefined
  const companies = orgId ? await listCompanies(orgId) : []
  const company = params.company ? companies.find((candidate) => candidate.id === params.company) : undefined

  if (!orgId || !company) {
    const search = new URLSearchParams()
    if (orgId) search.set('org', orgId)
    redirect(`/dashboard?${search.toString()}`)
  }

  let data = null
  if (period.isValid) {
    try { 
      data = await getFundsFlowData(company.id, period.from || undefined, period.to || undefined) 
    } catch (e) { 
      data = null 
    }
  }

  return (
    <FundsFlow 
      orgId={orgId} 
      companyId={company.id} 
      companyName={company.name} 
      orgName={organizations.find((org) => org.id === orgId)?.name ?? ''} 
      data={data} 
      from={period.from} 
      to={period.to} 
    />
  )
}
