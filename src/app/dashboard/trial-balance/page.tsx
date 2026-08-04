import { redirect } from 'next/navigation'
import { getTrialBalanceData, listCompanies, listOrganizations } from '@/lib/data'
import { TrialBalance } from '@/components/trial-balance'
import { normalizePeriodQuery } from '@/lib/period'

export default async function TrialBalancePage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string }> }) {
  const params = await searchParams
  const period = normalizePeriodQuery(params.from, params.to)
  const asOf = period.to || period.from
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
    try { data = await getTrialBalanceData(company.id, undefined, asOf || undefined) } catch { data = null }
  }
  return <TrialBalance orgId={orgId} companyId={company.id} companyName={company.name} orgName={organizations.find((org) => org.id === orgId)?.name ?? ''} data={data} asOf={asOf} />
}
