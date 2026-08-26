import { redirect } from 'next/navigation'
import { DutiesAndTaxesReport } from './DutiesAndTaxesReport'
import { listCompanies, listOrganizations } from '@/lib/data'
import { getGstReportData } from '@/lib/gst-data'
import { normalizePeriodQuery } from '@/lib/period'
import { currentFinancialYear } from '@/lib/tds'
import { isMappingComplete } from '@/lib/compliance-data'

import { createNeonDataApiClient } from '@/lib/neon/data-api'

export default async function DutiesAndTaxesPage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string }> }) {
  const params = await searchParams

  const organizations = await listOrganizations()
  const orgId = params.org && organizations.some((o) => o.id === params.org) ? params.org : undefined
  const companies = orgId ? await listCompanies(orgId) : []
  const company = params.company ? companies.find((c) => c.id === params.company) : undefined

  if (!orgId || !company) {
    const search = new URLSearchParams()
    if (orgId) search.set('org', orgId)
    redirect(`/dashboard?${search.toString()}`)
  }

  const client = createNeonDataApiClient()
  const { data: syncState } = await client
    .from('tb_company_sync_state')
    .select('history_baseline_date,history_latest_voucher_date')
    .eq('company_id', company.id)
    .maybeSingle()

  const defaultFrom = syncState?.history_baseline_date || currentFinancialYear().from
  const defaultTo = syncState?.history_latest_voucher_date || currentFinancialYear().to

  const period = normalizePeriodQuery(params.from, params.to)
  const from = period.from || defaultFrom
  const to = period.to || defaultTo

  const isComplete = await isMappingComplete(orgId, company.id, 'GST')
  if (!isComplete) {
    const search = new URLSearchParams()
    search.set('org', orgId)
    search.set('company', company.id)
    search.set('type', 'GST')
    const returnUrl = `/dashboard/reports/duties-and-taxes?org=${encodeURIComponent(orgId)}&company=${encodeURIComponent(company.id)}`
    search.set('returnTo', returnUrl)
    redirect(`/dashboard/compliance-mapping?${search.toString()}`)
  }

  let data = null
  if (period.isValid) {
    try {
      data = await getGstReportData(company.id, from, to)
    } catch (e) {
      console.error('DutiesAndTaxesPage: Failed to load data:', e)
      data = null
    }
  }

  return <DutiesAndTaxesReport orgId={orgId} companyId={company.id} companyName={company.name} data={data} from={from} to={to} />
}
