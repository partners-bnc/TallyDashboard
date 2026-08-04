import { redirect } from 'next/navigation'
import { getLedgerMonthlyData, listCompanies, listOrganizations } from '@/lib/data'
import { LedgerMonthly } from '@/components/trial-balance'
import { normalizePeriodQuery } from '@/lib/period'

export default async function LedgerMonthlyPage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; ledger?: string; from?: string; to?: string }> }) {
  const params = await searchParams
  const period = normalizePeriodQuery(params.from, params.to)
  const organizations = await listOrganizations()
  const orgId = params.org && organizations.some((org) => org.id === params.org) ? params.org : undefined
  const companies = orgId ? await listCompanies(orgId) : []
  const company = params.company ? companies.find((candidate) => candidate.id === params.company) : undefined
  if (!orgId || !company || !params.ledger) {
    const search = new URLSearchParams()
    if (orgId) search.set('org', orgId)
    redirect(`/dashboard?${search.toString()}`)
  }
  let data = null
  if (period.isValid) {
    try { data = await getLedgerMonthlyData(company.id, params.ledger, period.from || undefined, period.to || undefined) } catch { data = null }
  }
  return <LedgerMonthly orgId={orgId} companyId={company.id} data={data} from={period.from} to={period.to} />
}
