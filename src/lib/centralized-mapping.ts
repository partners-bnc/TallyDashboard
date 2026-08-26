import 'server-only'

import { createNeonDataApiClient } from '@/lib/neon/data-api'
import { resolveLedgerGroupParents, normalizeTdsName } from '@/lib/tds-mapping'

export interface ComplianceMappingConfig {
  complianceType: string
  title: string
  description: string
  autoSuggestGroup: (name: string) => boolean
  defaultCategory: string
}

export async function resolveActiveLedgers(companyId: string, complianceType: string) {
  const client = createNeonDataApiClient()

  // 1. Fetch mapping profile
  const { data: profile } = await client
    .from('compliance_mapping_profiles')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('compliance_type', complianceType)
    .maybeSingle()

  if (!profile || profile.status !== 'complete') {
    return { activeLedgerIds: new Set<string>(), ledgerCategories: new Map<string, string>() }
  }

  // 2. Fetch group decisions
  const { data: groupDecisions } = await client
    .from('compliance_group_decisions')
    .select('group_name')
    .eq('profile_id', profile.id)
    .eq('selected', true)

  const selectedGroupNames = new Set((groupDecisions ?? []).map((g) => normalizeTdsName(g.group_name)))

  // 3. Fetch ledger decisions (overrides)
  const { data: ledgerDecisions } = await client
    .from('compliance_ledger_decisions')
    .select('ledger_id, selected, category')
    .eq('profile_id', profile.id)

  const deselectedLedgerIds = new Set<string>()
  const forcedLedgerIds = new Set<string>()
  const ledgerCategories = new Map<string, string>()

  for (const decision of ledgerDecisions ?? []) {
    if (decision.selected) {
      forcedLedgerIds.add(decision.ledger_id)
    } else {
      deselectedLedgerIds.add(decision.ledger_id)
    }
    if (decision.category) {
      ledgerCategories.set(decision.ledger_id, decision.category)
    }
  }

  // 4. Fetch all groups and ledgers to resolve hierarchy
  const { data: dbGroups } = await client
    .from('tb_ledger_groups')
    .select('id, name, parent_name, parent_group_id')
    .eq('company_id', companyId)
    .eq('is_deleted', false)

  const { data: dbLedgers } = await client
    .from('tb_ledgers')
    .select('id, name, parent_name, parent_group_id')
    .eq('company_id', companyId)
    .eq('is_deleted', false)

  const groups = resolveLedgerGroupParents((dbGroups ?? []).map((g) => ({
    groupId: g.id,
    name: g.name,
    parentName: g.parent_name,
    parentGroupId: g.parent_group_id,
  })))

  // Build recursive children map
  const childGroupIdsMap = new Map<string, string[]>()
  for (const group of groups) {
    if (group.parentGroupId) {
      const list = childGroupIdsMap.get(group.parentGroupId) ?? []
      list.push(group.groupId)
      childGroupIdsMap.set(group.parentGroupId, list)
    }
  }

  // Helper to recursively collect all descendant group IDs
  const collectDescendants = (groupId: string, resultSet: Set<string>) => {
    resultSet.add(groupId)
    const children = childGroupIdsMap.get(groupId) ?? []
    for (const childId of children) {
      if (!resultSet.has(childId)) {
        collectDescendants(childId, resultSet)
      }
    }
  }

  // Helper to check if a group has any descendant explicitly selected in selectedGroupNames
  const hasSelectedChild = (groupId: string): boolean => {
    const children = childGroupIdsMap.get(groupId) ?? []
    for (const childId of children) {
      const childGroup = groups.find(g => g.groupId === childId)
      if (childGroup && selectedGroupNames.has(normalizeTdsName(childGroup.name))) {
        return true
      }
      if (hasSelectedChild(childId)) {
        return true
      }
    }
    return false
  }

  // Find all group IDs that are selected (matching by normalized name)
  const activeGroupIds = new Set<string>()
  for (const group of groups) {
    if (selectedGroupNames.has(normalizeTdsName(group.name))) {
      activeGroupIds.add(group.groupId)
      
      // If this group has subgroup decisions explicitly saved in the DB,
      // we do NOT do recursive downward collection. Otherwise, we do (for backwards compatibility).
      if (!hasSelectedChild(group.groupId)) {
        collectDescendants(group.groupId, activeGroupIds)
      }
    }
  }

  // Map ledger parent groups
  const groupIdsSet = new Set(groups.map((g) => g.groupId))
  const resolvedLedgers = (dbLedgers ?? []).map((ledger) => {
    const parentGroupId = ledger.parent_group_id && groupIdsSet.has(ledger.parent_group_id)
      ? ledger.parent_group_id
      : groups.find((g) => normalizeTdsName(g.name) === normalizeTdsName(ledger.parent_name))?.groupId ?? null
    return { ...ledger, resolvedParentGroupId: parentGroupId }
  })

  // Resolve active ledger IDs
  const activeLedgerIds = new Set<string>()
  for (const ledger of resolvedLedgers) {
    if (deselectedLedgerIds.has(ledger.id)) {
      continue
    }
    if (forcedLedgerIds.has(ledger.id)) {
      activeLedgerIds.add(ledger.id)
      continue
    }
    if (ledger.resolvedParentGroupId && activeGroupIds.has(ledger.resolvedParentGroupId)) {
      activeLedgerIds.add(ledger.id)
    }
  }

  return { activeLedgerIds, ledgerCategories }
}

