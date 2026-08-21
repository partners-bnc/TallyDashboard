import { redirect } from 'next/navigation'
import { getTdsComplianceMappingData } from '@/lib/compliance-data'
import { TdsComplianceMappingClient } from './tds-compliance-mapping-client'

export default async function TdsComplianceMappingPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; company?: string; returnTo?: string }>
}) {
  const params = await searchParams
  if (!params.org || !params.company) redirect('/dashboard')
  const data = await getTdsComplianceMappingData(params.org, params.company)
  const returnTo = params.returnTo?.startsWith('/dashboard')
    && !params.returnTo.startsWith('/dashboard/compliance-mapping')
    ? params.returnTo
    : `/dashboard?org=${encodeURIComponent(params.org)}&company=${encodeURIComponent(params.company)}`
  return <TdsComplianceMappingClient initialData={data} returnTo={returnTo} />
}
