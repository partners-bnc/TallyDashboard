/* Hallmark · redesign: Compliance Mapping Workbench · high-end executive design */
'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Grid } from '@astryxdesign/core/Grid'
import { Layout, LayoutContent, LayoutFooter, LayoutHeader } from '@astryxdesign/core/Layout'
import { List, ListItem } from '@astryxdesign/core/List'
import { MobileNav, MobileNavToggle } from '@astryxdesign/core/MobileNav'
import { SideNav } from '@astryxdesign/core/SideNav'
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Heading, Text } from '@astryxdesign/core/Text'
import { TreeList, type TreeListItemData } from '@astryxdesign/core/TreeList'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  CheckSquare,
  FolderTree,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'

import Header from '@/components/ui/Header'
import type {
  SaveTdsComplianceMappingPayload,
  TdsComplianceMappingData,
  TdsMappingGroup,
  TdsMappingLedger,
} from '@/lib/types'
import { groupAncestorIds, groupDescendantIds, tdsMappingStorageKey } from '@/lib/tds-mapping'
import { saveTdsComplianceMapping } from './actions'

type MappingView = 'suggested' | 'selected' | 'all' | 'excluded'
const MAX_VISIBLE_LEDGERS = 250

function buildTreeItems(
  groups: TdsMappingGroup[],
  selectedGroupId: string,
  onSelect: (groupId: string) => void,
  groupFilter: string,
): TreeListItemData[] {
  const query = groupFilter.trim().toLowerCase()
  const children = new Map<string | null, TdsMappingGroup[]>()
  const ids = new Set(groups.map((group) => group.groupId))

  for (const group of groups) {
    const parentId = group.parentGroupId && ids.has(group.parentGroupId) ? group.parentGroupId : null
    children.set(parentId, [...(children.get(parentId) ?? []), group])
  }
  for (const siblings of children.values()) siblings.sort((a, b) => a.name.localeCompare(b.name))

  const expandedIds = new Set<string>()
  for (const group of groups.filter((item) => item.suggested || (query && item.name.toLowerCase().includes(query)))) {
    expandedIds.add(group.groupId)
    for (const ancestor of groupAncestorIds(groups, group.groupId)) expandedIds.add(ancestor)
  }

  const visited = new Set<string>()
  const toItem = (group: TdsMappingGroup): TreeListItemData | null => {
    visited.add(group.groupId)
    const childItems = (children.get(group.groupId) ?? [])
      .filter((child) => !visited.has(child.groupId))
      .map((g) => toItem(g))
      .filter((item): item is TreeListItemData => item !== null)

    const matchesFilter = !query || group.name.toLowerCase().includes(query) || childItems.length > 0
    if (!matchesFilter) return null

    return {
      id: group.groupId,
      label: group.name,
      description: `${group.directLedgerCount} ledger${group.directLedgerCount === 1 ? '' : 's'}`,
      endContent: group.suggested ? <Badge variant="info" label="TDS" /> : undefined,
      children: childItems.length ? childItems : undefined,
      isExpanded: expandedIds.has(group.groupId),
      isSelected: selectedGroupId === group.groupId,
      onClick: () => onSelect(group.groupId),
    }
  }

  const roots = (children.get(null) ?? []).map((g) => toItem(g)).filter((item): item is TreeListItemData => item !== null)
  for (const group of groups) {
    if (!visited.has(group.groupId)) {
      const item = toItem(group)
      if (item) roots.push(item)
    }
  }
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
  const [groupFilterSearch, setGroupFilterSearch] = useState('')
  const [view, setView] = useState<MappingView>('suggested')
  const [search, setSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedGroup = company.groups.find((group) => group.groupId === selectedGroupId) ?? null
  const totalLedgersCount = company.ledgers.length
  const selectedCount = company.ledgers.filter((ledger) => ledger.selected).length
  const suggestedCount = company.ledgers.filter((ledger) => ledger.suggested).length
  const suggestedSelectedCount = company.ledgers.filter((ledger) => ledger.suggested && ledger.selected).length
  const excludedCount = company.ledgers.filter((ledger) => !ledger.selected).length
  const reviewRequiredCount = company.reviewRequiredCount || company.ledgers.filter((ledger) => ledger.suggested && !ledger.hasSavedDecision).length
  const tdsGroupCount = company.groups.filter((group) => group.suggested).length

  const treeItems = useMemo(
    () => buildTreeItems(company.groups, selectedGroupId, (groupId) => {
      setSelectedGroupId(groupId)
      setSearch('')
    }, groupFilterSearch),
    [company.groups, selectedGroupId, groupFilterSearch],
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

  const selectAllSuggested = () => {
    setCompany((current) => ({
      ...current,
      ledgers: current.ledgers.map((ledger) => ledger.suggested
        ? { ...ledger, selected: true, suggestionReason: 'Selected via suggested batch' }
        : ledger),
    }))
  }

  const resetToRecommended = () => {
    setCompany((current) => ({
      ...current,
      groups: current.groups.map((group) => ({ ...group, selected: group.suggested })),
      ledgers: current.ledgers.map((ledger) => ({
        ...ledger,
        selected: ledger.suggested,
        suggestionReason: ledger.suggested ? 'Suggested automatically' : null,
      })),
    }))
  }

  const filteredLedgers = useMemo(() => {
    const query = search.trim().toLowerCase()
    const groupScope = selectedGroup ? groupDescendantIds(company.groups, selectedGroup.groupId) : new Set<string>()
    return company.ledgers
      .filter((ledger) => query
        ? ledger.ledgerName.toLowerCase().includes(query) || ledger.parentName.toLowerCase().includes(query)
        : !selectedGroup || Boolean(ledger.parentGroupId && groupScope.has(ledger.parentGroupId)))
      .filter((ledger) => {
        if (query) return true
        if (view === 'suggested') return ledger.suggested
        if (view === 'selected') return ledger.selected
        if (view === 'excluded') return !ledger.selected
        return true
      })
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
            <VStack gap={2}>
              <HStack align="center" justify="between">
                <Heading level={3} style={{ fontSize: '15px', fontWeight: '700' }}>Tally Hierarchy</Heading>
                <Badge variant="neutral" label={`${company.groups.length} groups`} />
              </HStack>
              <Text type="supporting">Select a parent group to reveal its subgroups and direct ledgers.</Text>
              <TextInput
                label="Filter Tally groups"
                isLabelHidden
                placeholder="Filter Tally groups..."
                value={groupFilterSearch}
                onChange={setGroupFilterSearch}
                size="sm"
                hasClear
              />
            </VStack>
          }
        >
          <TreeList items={treeItems} density="compact" header="Ledger group tree" />
        </SideNav>
      }
      mobileNav={{
        breakpoint: 'md',
        content: (
          <MobileNav header="Tally Group Hierarchy" label="Tally group hierarchy" side="start">
            <VStack gap={2} padding={2}>
              <TextInput
                label="Filter Tally groups"
                isLabelHidden
                placeholder="Filter Tally groups..."
                value={groupFilterSearch}
                onChange={setGroupFilterSearch}
                size="sm"
                hasClear
              />
              <TreeList items={treeItems} density="compact" header="Ledger group tree" />
            </VStack>
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
            <VStack gap={4}>
              {/* Hero Banner Box */}
              <Card padding={5} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <VStack gap={1.5}>
                    <HStack gap={2} align="center">
                      <MobileNavToggle label="Browse Tally groups">Groups</MobileNavToggle>
                      <button
                        onClick={() => router.push(returnTo)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                      >
                        <ArrowLeft size={14} />
                        Return
                      </button>
                      <Text type="supporting" weight="semibold" style={{ letterSpacing: '0.08em' }}>
                        TAX COMPLIANCE · RULES & DEDUCTION WORKBENCH
                      </Text>
                    </HStack>
                    <HStack gap={3} align="center">
                      <div style={{ padding: '8px', borderRadius: '10px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        <ShieldCheck size={24} />
                      </div>
                      <Heading level={1} style={{ fontSize: '26px', fontWeight: '700', letterSpacing: '-0.03em' }}>
                        {company.companyName}
                      </Heading>
                    </HStack>
                    <Text type="supporting">
                      Choose the deduction ledgers that should power this company&apos;s TDS statutory report and liability calculations.
                    </Text>
                  </VStack>

                  <div className="flex flex-wrap items-center gap-3">
                    <Badge
                      variant={company.configured ? 'success' : 'warning'}
                      label={company.configured ? 'Active & Configured' : 'First Review Required'}
                    />
                    {reviewRequiredCount > 0 && (
                      <Badge variant="info" label={`${reviewRequiredCount} Review Needed`} />
                    )}
                    <button
                      type="button"
                      onClick={resetToRecommended}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-sm cursor-pointer"
                      title="Reset all selections to Tally automatic suggestions"
                    >
                      <RotateCcw size={14} />
                      Reset Recommended
                    </button>
                    <Button
                      label={isSaving ? 'Saving...' : 'Confirm TDS Mapping'}
                      variant="primary"
                      isLoading={isSaving}
                      onClick={handleSave}
                    />
                  </div>
                </div>
              </Card>

              {/* Summary KPIs Bar */}
              <Grid columns={{ minWidth: 200, max: 4, repeat: 'fit' }} gap={3}>
                <Card padding={4} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
                  <VStack gap={2}>
                    <HStack justify="between" align="center">
                      <Text type="supporting" weight="semibold">SELECTED LEDGERS</Text>
                      <CheckCircle2 className="text-emerald-500" size={18} />
                    </HStack>
                    <Heading level={2} style={{ fontSize: '22px', fontWeight: '700' }}>
                      {selectedCount} <span className="text-xs font-normal text-slate-400">/ {totalLedgersCount}</span>
                    </Heading>
                    <Text type="supporting">
                      {totalLedgersCount > 0 ? `${Math.round((selectedCount / totalLedgersCount) * 100)}% of total company ledgers` : '0%'}
                    </Text>
                  </VStack>
                </Card>

                <Card padding={4} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
                  <VStack gap={2}>
                    <HStack justify="between" align="center">
                      <Text type="supporting" weight="semibold">SUGGESTED TDS</Text>
                      <Sparkles className="text-blue-500" size={18} />
                    </HStack>
                    <Heading level={2} style={{ fontSize: '22px', fontWeight: '700' }}>
                      {suggestedSelectedCount} <span className="text-xs font-normal text-slate-400">/ {suggestedCount}</span>
                    </Heading>
                    <Text type="supporting">Detected via Tally statutory rules</Text>
                  </VStack>
                </Card>

                <Card padding={4} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
                  <VStack gap={2}>
                    <HStack justify="between" align="center">
                      <Text type="supporting" weight="semibold">TDS GROUPS SCOPE</Text>
                      <FolderTree className="text-purple-500" size={18} />
                    </HStack>
                    <Heading level={2} style={{ fontSize: '22px', fontWeight: '700' }}>
                      {tdsGroupCount} <span className="text-xs font-normal text-slate-400">/ {company.groups.length}</span>
                    </Heading>
                    <Text type="supporting">Active Tally statutory groups</Text>
                  </VStack>
                </Card>

                <Card padding={4} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
                  <VStack gap={2}>
                    <HStack justify="between" align="center">
                      <Text type="supporting" weight="semibold">COMPLIANCE HEALTH</Text>
                      <AlertCircle className={reviewRequiredCount === 0 ? 'text-emerald-500' : 'text-amber-500'} size={18} />
                    </HStack>
                    <Heading level={2} style={{ fontSize: '22px', fontWeight: '700' }}>
                      {reviewRequiredCount === 0 ? 'Fully Mapped' : `${reviewRequiredCount} Pending`}
                    </Heading>
                    <Text type="supporting">Ready for liability calculation</Text>
                  </VStack>
                </Card>
              </Grid>
            </VStack>
          </LayoutHeader>
        }
        footer={
          <LayoutFooter hasDivider padding={4} label="Confirm TDS mapping">
            <HStack gap={3} vAlign="center" wrap="wrap">
              <StackItem size="fill">
                <VStack gap={0.5}>
                  <Text type="label" weight="semibold">
                    {selectedCount} deduction ledger{selectedCount === 1 ? '' : 's'} selected for TDS compliance
                  </Text>
                  <Text type="supporting">
                    Confirmation powers statutory reporting for {company.companyName}.
                  </Text>
                  {error && <Text type="supporting" style={{ color: 'var(--negative)' }}>Error: {error}</Text>}
                </VStack>
              </StackItem>
              <Button label={isSaving ? 'Saving...' : 'Confirm TDS mapping'} variant="primary" isLoading={isSaving} onClick={handleSave} />
            </HStack>
          </LayoutFooter>
        }
      >
        <LayoutContent padding={0} label="TDS ledger selection">
          <VStack gap={4} padding={4}>
            {/* Active Group Header & Controls */}
            <Card padding={4} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
              <VStack gap={3}>
                <HStack gap={4} align="center" justify="between" wrap="wrap">
                  <VStack gap={1}>
                    <HStack gap={2} align="center">
                      <Heading level={3} style={{ fontSize: '18px', fontWeight: '700' }}>
                        {selectedGroup?.name ?? 'All Ledger Groups'}
                      </Heading>
                      {selectedGroup?.suggested && <Badge variant="info" label="TDS Group" />}
                    </HStack>
                    <Text type="supporting">
                      Browsing ledgers in this group and its sub-branches. Selecting this group applies to its direct ledgers.
                    </Text>
                  </VStack>
                  <HStack gap={2} align="center" wrap="wrap">
                    {selectedGroup && selectedGroup.directLedgerCount > 0 && (
                      <CheckboxInput
                        label={`Select all ${selectedGroup.directLedgerCount} direct ledgers in ${selectedGroup.name}`}
                        size="sm"
                        value={selectedGroup.selected}
                        onChange={updateDirectGroup}
                      />
                    )}
                    <button
                      type="button"
                      onClick={selectAllSuggested}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors shadow-sm cursor-pointer"
                    >
                      <Zap size={14} />
                      Select All Suggested ({suggestedCount})
                    </button>
                  </HStack>
                </HStack>

                {/* Search Bar & Badged View Tabs */}
                <VStack gap={3}>
                  <div className="relative w-full">
                    <TextInput
                      label="Search Company Ledgers"
                      description="Search across all Tally ledgers or groups to select receivables, payables, penalty or tax accounts."
                      value={search}
                      onChange={setSearch}
                      placeholder="Search by ledger name or parent Tally group..."
                      hasClear
                    />
                  </div>

                  <HStack justify="between" align="center" wrap="wrap" gap={3}>
                    <TabList value={view} onChange={(value) => setView(value as MappingView)} hasDivider>
                      <Tab
                        value="suggested"
                        label="Suggested"
                        endContent={<Badge variant="info" label={suggestedCount} />}
                      />
                      <Tab
                        value="selected"
                        label="Selected"
                        endContent={<Badge variant="success" label={selectedCount} />}
                      />
                      <Tab
                        value="excluded"
                        label="Excluded"
                        endContent={<Badge variant="neutral" label={excludedCount} />}
                      />
                      <Tab
                        value="all"
                        label="All Ledgers"
                        endContent={<Badge variant="neutral" label={totalLedgersCount} />}
                      />
                    </TabList>

                    <Text type="supporting" weight="semibold">
                      Showing {filteredLedgers.length} ledger{filteredLedgers.length === 1 ? '' : 's'}
                    </Text>
                  </HStack>
                </VStack>
              </VStack>
            </Card>

            {/* Dense Data List of Ledgers */}
            {visibleLedgers.length > 0 ? (
              <Card padding={0} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
                <List header={`${filteredLedgers.length} matched ledgers`} density="compact" hasDividers>
                  {visibleLedgers.map((ledger: TdsMappingLedger) => {
                    const isChecked = ledger.selected
                    return (
                      <ListItem
                        key={ledger.ledgerId}
                        label={
                          <HStack gap={2} align="center">
                            <span style={{ fontWeight: '600', color: 'var(--foreground)' }}>{ledger.ledgerName}</span>
                            {ledger.selected && (
                              <Badge variant="success" label="Mapped" />
                            )}
                          </HStack>
                        }
                        description={
                          <HStack gap={2} align="center" wrap="wrap">
                            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
                              Group: {ledger.parentName}
                            </span>
                            {ledger.suggestionReason && (
                              <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                {ledger.suggestionReason}
                              </span>
                            )}
                          </HStack>
                        }
                        startContent={
                          <CheckboxInput
                            label={`Select ${ledger.ledgerName}`}
                            isLabelHidden
                            size="sm"
                            value={isChecked}
                            onChange={(selected) => updateLedger(ledger.ledgerId, selected)}
                          />
                        }
                        endContent={
                          ledger.suggested ? (
                            <Badge variant="info" label="Auto Suggested" />
                          ) : (
                            <Badge variant="neutral" label={isChecked ? 'Manual' : 'Excluded'} />
                          )
                        }
                      />
                    )
                  })}
                </List>
              </Card>
            ) : (
              <Card padding={6} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
                <EmptyState
                  title="No ledgers match this view filter"
                  description="Try selecting another tab, searching for another keyword, or selecting a different Tally group in the hierarchy tree."
                  isCompact
                  actions={
                    search ? (
                      <Button label="Clear Search Query" variant="secondary" onClick={() => setSearch('')} />
                    ) : (
                      <Button label="Switch to All Ledgers" variant="secondary" onClick={() => setView('all')} />
                    )
                  }
                />
              </Card>
            )}

            {filteredLedgers.length > MAX_VISIBLE_LEDGERS && (
              <Card padding={3} style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                <Text type="supporting" style={{ textAlign: 'center' }}>
                  Showing first {MAX_VISIBLE_LEDGERS} ledgers of {filteredLedgers.length}. Refine the search box to locate specific ledgers.
                </Text>
              </Card>
            )}
          </VStack>
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
