/* Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V4 · redesign: Workbench · designed-as-app */
'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Layout, LayoutContent, LayoutFooter, LayoutHeader } from '@astryxdesign/core/Layout'
import { List, ListItem } from '@astryxdesign/core/List'
import { MobileNav, MobileNavToggle } from '@astryxdesign/core/MobileNav'
import { SideNav } from '@astryxdesign/core/SideNav'
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Heading, Text } from '@astryxdesign/core/Text'
import { TreeList, type TreeListItemData } from '@astryxdesign/core/TreeList'
import Header from '@/components/ui/Header'
import type {
  SaveTdsComplianceMappingPayload,
  TdsComplianceMappingData,
  TdsMappingGroup,
  TdsMappingLedger,
} from '@/lib/types'
import { groupAncestorIds, groupDescendantIds, tdsMappingStorageKey } from '@/lib/tds-mapping'
import { saveTdsComplianceMapping } from './actions'

type MappingView = 'suggested' | 'selected' | 'all'
const MAX_VISIBLE_LEDGERS = 200

function buildTreeItems(
  groups: TdsMappingGroup[],
  selectedGroupId: string,
  onSelect: (groupId: string) => void,
): TreeListItemData[] {
  const children = new Map<string | null, TdsMappingGroup[]>()
  const ids = new Set(groups.map((group) => group.groupId))
  for (const group of groups) {
    const parentId = group.parentGroupId && ids.has(group.parentGroupId) ? group.parentGroupId : null
    children.set(parentId, [...(children.get(parentId) ?? []), group])
  }
  for (const siblings of children.values()) siblings.sort((a, b) => a.name.localeCompare(b.name))
  const expandedIds = new Set<string>()
  for (const group of groups.filter((item) => item.suggested)) {
    expandedIds.add(group.groupId)
    for (const ancestor of groupAncestorIds(groups, group.groupId)) expandedIds.add(ancestor)
  }
  const visited = new Set<string>()
  const toItem = (group: TdsMappingGroup): TreeListItemData => {
    visited.add(group.groupId)
    const childItems = (children.get(group.groupId) ?? [])
      .filter((child) => !visited.has(child.groupId))
      .map(toItem)
    return {
      id: group.groupId,
      label: group.name,
      description: `${group.directLedgerCount} direct ledger${group.directLedgerCount === 1 ? '' : 's'}`,
      endContent: group.suggested ? <Badge variant="info" label="TDS" /> : undefined,
      children: childItems.length ? childItems : undefined,
      isExpanded: expandedIds.has(group.groupId),
      isSelected: selectedGroupId === group.groupId,
      onClick: () => onSelect(group.groupId),
    }
  }
  const roots = (children.get(null) ?? []).map(toItem)
  for (const group of groups) if (!visited.has(group.groupId)) roots.push(toItem(group))
  return roots
}

