import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  isSuggestedTdsGroup,
  normalizeTdsName,
  resolveLedgerGroupParents,
  tdsLedgerSuggestion,
} from '@/lib/tds-mapping'
import type { TdsComplianceMappingData, TdsMappingGroup } from '@/lib/types'

const PAGE_SIZE = 1000

export async function getTdsComplianceMappingData(
  orgId: string,
  companyId: string,
): Promise<TdsComplianceMappingData> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Authentication required')

  const { data: membership, error: membershipError } = await supabase
    .from('tb_org_members')
    .select('org_id')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (membershipError || !membership) throw new Error('Organization membership required')

  const { data: company, error: companyError } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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

  const [profileResult, groupDecisionsResult, ledgerDecisionsResult] = await Promise.all([
    supabase
      .from('compliance_mapping_profiles')
      .select('id,status,confirmed_at')
      .eq('org_id', orgId)
      .eq('company_id', companyId)
      .eq('compliance_type', 'TDS')
      .maybeSingle(),
    supabase
      .from('compliance_group_decisions')
      .select('ledger_group_id,selected,suggested')
      .eq('org_id', orgId)
      .eq('company_id', companyId)
      .eq('compliance_type', 'TDS'),
    supabase
      .from('compliance_ledger_decisions')
      .select('ledger_id,selected,suggested,suggestion_reason')
      .eq('org_id', orgId)
      .eq('company_id', companyId)
      .eq('compliance_type', 'TDS'),
  ])
  const loadError = profileResult.error ?? groupDecisionsResult.error ?? ledgerDecisionsResult.error
  if (loadError) throw new Error(`Could not load TDS mappings: ${loadError.message}`)

  const savedGroups = new Map((groupDecisionsResult.data ?? []).map((item) => [item.ledger_group_id, item]))
  const savedLedgers = new Map((ledgerDecisionsResult.data ?? []).map((item) => [item.ledger_id, item]))
  const resolvedGroups = resolveLedgerGroupParents(ledgerGroups.map((group) => ({
    groupId: group.id,
    name: group.name,
    parentName: group.parent_name,
    parentGroupId: group.parent_group_id,
  })))
  const groupIdByName = new Map(resolvedGroups.map((group) => [normalizeTdsName(group.name), group.groupId]))
  const directLedgerCounts = new Map<string, number>()

  const resolvedLedgers = ledgers.map((ledger) => {
    const parentGroupId = ledger.parent_group_id && resolvedGroups.some((group) => group.groupId === ledger.parent_group_id)
      ? ledger.parent_group_id
      : groupIdByName.get(normalizeTdsName(ledger.parent_name)) ?? null
    if (parentGroupId) directLedgerCounts.set(parentGroupId, (directLedgerCounts.get(parentGroupId) ?? 0) + 1)
    return { ...ledger, parentGroupId }
  })

  const groups: TdsMappingGroup[] = resolvedGroups.map((group) => {
    const saved = savedGroups.get(group.groupId)
    const suggested = isSuggestedTdsGroup(group.name)
    return {
      ...group,
      selected: saved?.selected ?? suggested,
      suggested,
      directLedgerCount: directLedgerCounts.get(group.groupId) ?? 0,
    }
  })
  const suggestedGroupIds = new Set(groups.filter((group) => group.suggested).map((group) => group.groupId))
  let reviewRequiredCount = 0
  const mappingLedgers = resolvedLedgers.map((ledger) => {
    const saved = savedLedgers.get(ledger.id)
    const suggestion = tdsLedgerSuggestion(ledger.name, Boolean(ledger.parentGroupId && suggestedGroupIds.has(ledger.parentGroupId)))
    if (!saved && suggestion.suggested) reviewRequiredCount += 1
    return {
      ledgerId: ledger.id,
      ledgerName: ledger.name,
      parentName: ledger.parent_name?.trim() || 'Unassigned',
      parentGroupId: ledger.parentGroupId,
      selected: saved?.selected ?? suggestion.selected,
      suggested: suggestion.suggested,
      suggestionReason: saved?.suggestion_reason ?? suggestion.suggestionReason,
      hasSavedDecision: Boolean(saved),
    }
  })

  return {
    orgId,
    userId: user.id,
    company: {
      companyId: company.id,
      companyName: company.name,
      configured: profileResult.data?.status === 'complete',
      reviewRequiredCount,
      groups,
      ledgers: mappingLedgers,
    },
  }
}
