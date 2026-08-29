import { redirect } from 'next/navigation'
import { listCompanies, listOrganizations } from '@/lib/data'
import { DashboardSelector } from '@/components/dashboard-selector'
import { overviewUrl } from '@/lib/dashboard-navigation'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string }> }) {
  const params = await searchParams
  const [organizations, requestedCompanies] = await Promise.all([
    listOrganizations(),
    params.org ? listCompanies(params.org) : Promise.resolve([]),
  ])
  const organizationId = params.org && organizations.some((org) => org.id === params.org) ? params.org : undefined
  const companies = organizationId ? requestedCompanies : []
  const companyId = params.company && companies.some((company) => company.id === params.company) ? params.company : undefined

  // If company context is already selected, redirect to the overview page
  if (organizationId && companyId) {
    redirect(overviewUrl({ orgId: organizationId, companyId, from: params.from, to: params.to }))
  }

  return (
    <DashboardSelector 
      organizations={organizations} 
      companies={companies} 
      selectedOrganizationId={organizationId ?? null} 
      selectedCompanyId={companyId ?? null} 
    />
  )
}
