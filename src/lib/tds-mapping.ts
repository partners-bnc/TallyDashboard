import type { TdsMappingGroup } from '@/lib/types'

export const TDS_MAPPING_STORAGE_VERSION = 'v3'

export function tdsMappingStorageKey(userId: string, orgId: string, companyId: string) {
  return `tallybridge:compliance-mapping:${TDS_MAPPING_STORAGE_VERSION}:${userId}:${orgId}:${companyId}`
}

export function normalizeTdsName(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function isTdsGroupName(groupName: string) {
  const normalized = normalizeTdsName(groupName)
  return /(^| )tds( |$)/.test(normalized) || normalized.includes('tax deducted at source')
}

export function isExcludedFromTdsSuggestion(ledgerName: string) {
  return /receiv|recover|interest|penalt|late fee|late filing|filing fee|234e/.test(normalizeTdsName(ledgerName))
}

export function resolveLedgerGroupParents<
  T extends { groupId: string; name: string; parentName: string | null; parentGroupId: string | null },
>(groups: T[]): T[] {
  const byId = new Map(groups.map((group) => [group.groupId, group]))
  const byName = new Map(groups.map((group) => [normalizeTdsName(group.name), group.groupId]))
  return groups.map((group) => {
    const explicitParent = group.parentGroupId && byId.has(group.parentGroupId) ? group.parentGroupId : null
    const fallbackParent = group.parentName ? byName.get(normalizeTdsName(group.parentName)) ?? null : null
    const candidate = explicitParent ?? fallbackParent
    return { ...group, parentGroupId: candidate === group.groupId ? null : candidate }
  })
}

export function groupDescendantIds(
  groups: Array<Pick<TdsMappingGroup, 'groupId' | 'parentGroupId'>>,
  groupId: string,
) {
  const result = new Set<string>([groupId])
  let changed = true
  while (changed) {
    changed = false
    for (const group of groups) {
      if (group.parentGroupId && result.has(group.parentGroupId) && !result.has(group.groupId)) {
        result.add(group.groupId)
        changed = true
      }
    }
  }
  return result
}

export function tdsHierarchyGroupIds(
  groups: Array<Pick<TdsMappingGroup, 'groupId' | 'name' | 'parentGroupId'>>,
) {
  const result = new Set<string>()
  for (const group of groups) {
    if (!isTdsGroupName(group.name)) continue
    for (const groupId of groupDescendantIds(groups, group.groupId)) result.add(groupId)
  }
  return result
}

export function isPayableTdsCandidate(
  ledger: { ledgerName: string; parentGroupId: string | null },
  hierarchyGroupIds: ReadonlySet<string>,
) {
  return Boolean(
    ledger.parentGroupId
      && hierarchyGroupIds.has(ledger.parentGroupId)
      && !isExcludedFromTdsSuggestion(ledger.ledgerName),
  )
}

export function isInitiallySelectedTdsCandidate(
  ledgerId: string,
  configured: boolean,
  savedLedgerIds: ReadonlySet<string>,
) {
  return configured ? savedLedgerIds.has(ledgerId) : true
}
