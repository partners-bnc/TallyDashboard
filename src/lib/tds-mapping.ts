import type { TdsMappingGroup } from '@/lib/types'

export const TDS_MAPPING_STORAGE_VERSION = 'v2'

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

export function isSuggestedTdsGroup(groupName: string) {
  const normalized = normalizeTdsName(groupName)
  return /(^| )tds( |$)/.test(normalized) || normalized.includes('tax deducted at source')
}

export function isExcludedFromTdsSuggestion(ledgerName: string) {
  return /receiv|recover|interest|penalt|late fee|late filing|filing fee|234e/.test(normalizeTdsName(ledgerName))
}

export function isSuggestedTdsLedger(ledgerName: string) {
  if (isExcludedFromTdsSuggestion(ledgerName)) return false
  const normalized = normalizeTdsName(ledgerName)
  return /(^| )tds( |$)/.test(normalized)
    || normalized.includes('tax deducted at source')
    || /(^| )(192|194[a-z]{0,2})( |$)/.test(normalized)
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

export function groupDescendantIds(groups: TdsMappingGroup[], groupId: string) {
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

export function groupAncestorIds(groups: TdsMappingGroup[], groupId: string) {
  const byId = new Map(groups.map((group) => [group.groupId, group]))
  const result = new Set<string>()
  let cursor = byId.get(groupId)?.parentGroupId ?? null
  while (cursor && !result.has(cursor)) {
    result.add(cursor)
    cursor = byId.get(cursor)?.parentGroupId ?? null
  }
  return result
}

export function tdsLedgerSuggestion(
  ledgerName: string,
  directGroupSuggested: boolean,
) {
  const selected = !isExcludedFromTdsSuggestion(ledgerName)
    && (directGroupSuggested || isSuggestedTdsLedger(ledgerName))
  return {
    selected,
    suggested: selected,
    suggestionReason: selected
      ? directGroupSuggested
        ? 'Ledger belongs directly to a suggested TDS group'
        : 'Ledger name matches TDS or section terminology'
      : null,
  }
}
