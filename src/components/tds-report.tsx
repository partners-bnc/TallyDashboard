'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell, Button, Card, CheckboxInput, DateInput, Dialog, DialogHeader, Grid, Heading, HStack, Layout, LayoutContent, Selector, StatusDot, Table, Text, VStack } from '@astryxdesign/core'
import { pixel, proportional } from '@astryxdesign/core/Table'
import Header from '@/components/ui/Header'
import type { TdsAuditTransaction, TdsMonthlyRow, TdsReportData, TdsStatus } from '@/lib/types'
// @ts-expect-error xlsx-js-style does not publish TypeScript declarations.
import XLSX from 'xlsx-js-style'

type TableRow = TdsMonthlyRow & Record<string, unknown>
type AuditRow = TdsAuditTransaction & Record<string, unknown>

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const amount = (value: number) => value === 0 ? '—' : money.format(value)
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00Z`)) : '—'
const query = (values: Record<string, string | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value)
  return params.toString()
}
const isoDate = (value: string) => value as `${number}${number}${number}${number}-${number}${number}-${number}${number}`

const statusVariant = (status: TdsStatus) => status === 'CLEARED_ON_TIME' ? 'success' : status === 'CLEARED_LATE' || status === 'PENDING_NOT_DUE' || status === 'PARTIALLY_CLEARED_NOT_DUE' ? 'warning' : status === 'REVIEW_REQUIRED' || status === 'EXCESS_UNALLOCATED' ? 'accent' : 'error'
const statusLabel = (status: TdsStatus) => status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase())

function exportWorkbook(data: TdsReportData, companyName: string) {
  const workbook = XLSX.utils.book_new()
  const summary = [
    ['TDS Liability Clearance Report'],
    ['Company', companyName],
    ['As of', data.asOfDate],
    [],
    ['Liability created', data.kpis.liabilityCreated], ['Deposited', data.kpis.deposited], ['Outstanding', data.kpis.remaining], ['Overdue', data.kpis.overdue], ['Excess', data.kpis.excess],
  ]
  const detail = data.rows.map((row) => ({ Ledger: row.ledgerName, 'TDS Type': row.tdsType, Section: row.sectionCode ?? '', 'Deduction Month': row.deductionMonth ?? 'Brought forward', 'Opening Outstanding': row.openingOutstanding, Deducted: row.deducted, Reversed: row.reversed, 'Total Due': row.totalDue, 'Due Date': row.dueDate ?? '', Deposited: row.deposited, Remaining: row.remaining, Excess: row.excess, Status: statusLabel(row.status), 'Books Status': row.booksStatus, 'Deposit Dates': row.depositDates.join(', ') }))
  const transactions = data.rows.flatMap((row) => [...row.liabilityTransactions, ...row.depositTransactions].map((item) => ({ Ledger: row.ledgerName, 'Deduction Month': row.deductionMonth ?? 'Brought forward', Date: item.date, 'Voucher Type': item.voucherType, 'Voucher Number': item.voucherNumber ?? '', Party: item.party ?? '', Classification: item.classification, Amount: item.amount, 'Signed Amount': item.rawSignedAmount, Note: item.note ?? '' })))
  const allocations = data.rows.flatMap((row) => row.allocations.map((item) => ({ Ledger: row.ledgerName, 'Deduction Month': row.deductionMonth ?? 'Brought forward', 'Deposit Date': item.depositDate, 'Deposit Voucher': item.depositVoucherNumber ?? '', Allocated: item.allocatedAmount, 'On Time': item.onTimeAmount, Late: item.lateAmount, 'Due Date': item.dueDate ?? '', 'Delay Days': item.delayDays ?? '' })))
  const reconciliation = data.reconciliation.map((item) => ({ Ledger: item.ledgerName, 'Ledger Closing Balance': item.expected, Reconstructed: item.reconstructed, Difference: item.difference, Reconciled: item.withinTolerance ? 'Yes' : 'No' }))
  for (const [name, rows] of [['Summary', summary], ['Monthly Detail', detail], ['Transactions', transactions], ['Allocations', allocations], ['Reconciliation', reconciliation]] as const) {
    const sheet = name === 'Summary' ? XLSX.utils.aoa_to_sheet(rows) : XLSX.utils.json_to_sheet(rows as object[])
    XLSX.utils.book_append_sheet(workbook, sheet, name)
  }
  XLSX.writeFile(workbook, `tds-liability-clearance-${companyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${data.asOfDate}.xlsx`)
}

export function TdsReport({ orgId, companyId, companyName, data, from, to, asOf }: { orgId: string; companyId: string; companyName: string; data: TdsReportData | null; from: string; to: string; asOf: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const [draftAsOf, setDraftAsOf] = useState(asOf)
  const [ledger, setLedger] = useState('all')
  const [status, setStatus] = useState('all')
  const [showCleared, setShowCleared] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const visibleRows = useMemo(() => (data?.rows ?? []).filter((row) => (ledger === 'all' || row.ledgerId === ledger) && (status === 'all' || row.status === status) && (showCleared || !['CLEARED_ON_TIME', 'CLEARED_LATE'].includes(row.status)) && (!row.deductionMonth || (row.deductionMonth >= `${from.slice(0, 7)}-01` && row.deductionMonth <= `${to.slice(0, 7)}-01`))), [data, from, ledger, showCleared, status, to])
  const selected = visibleRows.find((row) => row.id === selectedId) ?? null
  const applyDates = () => startTransition(() => router.push(`/dashboard/tds-report?${query({ org: orgId, company: companyId, from: draftFrom, to: draftTo, asOf: draftAsOf })}`))
  const ledgerOptions = [{ label: 'All TDS ledgers', value: 'all' }, ...(data?.ledgerOptions ?? []).map((item) => ({ label: item.label, value: item.id }))]
  const statusOptions = [{ label: 'All statuses', value: 'all' }, ...(['CLEARED_ON_TIME', 'CLEARED_LATE', 'PARTIALLY_CLEARED_OVERDUE', 'PARTIALLY_CLEARED_NOT_DUE', 'UNPAID_OVERDUE', 'PENDING_NOT_DUE', 'EXCESS_UNALLOCATED', 'REVIEW_REQUIRED'] as TdsStatus[]).map((item) => ({ label: statusLabel(item), value: item }))]
  const mainColumns = [
    { key: 'ledgerName', header: 'Ledger / section', width: proportional(2), renderCell: (row: TableRow) => <VStack gap={0.5}><Text weight="semibold">{row.ledgerName}</Text><Text type="supporting">{row.tdsType}{row.sectionCode ? ` · ${row.sectionCode}` : ''}</Text></VStack> },
    { key: 'deductionMonth', header: 'Deduction month', width: proportional(1), renderCell: (row: TableRow) => <Text>{row.deductionMonth ? date(row.deductionMonth) : 'Brought forward'}</Text> },
    { key: 'totalDue', header: 'Liability', width: proportional(1), align: 'end' as const, renderCell: (row: TableRow) => <Text hasTabularNumbers>{amount(row.totalDue)}</Text> },
    { key: 'deposited', header: 'Deposited', width: proportional(1), align: 'end' as const, renderCell: (row: TableRow) => <Text hasTabularNumbers>{amount(row.deposited)}</Text> },
    { key: 'remaining', header: 'Outstanding', width: proportional(1), align: 'end' as const, renderCell: (row: TableRow) => <Text hasTabularNumbers>{amount(row.remaining || row.excess)}</Text> },
    { key: 'dueDate', header: 'Due date', width: proportional(1), renderCell: (row: TableRow) => <Text>{date(row.dueDate)}</Text> },
    { key: 'status', header: 'Clearance status', width: proportional(2), renderCell: (row: TableRow) => <HStack gap={1} align="center"><StatusDot variant={statusVariant(row.status)} label={statusLabel(row.status)} /><Text>{statusLabel(row.status)}</Text></HStack> },
    { key: 'detail', header: 'Audit', width: pixel(88), renderCell: (row: TableRow) => <Button label="View" size="sm" variant="ghost" onClick={() => setSelectedId(row.id)} /> },
  ]
  const auditColumns = [{ key: 'date', header: 'Date', width: proportional(1), renderCell: (row: AuditRow) => <Text>{date(row.date)}</Text> }, { key: 'voucherType', header: 'Voucher details', width: proportional(3), renderCell: (row: AuditRow) => <VStack gap={0.5}><Text weight="semibold">{row.voucherType} {row.voucherNumber ?? ''}</Text><Text>{row.party ?? '—'}</Text><Text type="supporting">{row.note ?? ''}</Text></VStack> }, { key: 'classification', header: 'Classification', width: proportional(1), renderCell: (row: AuditRow) => <Text>{statusLabel(row.classification as TdsStatus)}</Text> }, { key: 'amount', header: 'Amount', width: proportional(1), align: 'end' as const, renderCell: (row: AuditRow) => <Text hasTabularNumbers>{amount(row.amount)}</Text> }]
  return <AppShell topNav={<Header />} mobileNav={false} height="auto" contentPadding={4}>
    <VStack gap={5}>
      <HStack justify="between" align="center" gap={3}>
        <VStack gap={1}><Heading level={1}>TDS Liability Clearance</Heading><Text type="supporting">{companyName} · Books view as of {date(asOf)}</Text></VStack>
        <HStack gap={2}><Button label="Back to dashboard" variant="secondary" onClick={() => router.push(`/dashboard?${query({ org: orgId, company: companyId, from, to })}`)} /><Button label="Export Excel" variant="primary" isDisabled={!data} onClick={() => data && exportWorkbook(data, companyName)} /></HStack>
      </HStack>
      <Card padding={4}><HStack gap={3} align="end"><DateInput label="From" value={isoDate(draftFrom)} onChange={(value) => setDraftFrom(value ?? '')} /><DateInput label="To" value={isoDate(draftTo)} onChange={(value) => setDraftTo(value ?? '')} /><DateInput label="Books as of" value={isoDate(draftAsOf)} onChange={(value) => setDraftAsOf(value ?? '')} /><Button label="Apply period" variant="primary" isLoading={isPending} onClick={applyDates} /></HStack></Card>
      {!data ? <Card variant="red" padding={4}><Text>Could not load the TDS report. Confirm the selected company has a completed sync and try again.</Text></Card> : <>
        <Grid columns={{ minWidth: 220, max: 4 }} gap={3}>
          {[['Liability created', data.kpis.liabilityCreated], ['Deposited', data.kpis.deposited], ['Outstanding', data.kpis.remaining], ['Overdue', data.kpis.overdue]].map(([label, value]) => <Card key={String(label)} padding={3}><VStack gap={1}><Text type="supporting">{String(label)}</Text><Heading level={2}>{amount(Number(value))}</Heading></VStack></Card>)}
        </Grid>
        <Card padding={4}><HStack gap={3} align="end"><Selector label="Ledger" options={ledgerOptions} value={ledger} onChange={setLedger} hasSearch /><Selector label="Status" options={statusOptions} value={status} onChange={setStatus} /><CheckboxInput label="Include cleared rows" value={showCleared} onChange={setShowCleared} /></HStack></Card>
        <VStack gap={2}>
          <Heading level={2}>Monthly clearance</Heading>
          <Text type="supporting">Payments are allocated oldest outstanding liability first. Review-required entries need accounting confirmation before filing.</Text>
          <Table<TableRow> data={visibleRows as TableRow[]} columns={mainColumns} idKey="id" density="compact" dividers="rows" hasHover />
        </VStack>
        <Dialog isOpen={!!selected} onOpenChange={(isOpen) => { if (!isOpen) setSelectedId(null) }} width="min(42rem, 92vw)" maxHeight="100dvh" position={{ right: 0, top: 0, bottom: 0 }} purpose="info" padding={0} style={{ height: '100dvh', margin: 0, borderRadius: 'var(--radius-none)', overflow: 'hidden' }}>
          {selected ? <Layout
            height="fill"
            header={<DialogHeader title="Audit trail" subtitle={`${selected.ledgerName} / ${selected.deductionMonth ? date(selected.deductionMonth) : 'Brought forward'}`} onOpenChange={(isOpen) => { if (!isOpen) setSelectedId(null) }} hasDivider />}
            content={<LayoutContent padding={4}>
              <VStack gap={3}>
                <HStack gap={2} align="center"><StatusDot variant={statusVariant(selected.status)} label={statusLabel(selected.status)} /><Text>{statusLabel(selected.status)} · due {date(selected.dueDate)} · deposits {selected.depositDates.map(date).join(', ') || '—'}</Text></HStack>
                <Table<AuditRow> data={[...selected.liabilityTransactions, ...selected.depositTransactions] as AuditRow[]} columns={auditColumns} idKey="id" density="compact" dividers="rows" />
              </VStack>
            </LayoutContent>}
          /> : <VStack gap={0} />}
        </Dialog>
        <VStack gap={2}><Heading level={2}>Book reconciliation</Heading><Table data={data.reconciliation.map((item) => ({ ...item, id: item.ledgerId }))} idKey="id" density="compact" dividers="rows" columns={[{ key: 'ledgerName', header: 'Ledger', width: proportional(2) }, { key: 'expected', header: 'Ledger closing', width: proportional(1), align: 'end', renderCell: (row) => <Text>{amount(Number(row.expected))}</Text> }, { key: 'reconstructed', header: 'Reconstructed', width: proportional(1), align: 'end', renderCell: (row) => <Text>{amount(Number(row.reconstructed))}</Text> }, { key: 'difference', header: 'Difference', width: proportional(1), align: 'end', renderCell: (row) => <Text>{amount(Number(row.difference))}</Text> }, { key: 'withinTolerance', header: 'Result', width: proportional(1), renderCell: (row) => <HStack gap={1}><StatusDot variant={row.withinTolerance ? 'success' : 'error'} label={row.withinTolerance ? 'Reconciled' : 'Review'} /><Text>{row.withinTolerance ? 'Reconciled' : 'Review'}</Text></HStack> }]} /></VStack>
      </>}
    </VStack>
  </AppShell>
}
