import { redirect } from 'next/navigation'
import { listCompanies, listOrganizations } from '@/lib/data'
import { DashboardSelector } from '@/components/dashboard-selector'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string }> }) {
  const params = await searchParams
  const organizations = await listOrganizations()
  const organizationId = params.org && organizations.some((org) => org.id === params.org) ? params.org : undefined
  const companies = organizationId ? await listCompanies(organizationId) : []
  const companyId = params.company && companies.some((company) => company.id === params.company) ? params.company : undefined

  // If company context is already selected, redirect to the overview page
  if (organizationId && companyId) {
    const search = new URLSearchParams()
    search.set('org', organizationId)
    search.set('company', companyId)
    if (params.from) search.set('from', params.from)
    if (params.to) search.set('to', params.to)
    redirect(`/dashboard/overview?${search.toString()}`)
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
