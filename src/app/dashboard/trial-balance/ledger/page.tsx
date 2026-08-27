import { redirect } from 'next/navigation'
import { getCompanyContext, getLedgerMonthlyData } from '@/lib/data'
import { LedgerMonthly } from '@/components/trial-balance'
import { normalizePeriodQuery } from '@/lib/period'

export default async function LedgerMonthlyPage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; ledger?: string; from?: string; to?: string }> }) {
  const params = await searchParams
  const period = normalizePeriodQuery(params.from, params.to)
  const orgId = params.org
  const company = orgId && params.company ? await getCompanyContext(orgId, params.company) : null
  if (!orgId || !company || !params.ledger) {
    const search = new URLSearchParams()
    if (orgId) search.set('org', orgId)
    redirect(`/dashboard?${search.toString()}`)
  }
  let data = null
  if (period.isValid) {
    data = await getLedgerMonthlyData(company.id, params.ledger, period.from || undefined, period.to || undefined)
  }
  return <LedgerMonthly orgId={orgId} companyId={company.id} data={data} from={period.from} to={period.to} />
}
