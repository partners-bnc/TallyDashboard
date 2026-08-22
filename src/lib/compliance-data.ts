import 'server-only'

import { auth } from '@/lib/auth/server'
import { createNeonDataApiClient } from '@/lib/neon/data-api'
import {
  isPayableTdsCandidate,
  isInitiallySelectedTdsCandidate,
  isTdsGroupName,
  normalizeTdsName,
  resolveLedgerGroupParents,
  tdsHierarchyGroupIds,
} from '@/lib/tds-mapping'
import type { TdsComplianceMappingData, TdsMappingGroup } from '@/lib/types'

const PAGE_SIZE = 1000

export async function isTdsMappingComplete(orgId: string, companyId: string) {
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
      .eq('compliance_type', 'TDS')
      .maybeSingle(),
  ])

  if (membershipResult.error || !membershipResult.data) {
    throw new Error('Organization membership required')
  }
  if (companyResult.error || !companyResult.data) {
    throw new Error('The selected company is not available in this workspace')
  }
  if (profileResult.error) {
    throw new Error(`Could not load TDS mapping status: ${profileResult.error.message}`)
  }
  return profileResult.data?.status === 'complete'
}

export async function getTdsComplianceMappingData(
  orgId: string,
  companyId: string,
): Promise<TdsComplianceMappingData> {
  const client = createNeonDataApiClient()
  const { data: session, error: sessionError } = await auth.getSession()
  const user = session?.user
  if (sessionError || !user) throw new Error('Authentication required')

  const { data: membership, error: membershipError } = await client
    .from('tb_org_members')
    .select('org_id')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (membershipError || !membership) throw new Error('Organization membership required')

  const { data: company, error: companyError } = await client
    .from('tb_companies')
    .select('id,name')
    .eq('id', companyId)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .maybeSingle()
  if (companyError || !company) throw new Error('The selected company is not available in this workspace')

  const ledgers: Array<{
    id: string
    name: string
    parent_name: string | null
    parent_group_id: string | null
  }> = []
  const ledgerGroups: Array<{
    id: string
    name: string
    parent_name: string | null
    parent_group_id: string | null
  }> = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('tb_ledgers')
      .select('id,name,parent_name,parent_group_id')
      .eq('org_id', orgId)
      .eq('company_id', companyId)
      .eq('is_deleted', false)
      .order('name')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Could not load ledgers: ${error.message}`)
    ledgers.push(...(data ?? []))
    if ((data?.length ?? 0) < PAGE_SIZE) break
  }

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('tb_ledger_groups')
      .select('id,name,parent_name,parent_group_id')
      .eq('org_id', orgId)
      .eq('company_id', companyId)
      .eq('is_deleted', false)
      .order('name')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Could not load ledger groups: ${error.message}`)
    ledgerGroups.push(...(data ?? []))
    if ((data?.length ?? 0) < PAGE_SIZE) break
  }

  const [profileResult, mappingsResult] = await Promise.all([
    client
      .from('compliance_mapping_profiles')
      .select('status')
      .eq('org_id', orgId)
      .eq('company_id', companyId)
      .eq('compliance_type', 'TDS')
      .maybeSingle(),
    client
      .from('tds_ledger_mappings')
      .select('ledger_id')
      .eq('org_id', orgId)
      .eq('company_id', companyId)
      .eq('is_payable_ledger', true),
  ])
  const loadError = profileResult.error ?? mappingsResult.error
  if (loadError) throw new Error(`Could not load TDS mappings: ${loadError.message}`)

  const configured = profileResult.data?.status === 'complete'
  const savedLedgerIds = new Set((mappingsResult.data ?? []).map((mapping) => mapping.ledger_id))
  const resolvedGroups = resolveLedgerGroupParents(ledgerGroups.map((group) => ({
    groupId: group.id,
    name: group.name,
    parentName: group.parent_name,
    parentGroupId: group.parent_group_id,
  })))
  const groupIdByName = new Map(resolvedGroups.map((group) => [normalizeTdsName(group.name), group.groupId]))
  const resolvedGroupIds = new Set(resolvedGroups.map((group) => group.groupId))
  const hierarchyIds = tdsHierarchyGroupIds(resolvedGroups)
  const directLedgerCounts = new Map<string, number>()

  const resolvedLedgers = ledgers.map((ledger) => {
    const parentGroupId = ledger.parent_group_id && resolvedGroupIds.has(ledger.parent_group_id)
      ? ledger.parent_group_id
      : groupIdByName.get(normalizeTdsName(ledger.parent_name)) ?? null
    return { ...ledger, parentGroupId }
  })

  const candidates = resolvedLedgers
    .filter((ledger) => isPayableTdsCandidate({
      ledgerName: ledger.name,
      parentGroupId: ledger.parentGroupId,
    }, hierarchyIds))
    .map((ledger) => {
      if (ledger.parentGroupId) {
        directLedgerCounts.set(ledger.parentGroupId, (directLedgerCounts.get(ledger.parentGroupId) ?? 0) + 1)
      }
      return {
        ledgerId: ledger.id,
        ledgerName: ledger.name,
        parentName: ledger.parent_name?.trim() || 'TDS',
        parentGroupId: ledger.parentGroupId,
        selected: isInitiallySelectedTdsCandidate(ledger.id, configured, savedLedgerIds),
      }
    })

  const groups: TdsMappingGroup[] = resolvedGroups
    .filter((group) => hierarchyIds.has(group.groupId))
    .map((group) => ({
      ...group,
      directLedgerCount: directLedgerCounts.get(group.groupId) ?? 0,
      isTdsRoot: isTdsGroupName(group.name),
    }))

  return {
    orgId,
    userId: user.id,
    company: {
      companyId: company.id,
      companyName: company.name,
      configured,
      tdsGroupFound: groups.some((group) => group.isTdsRoot),
      groups,
      ledgers: candidates,
    },
  }
}
