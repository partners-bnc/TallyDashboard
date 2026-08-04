import { redirect } from 'next/navigation'
import { getDashboardData, listCompanies, listOrganizations } from '@/lib/data'
import { Dashboard } from '@/components/dashboard'
import { normalizePeriodQuery } from '@/lib/period'

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string }> }) {
  const params = await searchParams
  const period = normalizePeriodQuery(params.from, params.to)
  const organizations = await listOrganizations()
  const organizationId = params.org && organizations.some((org) => org.id === params.org) ? params.org : undefined
  const companies = organizationId ? await listCompanies(organizationId) : []
  const companyId = params.company && companies.some((company) => company.id === params.company) ? params.company : undefined

  // If company context is missing or invalid, redirect to onboarding selector
  if (!organizationId || !companyId) {
    const search = new URLSearchParams()
    if (organizationId) search.set('org', organizationId)
    redirect(`/dashboard?${search.toString()}`)
  }

  const data = period.isValid ? await getDashboardData(companyId, period.from || undefined, period.to || undefined) : null

  return (
    <Dashboard 
      organizations={organizations} 
      companies={companies} 
      selectedOrganizationId={organizationId} 
      selectedCompanyId={companyId} 
      data={data} 
      from={period.from}
      to={period.to}
    />
  )
}
