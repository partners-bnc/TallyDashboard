import { getDashboardData, listCompanies, listOrganizations } from '@/lib/data'
import { Dashboard } from '@/components/dashboard'

export default async function Home({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; from?: string; to?: string }> }) {
  const params = await searchParams
  const organizations = await listOrganizations()
  const organizationId = params.org && organizations.some((org) => org.id === params.org) ? params.org : undefined
  const companies = organizationId ? await listCompanies(organizationId) : []
  const companyId = params.company && companies.some((company) => company.id === params.company) ? params.company : undefined
  const data = companyId ? await getDashboardData(companyId, params.from, params.to) : null
  return <Dashboard organizations={organizations} companies={companies} selectedOrganizationId={organizationId ?? null} selectedCompanyId={companyId ?? null} data={data} from={params.from ?? ''} to={params.to ?? ''} />
}