export interface CentralizedMappingData {
  orgId: string
  userId: string
  company: {
    companyId: string
    companyName: string
    configured: boolean
    groups: Array<{
      groupId: string
      name: string
      parentName: string | null
      parentGroupId: string | null
      selected: boolean
      autoSuggested: boolean
    }>
    ledgers: Array<{
      ledgerId: string
      ledgerName: string
      parentName: string | null
      parentGroupId: string | null
      selected: boolean
      category: string | null
    }>
  }
}

export async function getCentralizedMappingData(
  orgId: string,
  companyId: string,
  config: ComplianceMappingConfig,
): Promise<CentralizedMappingData> {
  const client = createNeonDataApiClient()

  const { data: dbGroups } = await client
    .from('tb_ledger_groups')
    .select('id, name, parent_name, parent_group_id')
    .eq('company_id', companyId)
    .eq('is_deleted', false)

  const { data: dbLedgers } = await client
    .from('tb_ledgers')
    .select('id, name, parent_name, parent_group_id')
    .eq('company_id', companyId)
    .eq('is_deleted', false)

  const { data: dbCompany } = await client
    .from('tb_companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle()

  const groups = resolveLedgerGroupParents((dbGroups ?? []).map((g) => ({
    groupId: g.id,
    name: g.name,
    parentName: g.parent_name,
    parentGroupId: g.parent_group_id,
  })))

  // Load existing decisions
  const { data: profile } = await client
    .from('compliance_mapping_profiles')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('compliance_type', config.complianceType)
    .maybeSingle()

  const configured = profile?.status === 'complete'

  const selectedGroupNames = new Set<string>()
  const ledgerDecisions = new Map<string, { selected: boolean; category: string | null }>()

  if (profile) {
    const { data: groupDecisions } = await client
      .from('compliance_group_decisions')
      .select('group_name, selected')
      .eq('profile_id', profile.id)

    for (const gd of groupDecisions ?? []) {
      if (gd.selected) {
        selectedGroupNames.add(normalizeTdsName(gd.group_name))
      }
    }

    const { data: ldDecisions } = await client
      .from('compliance_ledger_decisions')
      .select('ledger_id, selected, category')
      .eq('profile_id', profile.id)

    for (const ld of ldDecisions ?? []) {
      ledgerDecisions.set(ld.ledger_id, { selected: ld.selected, category: ld.category })
    }
  }

  // Resolve active groups/ledgers
  const resolvedGroups = groups.map((g) => {
    const autoSuggested = config.autoSuggestGroup(g.name)
    const selected = configured ? selectedGroupNames.has(normalizeTdsName(g.name)) : autoSuggested
    return {
      groupId: g.groupId,
      name: g.name,
      parentName: g.parentName,
      parentGroupId: g.parentGroupId,
      selected,
      autoSuggested,
    }
  })

  // Build recursive parent map to know if a ledger's parent group (or grandparent) is active
  const activeGroupIds = new Set<string>(
    resolvedGroups.filter((rg) => rg.selected).map((rg) => rg.groupId),
  )

  const childGroupIdsMap = new Map<string, string[]>()
  for (const group of resolvedGroups) {
    if (group.parentGroupId) {
      const list = childGroupIdsMap.get(group.parentGroupId) ?? []
      list.push(group.groupId)
      childGroupIdsMap.set(group.parentGroupId, list)
    }
  }

  const collectDescendants = (groupId: string, resultSet: Set<string>) => {
    resultSet.add(groupId)
    const children = childGroupIdsMap.get(groupId) ?? []
    for (const childId of children) {
      if (!resultSet.has(childId)) {
        collectDescendants(childId, resultSet)
      }
    }
  }

  const recursiveActiveGroupIds = new Set<string>()
  for (const groupId of activeGroupIds) {
    collectDescendants(groupId, recursiveActiveGroupIds)
  }

  const groupIdsSet = new Set(groups.map((g) => g.groupId))
  const resolvedLedgers = (dbLedgers ?? []).map((ledger) => {
    const parentGroupId = ledger.parent_group_id && groupIdsSet.has(ledger.parent_group_id)
      ? ledger.parent_group_id
      : groups.find((g) => normalizeTdsName(g.name) === normalizeTdsName(ledger.parent_name))?.groupId ?? null

    const decision = ledgerDecisions.get(ledger.id)
    const inActiveGroup = parentGroupId ? recursiveActiveGroupIds.has(parentGroupId) : false
    const selected = decision ? decision.selected : (configured ? false : inActiveGroup)
    const category = decision?.category ?? (selected ? config.defaultCategory : null)

    return {
      ledgerId: ledger.id,
      ledgerName: ledger.name,
      parentName: ledger.parent_name,
      parentGroupId,
      selected,
      category,
    }
  })

  const { auth } = await import('@/lib/auth/server')
  const { data: session } = await auth.getSession()

  return {
    orgId,
    userId: session?.user?.id ?? '',
    company: {
      companyId,
      companyName: dbCompany?.name ?? 'Company',
      configured,
      groups: resolvedGroups,
      ledgers: resolvedLedgers,
    },
  }
}
