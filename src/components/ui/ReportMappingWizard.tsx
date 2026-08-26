'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Layout, LayoutContent, LayoutFooter, LayoutHeader } from '@astryxdesign/core/Layout'
import { List, ListItem } from '@astryxdesign/core/List'
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Heading, Text } from '@astryxdesign/core/Text'

import Header from '@/components/ui/Header'
import type { CentralizedMappingData } from '@/lib/centralized-mapping'
import { saveComplianceMapping } from '@/app/dashboard/compliance-mapping/actions'

interface Props {
  initialData: CentralizedMappingData
  complianceType: string
  title: string
  description: string
  defaultCategory?: string | null
  returnTo: string
}

export function ReportMappingWizard({
  initialData,
  complianceType,
  title,
  description,
  defaultCategory = null,
  returnTo,
}: Props) {
  const router = useRouter()
  const [groups, setGroups] = useState(initialData.company.groups)
  const [ledgers, setLedgers] = useState(initialData.company.ledgers)
  const [groupSearch, setGroupSearch] = useState('')
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Real-time splitter dragging width percentage for the left column
  const [leftWidth, setLeftWidth] = useState(30)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const startX = e.clientX
    const startWidth = leftWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaPercent = (deltaX / window.innerWidth) * 100
      const newWidth = Math.max(15, Math.min(50, startWidth + deltaPercent))
      setLeftWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Build a tree structure of Tally groups for folder nesting
  const groupTree = useMemo(() => {
    const itemsMap = new Map<string, typeof groups[0] & { children: any[] }>()
    for (const g of groups) {
      itemsMap.set(g.groupId, { ...g, children: [] })
    }

    const roots: (typeof groups[0] & { children: any[] })[] = []

    for (const item of itemsMap.values()) {
      if (item.parentGroupId && itemsMap.has(item.parentGroupId)) {
        itemsMap.get(item.parentGroupId)!.children.push(item)
      } else {
        roots.push(item)
      }
    }

    return roots
  }, [groups])

  // Flatten the tree for search mode
  const flattenedGroupsForSearch = useMemo(() => {
    const result: typeof groups = []
    const query = groupSearch.trim().toLowerCase()
    if (!query) return groups

    function traverse(node: any) {
      if (node.name.toLowerCase().includes(query)) {
        result.push(node)
      }
      for (const child of node.children) {
        traverse(child)
      }
    }

    for (const root of groupTree) {
      traverse(root)
    }
    return result
  }, [groupTree, groupSearch])

  // Selected group IDs for child grouping (including recursive ancestors)
  const selectedGroupIds = useMemo(() => {
    const activeGroupIds = new Set(groups.filter((g) => g.selected).map((g) => g.groupId))
    const recursiveIds = new Set<string>()

    // Map child to parent to traverse upwards
    const parentGroupIdMap = new Map<string, string | null>()
    for (const group of groups) {
      parentGroupIdMap.set(group.groupId, group.parentGroupId)
    }

    const collectAncestors = (groupId: string, resultSet: Set<string>) => {
      resultSet.add(groupId)
      const parentId = parentGroupIdMap.get(groupId)
      if (parentId && !resultSet.has(parentId)) {
        collectAncestors(parentId, resultSet)
      }
    }

    for (const groupId of activeGroupIds) {
      collectAncestors(groupId, recursiveIds)
    }

    return recursiveIds
  }, [groups])

  // Allowed group IDs are ONLY the ones that are explicitly checked/selected
  const allowedGroupIds = useMemo(() => {
    return new Set(groups.filter((g) => g.selected).map((g) => g.groupId))
  }, [groups])

  // Allowed parent group names (including descendants)
  const allowedGroupNames = useMemo(() => {
    const names = new Set<string>()
    for (const g of groups) {
      if (allowedGroupIds.has(g.groupId)) {
        names.add(g.name)
      }
    }
    return names
  }, [groups, allowedGroupIds])

  // Filter ledgers that belong to selected groups (directly selected and their descendants)
  const candidateLedgers = useMemo(() => {
    return ledgers.filter((l) => {
      const inAllowedGroup =
        (l.parentName && allowedGroupNames.has(l.parentName)) ||
        (l.parentGroupId && allowedGroupIds.has(l.parentGroupId))
      return inAllowedGroup
    })
  }, [ledgers, allowedGroupNames, allowedGroupIds])

  // Filter candidate ledgers by search query
  const filteredLedgers = useMemo(() => {
    const query = ledgerSearch.trim().toLowerCase()
    if (!query) return candidateLedgers
    return candidateLedgers.filter((ledger) => (
      ledger.ledgerName.toLowerCase().includes(query) ||
      (ledger.parentName && ledger.parentName.toLowerCase().includes(query))
    ))
  }, [candidateLedgers, ledgerSearch])

  // Group ledgers by parent group name
  const groupedLedgers = useMemo(() => {
    const map = new Map<string, typeof filteredLedgers>()
    for (const ledger of filteredLedgers) {
      const groupName = ledger.parentName || 'Unassigned Ledgers'
      const list = map.get(groupName) ?? []
      list.push(ledger)
      map.set(groupName, list)
    }
    return Array.from(map.entries())
  }, [filteredLedgers])

  const selectedLedgerCount = useMemo(() => {
    return candidateLedgers.filter((ledger) => ledger.selected).length
  }, [candidateLedgers])

  const handleGroupToggle = (groupId: string, targetChecked: boolean) => {
    // 1. Calculate descendants recursively
    const descendants = new Set<string>()
    const collectDescendants = (id: string, list: typeof groups) => {
      for (const g of list) {
        if (g.parentGroupId === id && !descendants.has(g.groupId)) {
          descendants.add(g.groupId)
          collectDescendants(g.groupId, list)
        }
      }
    }
    collectDescendants(groupId, groups)

    const groupIdsToUpdate = new Set<string>([groupId, ...descendants])
    const groupNamesToUpdate = new Set(
      groups.filter((g) => groupIdsToUpdate.has(g.groupId)).map((g) => g.name)
    )

    // Set selection for the toggled group and its descendants
    setGroups((current) =>
      current.map((g) => {
        if (groupIdsToUpdate.has(g.groupId)) {
          return { ...g, selected: targetChecked }
        }
        return g
      })
    )

    // 2. Update ledgers recursively
    setLedgers((current) =>
      current.map((l) => {
        const matchesGroup =
          (l.parentGroupId && groupIdsToUpdate.has(l.parentGroupId)) ||
          (l.parentName && groupNamesToUpdate.has(l.parentName))
        if (matchesGroup) {
          return { ...l, selected: targetChecked }
        }
        return l
      })
    )
  }

  const handleLedgerToggle = (ledgerId: string, selected: boolean) => {
    setLedgers((current) =>
      current.map((l) => (l.ledgerId === ledgerId ? { ...l, selected } : l))
    )
  }

  const handleSelectAllCandidates = () => {
    const candidateIds = new Set(candidateLedgers.map((l) => l.ledgerId))
    setLedgers((current) =>
      current.map((l) =>
        candidateIds.has(l.ledgerId) ? { ...l, selected: true } : l
      )
    )
  }

  const handleClearCandidateSelection = () => {
    const candidateIds = new Set(candidateLedgers.map((l) => l.ledgerId))
    setLedgers((current) =>
      current.map((l) =>
        candidateIds.has(l.ledgerId) ? { ...l, selected: false } : l
      )
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    const selectedGroups = groups.filter((g) => g.selected).map((g) => g.name)
    const ledgerDecisions = ledgers
      .map((l) => {
        const isGroupSelected =
          (l.parentName && allowedGroupNames.has(l.parentName)) ||
          (l.parentGroupId && allowedGroupIds.has(l.parentGroupId))

        if (!isGroupSelected) return null

        return {
          ledgerId: l.ledgerId,
          selected: l.selected,
          category: l.selected ? (l.category || defaultCategory) : null,
        }
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)

    const result = await saveComplianceMapping({
      orgId: initialData.orgId,
      companyId: initialData.company.companyId,
      complianceType,
      selectedGroups,
      ledgerDecisions,
    })

    if (!result.ok) {
      setError(result.error)
      setIsSaving(false)
      return
    }

    router.replace(returnTo)
    router.refresh()
  }

  // Recursive component to render a tree node and its nested child container
  const renderGroupNode = (node: any, level: number) => {
    const isActive = selectedGroupIds.has(node.groupId)
    const isParent = level === 0

    return (
      <VStack key={node.groupId} gap={1} style={{ width: '100%' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          {/* Horizontal hook connector line touching the vertical container rail */}
          {level > 0 && (
            <div
              style={{
                position: 'absolute',
                left: '-12px',
                width: '12px',
                top: '50%',
                borderTop: '1.5px solid #94a3b8',
                pointerEvents: 'none',
              }}
            />
          )}
          <ListItem
            label={
              <HStack gap={1} align="center">
                <span style={{ marginRight: '6px', fontSize: '13px' }}>
                  {isParent ? '📁' : '📄'}
                </span>
                <Text
                  weight={isParent ? 'bold' : 'normal'}
                  style={{
                    color: '#0f172a',
                    fontSize: isParent ? '14px' : '13px',
                  }}
                >
                  {node.name}
                </Text>
              </HStack>
            }
            style={{
              borderRadius: 'var(--radius-md, 6px)',
              padding: isParent ? 'var(--spacing-3, 10px) var(--spacing-4, 12px)' : 'var(--spacing-2, 6px) var(--spacing-3, 10px)',
              transition: 'all 0.15s ease-in-out',
              backgroundColor: isActive
                ? '#e0e7ff'
                : (isParent ? '#e2e8f0' : '#ffffff'),
              border: isActive
                ? '1.5px solid #6366f1'
                : (isParent ? '1.5px solid #000000' : '1px solid #cbd5e1'),
              margin: '2px 0',
              boxShadow: isParent ? '0 2px 4px 0 rgba(0, 0, 0, 0.06)' : '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
              cursor: 'pointer',
            }}
            onClick={() => handleGroupToggle(node.groupId, !isActive)}
            startContent={
              <div style={{ pointerEvents: 'none' }}>
                <CheckboxInput
                  label={`Select group ${node.name}`}
                  isLabelHidden
                  size="sm"
                  value={isActive}
                  onChange={() => { }}
                />
              </div>
            }
            endContent={node.autoSuggested && !initialData.company.configured ? (
              <Badge variant="neutral" label="Suggested" style={{ fontSize: '10px' }} />
            ) : undefined}
          />
        </div>

        {/* Child container with mathematical border-left vertical rail */}
        {node.children.length > 0 && (
          <div style={{
            borderLeft: '1.5px solid #94a3b8',
            marginLeft: '18px', // Visual indentation shift
            paddingLeft: '12px', // Visual gutter space
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            width: 'calc(100% - 18px)',
          }}>
            {node.children.map((child: any) => renderGroupNode(child, level + 1))}
          </div>
        )}
      </VStack>
    )
  }

  return (
    <AppShell topNav={<Header />} contentPadding={0} height="fill" variant="section">
      {/* Global CSS Overrides to satisfy strict black borders and colors */}
      <style dangerouslySetInnerHTML={{
        __html: `
        /* Black borders for search inputs */
        .astryx-text-input {
          border: 1.5px solid #000000 !important;
          border-radius: 6px !important;
          background-color: #ffffff !important;
          overflow: hidden !important;
        }
        .astryx-text-input input {
          font-size: 13px !important;
          padding: 8px 12px !important;
          background-color: #ffffff !important;
        }
        
        /* Black borders & custom compact sizes for checkboxes */
        .astryx-checkbox {
          width: 15px !important;
          height: 15px !important;
          border: 1.8px solid #000000 !important;
          border-radius: 4px !important;
          transition: all 0.1s ease-in-out !important;
        }
        .astryx-checkbox svg {
          width: 9px !important;
          height: 9px !important;
        }
      `}} />

      <Layout
        height="fill"
        header={
          <LayoutHeader hasDivider padding={4} style={{ background: '#ffffff', borderBottom: '1px solid var(--color-border)' }}>
            <HStack gap={4} align="center" justify="between" wrap="wrap">
              <StackItem size="fill">
                <VStack gap={2}>
                  <HStack gap={2} align="center">
                    <Heading level={1} style={{ fontSize: 'var(--typography-font-size-h3, 20px)', fontWeight: 600, color: '#0f172a' }}>{title}</Heading>
                    <Badge variant="neutral" label={complianceType} style={{ textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: '#e2e8f0', color: '#0f172a', border: '1px solid #cbd5e1' }} />
                  </HStack>
                  <HStack gap={3} align="center">
                    <Text type="supporting" style={{ color: '#475569' }}>
                      {initialData.company.companyName}
                    </Text>
                    {error && <Text type="supporting" style={{ color: 'var(--color-danger-text, #ef4444)', fontWeight: 600 }}>Error: {error}</Text>}
                  </HStack>
                </VStack>
              </StackItem>
              <HStack gap={3} align="center" wrap="wrap">
                <Badge
                  variant={initialData.company.configured ? 'success' : 'neutral'}
                  label={initialData.company.configured ? 'Mapping complete' : 'First-time mapping'}
                  style={{
                    backgroundColor: initialData.company.configured ? '#dcfce7' : '#eff6ff',
                    color: initialData.company.configured ? '#15803d' : '#1d4ed8',
                    border: `1px solid ${initialData.company.configured ? '#bbf7d0' : '#bfdbfe'}`,
                    fontWeight: 600,
                  }}
                />
                <Badge variant="neutral" label={`${selectedLedgerCount} ledgers selected`} style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', color: '#334155' }} />

                <Button
                  label={isSaving ? 'Saving...' : 'Confirm Mapping'}
                  variant="primary"
                  isLoading={isSaving}
                  isDisabled={isSaving}
                  onClick={handleSave}
                  style={{
                    backgroundColor: '#1d4ed8',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    border: '1px solid #1e40af',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px 0 rgba(29, 78, 216, 0.15)',
                    transition: 'all 0.1s ease-in-out',
                  }}
                />

                <Button
                  label="Return"
                  variant="secondary"
                  onClick={() => router.push(returnTo)}
                  style={{
                    border: '1px solid #000000',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                />
              </HStack>
            </HStack>
          </LayoutHeader>
        }
      >
        <LayoutContent padding={0} style={{ height: '100%', overflow: 'hidden', minHeight: 0 }}>
          <HStack gap={0} align="stretch" wrap="nowrap" style={{ height: '100%', overflow: 'hidden' }}>
            {/* Left Column: Ledger Groups (independently scrollable) */}
            <StackItem size="static" style={{ width: `${leftWidth}%`, borderRight: '1px solid var(--color-border)', overflowY: 'auto', background: 'var(--color-bg-sidebar, #fcfcfc)' }}>
              <VStack gap={4} padding={4}>
                <div style={{ width: '100%', maxWidth: '280px' }}>
                  <TextInput
                    label="Search groups"
                    isLabelHidden
                    value={groupSearch}
                    onChange={setGroupSearch}
                    placeholder="Search groups..."
                    hasClear
                  />
                </div>

                {groupSearch.trim() === '' ? (
                  <VStack gap={2} style={{ width: '100%' }}>
                    {groupTree.sort((a, b) => a.name.localeCompare(b.name)).map((root) => renderGroupNode(root, 0))}
                  </VStack>
                ) : (
                  flattenedGroupsForSearch.length > 0 ? (
                    <List density="compact" hasDividers>
                      {flattenedGroupsForSearch.map((group) => {
                        const isActive = selectedGroupIds.has(group.groupId)
                        return (
                          <ListItem
                            key={group.groupId}
                            label={
                              <HStack gap={1} align="center">
                                <span style={{ marginRight: '6px', fontSize: '13px' }}>
                                  📁
                                </span>
                                <Text style={{ color: '#0f172a', fontSize: '14px', fontWeight: 'bold' }}>
                                  {group.name}
                                </Text>
                              </HStack>
                            }
                            description={group.parentName ? `Parent: ${group.parentName}` : undefined}
                            style={{
                              borderRadius: 'var(--radius-md, 6px)',
                              padding: 'var(--spacing-3, 10px) var(--spacing-4, 12px)',
                              backgroundColor: isActive ? '#e0e7ff' : '#f8fafc',
                              border: isActive ? '1.5px solid #6366f1' : '1.5px solid #000000',
                              margin: '4px 0',
                              cursor: 'pointer',
                            }}
                            onClick={() => handleGroupToggle(group.groupId, !isActive)}
                            startContent={
                              <div style={{ pointerEvents: 'none' }}>
                                <CheckboxInput
                                  label={`Select group ${group.name}`}
                                  isLabelHidden
                                  size="sm"
                                  value={isActive}
                                  onChange={() => { }}
                                />
                              </div>
                            }
                          />
                        )
                      })}
                    </List>
                  ) : (
                    <EmptyState
                      title="No groups found"
                      description="No ledger groups match your search."
                      isCompact
                    />
                  )
                )}
              </VStack>
            </StackItem>

            {/* Splitter bar (clickable and resizable splitter drag rail) */}
            <div
              style={{
                width: '6px',
                cursor: 'col-resize',
                background: isDragging ? '#1d4ed8' : '#e2e8f0',
                borderLeft: '1px solid var(--color-border, #cbd5e1)',
                borderRight: '1px solid var(--color-border, #cbd5e1)',
                alignSelf: 'stretch',
                zIndex: 10,
                transition: 'background 0.1s',
              }}
              onMouseDown={handleMouseDown}
            />

            {/* Right Column: Individual Ledgers (independently scrollable) */}
            <StackItem size="fill" style={{ overflowY: 'auto', background: '#ffffff' }}>
              <VStack gap={0}>
                {/* Search & Actions bar */}
                <VStack gap={4} padding={4} style={{ borderBottom: '1px solid var(--color-border)', background: '#ffffff' }}>
                  <HStack gap={3} align="center" justify="between" wrap="wrap">
                    <StackItem size="static" style={{ width: '100%', maxWidth: '300px' }}>
                      <TextInput
                        label="Search ledgers"
                        isLabelHidden
                        value={ledgerSearch}
                        onChange={setLedgerSearch}
                        placeholder="Search ledgers in selected groups..."
                        hasClear
                      />
                    </StackItem>
                    <HStack gap={2}>
                      <Button
                        label="Select all candidates"
                        variant="secondary"
                        onClick={handleSelectAllCandidates}
                        style={{
                          border: '1.5px solid #000000',
                          backgroundColor: '#ffffff',
                          color: '#000000',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      />
                      <Button
                        label="Clear selection"
                        variant="ghost"
                        onClick={handleClearCandidateSelection}
                        style={{
                          border: '1.5px solid #cbd5e1',
                          backgroundColor: '#f8fafc',
                          color: '#475569',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      />
                    </HStack>
                  </HStack>
                </VStack>

                {/* Ledgers Grouped by Tally parent group for maximum visual clarity */}
                {groupedLedgers.length > 0 ? (
                  <VStack gap={5} padding={4}>
                    {groupedLedgers.map(([parentName, groupLedgers]) => (
                      <VStack key={parentName} gap={2}>
                        {/* Group Header */}
                        <HStack gap={2} align="center" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--spacing-2, 6px)', margin: 'var(--spacing-2, 6px) 0' }}>
                          <Text type="label" weight="semibold" style={{ color: '#0f172a', fontSize: 'var(--typography-font-size-body, 14px)' }}>
                            {parentName}
                          </Text>
                          <Badge variant="neutral" label={`${groupLedgers.length} ledgers`} style={{ fontSize: '10px', backgroundColor: '#e2e8f0', color: '#334155' }} />
                        </HStack>

                        <List density="compact">
                          {groupLedgers.map((ledger) => {
                            const isLedgerSelected = ledger.selected
                            return (
                              <ListItem
                                key={ledger.ledgerId}
                                label={ledger.ledgerName}
                                style={{
                                  borderRadius: 'var(--radius-md, 6px)',
                                  padding: 'var(--spacing-2.5, 8px) var(--spacing-3, 10px)',
                                  transition: 'all 0.15s ease-in-out',
                                  backgroundColor: isLedgerSelected ? '#f0fdf4' : '#f8fafc',
                                  border: isLedgerSelected ? '1px solid #22c55e' : '1px solid #cbd5e1',
                                  margin: 'var(--spacing-1.5, 4px) 0',
                                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
                                  cursor: 'pointer',
                                }}
                                onClick={() => handleLedgerToggle(ledger.ledgerId, !ledger.selected)}
                                startContent={
                                  <div style={{ pointerEvents: 'none' }}>
                                    <CheckboxInput
                                      label={`Select ledger ${ledger.ledgerName}`}
                                      isLabelHidden
                                      size="sm"
                                      value={ledger.selected}
                                      onChange={() => { }}
                                    />
                                  </div>
                                }
                                endContent={
                                  <Badge
                                    variant={isLedgerSelected ? 'success' : 'neutral'}
                                    label={isLedgerSelected ? 'Included' : 'Excluded'}
                                    style={{
                                      backgroundColor: isLedgerSelected ? '#dcfce7' : '#f1f5f9',
                                      color: isLedgerSelected ? '#166534' : '#475569',
                                      border: isLedgerSelected ? '1px solid #bbf7d0' : '1px solid #cbd5e1',
                                      fontWeight: 600,
                                    }}
                                  />
                                }
                              />
                            )
                          })}
                        </List>
                      </VStack>
                    ))}
                  </VStack>
                ) : (
                  <EmptyState
                    title={candidateLedgers.length === 0 ? 'No active ledgers' : 'No matches'}
                    description={candidateLedgers.length === 0
                      ? 'Select one or more ledger groups on the left to see their ledger candidates here.'
                      : 'Clear your search to show all ledgers in selected groups.'}
                    isCompact
                  />
                )}
              </VStack>
            </StackItem>
          </HStack>
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
