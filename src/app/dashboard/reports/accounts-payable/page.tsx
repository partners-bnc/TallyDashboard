import { redirect } from 'next/navigation'
import { AccountsPayable } from './AccountsPayable'
import { getAccountsPayableData, listCompanies, listOrganizations } from '@/lib/data'
import { normalizePeriodQuery } from '@/lib/period'
import { currentFinancialYear } from '@/lib/tds'
import { isMappingComplete } from '@/lib/compliance-data'

export default async function AccountsPayablePage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string }> }) {
  const params = await searchParams
  const period = normalizePeriodQuery(params.from, params.to)
  const financialYear = currentFinancialYear()
  const from = period.from || financialYear.from
  const to = period.to || financialYear.to

  const organizations = await listOrganizations()
  const orgId = params.org && organizations.some((o) => o.id === params.org) ? params.org : undefined
  const companies = orgId ? await listCompanies(orgId) : []
  const company = params.company ? companies.find((c) => c.id === params.company) : undefined

  if (!orgId || !company) {
    const search = new URLSearchParams()
    if (orgId) search.set('org', orgId)
    redirect(`/dashboard?${search.toString()}`)
  }

  const isComplete = await isMappingComplete(orgId, company.id, 'ACCOUNTS_PAYABLE')
  if (!isComplete) {
    const search = new URLSearchParams()
    search.set('org', orgId)
    search.set('company', company.id)
    search.set('type', 'ACCOUNTS_PAYABLE')
    const returnUrl = `/dashboard/reports/accounts-payable?org=${encodeURIComponent(orgId)}&company=${encodeURIComponent(company.id)}`
    search.set('returnTo', returnUrl)
    redirect(`/dashboard/compliance-mapping?${search.toString()}`)
  }

  let data = null
  if (period.isValid) {
    try {
      data = await getAccountsPayableData(company.id, from, to)
    } catch (e) {
      console.error('AccountsPayablePage: Failed to load data:', e)
      data = null
    }
  }

  return <AccountsPayable orgId={orgId} companyId={company.id} companyName={company.name} data={data} from={from} to={to} />
}