export function TdsComplianceMappingClient({
  initialData,
  returnTo,
}: {
  initialData: TdsComplianceMappingData
  returnTo: string
}) {
  const router = useRouter()
  const [company, setCompany] = useState(initialData.company)
  const initialGroupId = company.groups.find((group) => group.suggested)?.groupId
    ?? company.groups.find((group) => group.directLedgerCount > 0)?.groupId
    ?? company.groups[0]?.groupId
    ?? ''
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId)
  const [view, setView] = useState<MappingView>('suggested')
  const [search, setSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedGroup = company.groups.find((group) => group.groupId === selectedGroupId) ?? null
  const selectedCount = company.ledgers.filter((ledger) => ledger.selected).length
  const treeItems = useMemo(
    () => buildTreeItems(company.groups, selectedGroupId, (groupId) => {
      setSelectedGroupId(groupId)
      setSearch('')
    }),
    [company.groups, selectedGroupId],
  )

  const updateLedger = useCallback((ledgerId: string, selected: boolean) => {
    setCompany((current) => ({
      ...current,
      ledgers: current.ledgers.map((ledger) => ledger.ledgerId === ledgerId
        ? {
            ...ledger,
            selected,
            suggested: false,
            suggestionReason: selected ? 'Selected manually' : 'Excluded manually',
          }
        : ledger),
    }))
  }, [])

  const updateDirectGroup = (selected: boolean) => {
    if (!selectedGroup) return
    setCompany((current) => ({
      ...current,
      groups: current.groups.map((group) => group.groupId === selectedGroup.groupId
        ? { ...group, selected, suggested: false }
        : group),
      ledgers: current.ledgers.map((ledger) => ledger.parentGroupId === selectedGroup.groupId
        ? {
            ...ledger,
            selected,
            suggested: false,
            suggestionReason: selected ? `Selected with ${selectedGroup.name}` : `Excluded with ${selectedGroup.name}`,
          }
        : ledger),
    }))
  }

  const filteredLedgers = useMemo(() => {
    const query = search.trim().toLowerCase()
    const groupScope = selectedGroup ? groupDescendantIds(company.groups, selectedGroup.groupId) : new Set<string>()
    return company.ledgers
      .filter((ledger) => query
        ? ledger.ledgerName.toLowerCase().includes(query) || ledger.parentName.toLowerCase().includes(query)
        : !selectedGroup || Boolean(ledger.parentGroupId && groupScope.has(ledger.parentGroupId)))
      .filter((ledger) => query || view === 'all' || (view === 'selected' ? ledger.selected : ledger.suggested))
      .sort((a, b) => Number(b.selected) - Number(a.selected) || a.ledgerName.localeCompare(b.ledgerName))
  }, [company.groups, company.ledgers, search, selectedGroup, view])
  const visibleLedgers = filteredLedgers.slice(0, MAX_VISIBLE_LEDGERS)

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    const payload: SaveTdsComplianceMappingPayload = {
      orgId: initialData.orgId,
      companyId: company.companyId,
      groups: company.groups.map(({ groupId, selected, suggested }) => ({ groupId, selected, suggested })),
      ledgers: company.ledgers.map(({ ledgerId, selected, suggested, suggestionReason }) => ({
        ledgerId,
        selected,
        suggested,
        suggestionReason,
      })),
    }
    const result = await saveTdsComplianceMapping(payload)
    if (!result.ok) {
      setError(result.error)
      setIsSaving(false)
      return
    }
    localStorage.setItem(
      tdsMappingStorageKey(initialData.userId, initialData.orgId, company.companyId),
      'complete',
    )
    router.replace(returnTo)
    router.refresh()
  }

  return (
    <AppShell
      topNav={<Header />}
      sideNav={
        <SideNav
          topContent={
            <VStack gap={1}>
              <Heading level={3}>Tally groups</Heading>
              <Text type="supporting">Open a parent to reveal its subgroups. TDS branches are expanded for you.</Text>
            </VStack>
          }
        >
          <TreeList items={treeItems} density="compact" header="Ledger group hierarchy" />
        </SideNav>
      }
      mobileNav={{
        breakpoint: 'md',
        content: (
          <MobileNav header="Tally groups" label="Tally group hierarchy" side="start">
            <TreeList items={treeItems} density="compact" header="Ledger group hierarchy" />
          </MobileNav>
        ),
      }}
      contentPadding={0}
      height="fill"
      variant="section"
    >
      <Layout
        height="fill"
        header={
          <LayoutHeader hasDivider padding={4}>
            <HStack gap={4} vAlign="center" wrap="wrap">
              <MobileNavToggle label="Browse Tally groups">Groups</MobileNavToggle>
              <StackItem size="fill">
                <VStack gap={1}>
                  <Text type="supporting">TDS compliance mapping</Text>
                  <Heading level={2}>{company.companyName}</Heading>
                  <Text type="supporting">Choose the deduction ledgers that should power this company&apos;s TDS report.</Text>
                </VStack>
              </StackItem>
              <Badge variant={company.configured ? 'success' : 'neutral'} label={company.configured ? 'Configured' : 'First review'} />
              <Badge variant="neutral" label={`${selectedCount} selected`} />
            </HStack>
          </LayoutHeader>
        }
        footer={
          <LayoutFooter hasDivider padding={4} label="Confirm TDS mapping">
            <HStack gap={3} vAlign="center" wrap="wrap">
              <StackItem size="fill">
                <VStack gap={0.5}>
                  <Text type="label">{selectedCount} deduction ledger{selectedCount === 1 ? '' : 's'} selected</Text>
                  <Text type="supporting">This confirmation applies only to {company.companyName}.</Text>
                  {error && <Text type="supporting">Error: {error}</Text>}
                </VStack>
              </StackItem>
              <Button label="Confirm TDS mapping" variant="primary" isLoading={isSaving} onClick={handleSave} />
            </HStack>
          </LayoutFooter>
        }
      >
        <LayoutContent padding={0} label="TDS ledger selection">
          <VStack gap={0}>
            <VStack gap={4} padding={4}>
              <HStack gap={4} vAlign="end" wrap="wrap">
                <StackItem size="fill">
                  <VStack gap={1}>
                    <Heading level={3}>{selectedGroup?.name ?? 'All ledger groups'}</Heading>
                    <Text type="supporting">
                      Browsing this group and its descendants. Selecting the group itself changes only its direct ledgers.
                    </Text>
                  </VStack>
                </StackItem>
                {selectedGroup && (
                  <CheckboxInput
                    label={`Select all ${selectedGroup.directLedgerCount} direct ledgers in ${selectedGroup.name}`}
                    description="Subgroup ledgers are not changed."
                    size="sm"
                    value={selectedGroup.selected}
                    onChange={updateDirectGroup}
                  />
                )}
              </HStack>
              <TextInput
                label="Search this company"
                description="Search ignores the current group so receivables, interest, and penalties remain findable for manual selection."
                value={search}
                onChange={setSearch}
                placeholder="Search ledger or Tally group"
                hasClear
              />
              <TabList value={view} onChange={(value) => setView(value as MappingView)} hasDivider>
                <Tab value="suggested" label="Suggested" />
                <Tab value="selected" label="Selected" endContent={<Badge variant="neutral" label={selectedCount} />} />
                <Tab value="all" label="All" />
              </TabList>
            </VStack>
            {visibleLedgers.length > 0 ? (
              <List header={`${filteredLedgers.length} ledgers`} density="compact" hasDividers>
                {visibleLedgers.map((ledger: TdsMappingLedger) => (
                  <ListItem
                    key={ledger.ledgerId}
                    label={ledger.ledgerName}
                    description={`${ledger.parentName}${ledger.suggestionReason ? ` · ${ledger.suggestionReason}` : ''}`}
                    startContent={
                      <CheckboxInput
                        label={`Select ${ledger.ledgerName}`}
                        isLabelHidden
                        size="sm"
                        value={ledger.selected}
                        onChange={(selected) => updateLedger(ledger.ledgerId, selected)}
                      />
                    }
                    endContent={ledger.suggested ? <Badge variant="info" label="Suggested" /> : undefined}
                  />
                ))}
              </List>
            ) : (
              <EmptyState
                title="No ledgers match this view"
                description="Try another tab, open a different group, or search the full company ledger list."
                isCompact
                actions={search ? <Button label="Clear search" variant="secondary" onClick={() => setSearch('')} /> : undefined}
              />
            )}
            {filteredLedgers.length > MAX_VISIBLE_LEDGERS && (
              <VStack gap={1} padding={4}>
                <Text type="supporting">Showing the first {MAX_VISIBLE_LEDGERS} results. Refine the search to reach a specific ledger.</Text>
              </VStack>
            )}
          </VStack>
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
