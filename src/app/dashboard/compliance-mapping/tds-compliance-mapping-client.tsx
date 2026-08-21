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
import type { SaveTdsComplianceMappingPayload, TdsComplianceMappingData } from '@/lib/types'
import { tdsMappingStorageKey } from '@/lib/tds-mapping'
import { saveTdsComplianceMapping } from './actions'

export function TdsComplianceMappingClient({
  initialData,
  returnTo,
}: {
  initialData: TdsComplianceMappingData
  returnTo: string
}) {
  const router = useRouter()
  const [ledgers, setLedgers] = useState(initialData.company.ledgers)
  const [search, setSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCount = ledgers.filter((ledger) => ledger.selected).length
  const filteredLedgers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return ledgers
    return ledgers.filter((ledger) => (
      ledger.ledgerName.toLowerCase().includes(query)
      || ledger.parentName.toLowerCase().includes(query)
    ))
  }, [ledgers, search])

  const setAllSelected = (selected: boolean) => {
    setLedgers((current) => current.map((ledger) => ({ ...ledger, selected })))
  }

  const handleSave = async () => {
    if (!initialData.company.tdsGroupFound) return
    setIsSaving(true)
    setError(null)
    const payload: SaveTdsComplianceMappingPayload = {
      orgId: initialData.orgId,
      companyId: initialData.company.companyId,
      selectedLedgerIds: ledgers
        .filter((ledger) => ledger.selected)
        .map((ledger) => ledger.ledgerId),
    }
    const result = await saveTdsComplianceMapping(payload)
    if (!result.ok) {
      setError(result.error)
      setIsSaving(false)
      return
    }
    localStorage.setItem(
      tdsMappingStorageKey(
        initialData.userId,
        initialData.orgId,
        initialData.company.companyId,
      ),
      'complete',
    )
    router.replace(returnTo)
    router.refresh()
  }

  return (
    <AppShell topNav={<Header />} contentPadding={0} height="fill" variant="section">
      <Layout
        height="fill"
        header={
          <LayoutHeader hasDivider padding={4}>
            <HStack gap={4} align="center" justify="between" wrap="wrap">
              <StackItem size="fill">
                <VStack gap={1}>
                  <Heading level={1}>TDS ledger mapping</Heading>
                  <Text type="supporting">
                    {initialData.company.companyName} · Select the payable ledgers used by the TDS report.
                  </Text>
                </VStack>
              </StackItem>
              <HStack gap={2} align="center" wrap="wrap">
                <Badge
                  variant={initialData.company.configured ? 'success' : 'warning'}
                  label={initialData.company.configured ? 'Mapping complete' : 'First-time mapping'}
                />
                <Badge variant="neutral" label={`${selectedCount} selected`} />
                <Button label="Return" variant="secondary" onClick={() => router.push(returnTo)} />
              </HStack>
            </HStack>
          </LayoutHeader>
        }
        footer={
          <LayoutFooter hasDivider padding={4} label="Confirm TDS mapping">
            <HStack gap={3} align="center" wrap="wrap">
              <StackItem size="fill">
                <VStack gap={0.5}>
                  <Text type="label" weight="semibold">
                    {selectedCount} of {ledgers.length} payable candidate ledgers selected
                  </Text>
                  <Text type="supporting">
                    Deselected ledgers are removed from the saved mapping.
                  </Text>
                  {error && <Text type="supporting">Error: {error}</Text>}
                </VStack>
              </StackItem>
              <Button
                label={isSaving ? 'Saving...' : 'Confirm TDS mapping'}
                variant="primary"
                isLoading={isSaving}
                isDisabled={!initialData.company.tdsGroupFound || isSaving}
                onClick={handleSave}
              />
            </HStack>
          </LayoutFooter>
        }
      >
        <LayoutContent padding={0} label="TDS payable ledger candidates">
          {!initialData.company.tdsGroupFound ? (
            <EmptyState
              title="No TDS ledger group was found"
              description="Create or correct a Tally group whose name contains the standalone term TDS or Tax Deducted at Source, then sync the company again. No mapping can be saved until that hierarchy exists."
              actions={<Button label="Return to dashboard" variant="secondary" onClick={() => router.push(returnTo)} />}
            />
          ) : (
            <VStack gap={0}>
              <VStack gap={3} padding={4}>
                <Text type="supporting">
                  Only payable ledgers inside the detected TDS group and its nested subgroups are eligible.
                  {initialData.company.configured
                    ? ' Your saved mapping is shown below.'
                    : ' Payable candidates are selected automatically for this first review.'}
                </Text>
                <HStack gap={2} align="end" wrap="wrap">
                  <StackItem size="fill">
                    <TextInput
                      label="Search payable candidates"
                      value={search}
                      onChange={setSearch}
                      placeholder="Search by ledger or TDS subgroup"
                      hasClear
                    />
                  </StackItem>
                  <Button label="Select all" variant="secondary" onClick={() => setAllSelected(true)} />
                  <Button label="Clear selection" variant="ghost" onClick={() => setAllSelected(false)} />
                </HStack>
              </VStack>

              {filteredLedgers.length > 0 ? (
                <List header={`${filteredLedgers.length} payable candidates`} density="compact" hasDividers>
                  {filteredLedgers.map((ledger) => (
                    <ListItem
                      key={ledger.ledgerId}
                      label={ledger.ledgerName}
                      description={`Tally group: ${ledger.parentName}`}
                      startContent={
                        <CheckboxInput
                          label={`Select ${ledger.ledgerName}`}
                          isLabelHidden
                          size="sm"
                          value={ledger.selected}
                          onChange={(selected) => setLedgers((current) => current.map((item) => (
                            item.ledgerId === ledger.ledgerId ? { ...item, selected } : item
                          )))}
                        />
                      }
                      endContent={ledger.selected ? <Badge variant="success" label="Selected" /> : undefined}
                    />
                  ))}
                </List>
              ) : (
                <EmptyState
                  title={ledgers.length === 0 ? 'No payable TDS ledgers were found' : 'No candidates match this search'}
                  description={ledgers.length === 0
                    ? 'The TDS hierarchy exists, but all ledgers in it match non-payable terms or the hierarchy contains no ledgers.'
                    : 'Clear the search to see every payable candidate in the TDS hierarchy.'}
                  isCompact
                  actions={search ? <Button label="Clear search" variant="secondary" onClick={() => setSearch('')} /> : undefined}
                />
              )}
            </VStack>
          )}
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
