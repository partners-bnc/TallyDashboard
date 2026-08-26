import 'server-only'

import { auth } from '@/lib/auth/server'
import { createNeonDataApiClient } from '@/lib/neon/data-api'

export async function isMappingComplete(orgId: string, companyId: string, complianceType: string) {
  const client = createNeonDataApiClient()
  const { data: session, error: sessionError } = await auth.getSession()
  const user = session?.user
  if (sessionError || !user) throw new Error('Authentication required')

  const [membershipResult, companyResult, profileResult] = await Promise.all([
    client
      .from('tb_org_members')
      .select('org_id')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle(),
    client
      .from('tb_companies')
      .select('id')
      .eq('id', companyId)
      .eq('org_id', orgId)
      .eq('is_active', true)
      .maybeSingle(),
    client
      .from('compliance_mapping_profiles')
      .select('status')
      .eq('org_id', orgId)
      .eq('company_id', companyId)
      .eq('compliance_type', complianceType)
      .maybeSingle(),
  ])

  if (membershipResult.error) {
    throw new Error(`Membership query failed: ${membershipResult.error.message}`)
  }
  if (!membershipResult.data) {
    throw new Error('Organization membership required')
  }
  if (companyResult.error) {
    throw new Error(`Company query failed: ${companyResult.error.message}`)
  }
  if (!companyResult.data) {
    throw new Error(`The selected company (${companyId}) is not available in organization (${orgId})`)
  }
  if (profileResult.error) {
    throw new Error(`Could not load ${complianceType} mapping status: ${profileResult.error.message}`)
  }
  return profileResult.data?.status === 'complete'
}

export async function isTdsMappingComplete(orgId: string, companyId: string) {
  return isMappingComplete(orgId, companyId, 'TDS')
}
