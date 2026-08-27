import { redirect } from 'next/navigation'
import { getCompanyContext, getOrganization, getTrialBalanceData } from '@/lib/data'
import { TrialBalance } from '@/components/trial-balance'
import { normalizePeriodQuery } from '@/lib/period'

export default async function TrialBalancePage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string }> }) {
  const params = await searchParams
  const period = normalizePeriodQuery(params.from, params.to)
  const asOf = period.to || period.from
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
    data = await getTrialBalanceData(company.id, undefined, asOf || undefined)
  }
  return <TrialBalance orgId={orgId} companyId={company.id} companyName={company.name} orgName={organization.name} data={data} asOf={asOf} />
}
