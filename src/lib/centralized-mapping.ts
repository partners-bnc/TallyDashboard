import 'server-only'

import { createNeonDataApiClient } from '@/lib/neon/data-api'
import { resolveLedgerGroupParents, normalizeTdsName } from '@/lib/tds-mapping'
import type { Json } from '@/lib/types'

type StoredLedgerDecision = {
  ledger_id: string
  selected: boolean
  category: string | null
}

function parseStoredLedgerDecisions(value: Json): StoredLedgerDecision[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return []

    const ledgerId = candidate.ledger_id
    const selected = candidate.selected
    const category = candidate.category
    if (typeof ledgerId !== 'string' || typeof selected !== 'boolean') return []
    if (category !== null && category !== undefined && typeof category !== 'string') return []

    return [{ ledger_id: ledgerId, selected, category: category ?? null }]
  })
}

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
    .select('id, status, selected_groups, ledger_decisions')
    .eq('company_id', companyId)
    .eq('compliance_type', complianceType)
    .maybeSingle()

  if (!profile || profile.status !== 'complete') {
    return { activeLedgerIds: new Set<string>(), ledgerCategories: new Map<string, string>() }
  }

  if (complianceType === 'TDS') {
    const { data: mappings, error } = await client
      .from('tds_ledger_mappings')
      .select('ledger_id')
      .eq('company_id', companyId)
      .eq('is_payable_ledger', true)

    if (error) throw new Error(`Could not load TDS ledger mappings: ${error.message}`)

    return {
      activeLedgerIds: new Set((mappings ?? []).map((mapping) => mapping.ledger_id)),
      ledgerCategories: new Map<string, string>(),
    }
  }

  const selectedGroupNames = new Set(profile.selected_groups.map(normalizeTdsName))
  const ledgerDecisions = parseStoredLedgerDecisions(profile.ledger_decisions)

  const deselectedLedgerIds = new Set<string>()
  const forcedLedgerIds = new Set<string>()
  const ledgerCategories = new Map<string, string>()

  for (const decision of ledgerDecisions) {
    if (decision.selected) {
      forcedLedgerIds.add(decision.ledger_id)
    } else {
      deselectedLedgerIds.add(decision.ledger_id)
    }
    if (decision.category) {
      ledgerCategories.set(decision.ledger_id, decision.category)
    }
  }

  // Fetch all groups and ledgers to resolve hierarchy
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
    .select('id, status, selected_groups, ledger_decisions')
    .eq('company_id', companyId)
    .eq('compliance_type', config.complianceType)
    .maybeSingle()

  const configured = profile?.status === 'complete'

  const selectedGroupNames = new Set<string>()
  const ledgerDecisions = new Map<string, { selected: boolean; category: string | null }>()
  const tdsMappedLedgerIds = new Set<string>()

  if (profile) {
    if (config.complianceType === 'TDS') {
      const { data: mappings, error } = await client
        .from('tds_ledger_mappings')
        .select('ledger_id')
        .eq('company_id', companyId)
        .eq('is_payable_ledger', true)

      if (error) throw new Error(`Could not load TDS ledger mappings: ${error.message}`)
      for (const mapping of mappings ?? []) tdsMappedLedgerIds.add(mapping.ledger_id)
    } else {
      for (const groupName of profile.selected_groups) {
        selectedGroupNames.add(normalizeTdsName(groupName))
      }

      for (const ld of parseStoredLedgerDecisions(profile.ledger_decisions)) {
        ledgerDecisions.set(ld.ledger_id, { selected: ld.selected, category: ld.category })
      }
    }
  }

  // Resolve active groups/ledgers
  const resolvedGroups = groups.map((g) => {
    const autoSuggested = config.autoSuggestGroup(g.name)
    const selected = config.complianceType === 'TDS'
      ? autoSuggested
      : configured
        ? selectedGroupNames.has(normalizeTdsName(g.name))
        : autoSuggested
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
    const selected = config.complianceType === 'TDS'
      ? configured
        ? tdsMappedLedgerIds.has(ledger.id)
        : inActiveGroup
      : decision
        ? decision.selected
        : configured
          ? false
          : inActiveGroup
    const category = config.complianceType === 'TDS'
      ? selected ? config.defaultCategory : null
      : decision?.category ?? (selected ? config.defaultCategory : null)

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
