import { redirect } from 'next/navigation'
import { PromotersReport } from './PromotersReport'
import { getPromotersReportData, listCompanies, listOrganizations } from '@/lib/data'
import { normalizePeriodQuery } from '@/lib/period'
import { currentFinancialYear } from '@/lib/tds'
import { isMappingComplete } from '@/lib/compliance-data'

export default async function PromotersReportPage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string }> }) {
  const params = await searchParams
  const period = normalizePeriodQuery(params.from, params.to)
  const financialYear = currentFinancialYear()
  const from = period.from || financialYear.from
  const to = period.to || financialYear.to
  
  const organizations = await listOrganizations()
  const orgId = params.org && organizations.some((organization) => organization.id === params.org) ? params.org : undefined
  const companies = orgId ? await listCompanies(orgId) : []
  const company = params.company ? companies.find((candidate) => candidate.id === params.company) : undefined
  
  if (!orgId || !company) {
    const search = new URLSearchParams()
    if (orgId) search.set('org', orgId)
    redirect(`/dashboard?${search.toString()}`)
  }

  // Check if mapping is complete. If not, redirect to Promoters mapping wizard page.
  const isComplete = await isMappingComplete(orgId, company.id, 'PROMOTERS')
  if (!isComplete) {
    const search = new URLSearchParams()
    search.set('org', orgId)
    search.set('company', company.id)
    search.set('type', 'PROMOTERS')
    const returnUrl = `/dashboard/reports/promoters-report?org=${encodeURIComponent(orgId)}&company=${encodeURIComponent(company.id)}`
    search.set('returnTo', returnUrl)
    redirect(`/dashboard/compliance-mapping?${search.toString()}`)
  }

  let data = null
  if (period.isValid) {
    try { 
      data = await getPromotersReportData(company.id, from, to) 
    } catch (e) { 
      console.error("PromotersReportPage: Failed to load Promoters report data:", e)
      data = null 
    }
  }
  
  return <PromotersReport orgId={orgId} companyId={company.id} companyName={company.name} data={data} from={from} to={to} />
}
