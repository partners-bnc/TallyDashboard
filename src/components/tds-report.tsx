'use client'

/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 · genre: modern-minimal · macrostructure: Workbench · theme: existing neutral with blue signal · slop: pass */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell, Button, Card, CheckboxInput, DateInput, Dialog, DialogHeader, Grid, Heading, HStack, Layout, LayoutContent, Section, Selector, StatusDot, Table, Text, Token, VStack } from '@astryxdesign/core'
import { pixel, proportional } from '@astryxdesign/core/Table'
import { ArrowLeft, CalendarDays, Download } from 'lucide-react'
import Header from '@/components/ui/Header'
import type { TdsAuditTransaction, TdsMonthlyRow, TdsReportData, TdsStatus } from '@/lib/types'
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
const statusColor = (status: TdsStatus) => status === 'CLEARED_ON_TIME' ? 'green' : status === 'CLEARED_LATE' || status === 'PENDING_NOT_DUE' || status === 'PARTIALLY_CLEARED_NOT_DUE' ? 'orange' : status === 'REVIEW_REQUIRED' || status === 'EXCESS_UNALLOCATED' ? 'blue' : 'red'
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
  const statusCounts = useMemo(() => visibleRows.reduce<Record<string, number>>((counts, row) => ({ ...counts, [row.status]: (counts[row.status] ?? 0) + 1 }), {}), [visibleRows])
  const depositCoverage = data?.kpis.liabilityCreated ? Math.min(100, (data.kpis.deposited / data.kpis.liabilityCreated) * 100) : 0
  const reconciliationIssues = data?.reconciliation.filter((item) => !item.withinTolerance).length ?? 0
  const mainColumns = [
    { key: 'ledgerName', header: 'Ledger / section', width: proportional(2), renderCell: (row: TableRow) => <VStack gap={0.5}><Text weight="semibold">{row.ledgerName}</Text><Text type="supporting">{row.tdsType}{row.sectionCode ? ` · ${row.sectionCode}` : ''}</Text></VStack> },
    { key: 'deductionMonth', header: 'Deduction month', width: proportional(1), renderCell: (row: TableRow) => <Text>{row.deductionMonth ? date(row.deductionMonth) : 'Brought forward'}</Text> },
    { key: 'totalDue', header: 'Liability', width: proportional(1), align: 'end' as const, renderCell: (row: TableRow) => <Text hasTabularNumbers>{amount(row.totalDue)}</Text> },
    { key: 'deposited', header: 'Deposited', width: proportional(1), align: 'end' as const, renderCell: (row: TableRow) => <Text hasTabularNumbers>{amount(row.deposited)}</Text> },
    { key: 'remaining', header: 'Outstanding', width: proportional(1), align: 'end' as const, renderCell: (row: TableRow) => <Text hasTabularNumbers>{amount(row.remaining || row.excess)}</Text> },
    { key: 'dueDate', header: 'Due date', width: proportional(1), renderCell: (row: TableRow) => <Text>{date(row.dueDate)}</Text> },
    { key: 'status', header: 'Clearance status', width: proportional(2), renderCell: (row: TableRow) => <Token label={statusLabel(row.status)} color={statusColor(row.status)} size="sm" /> },
    { key: 'detail', header: 'Audit', width: pixel(88), renderCell: (row: TableRow) => <Button label="View" size="sm" variant="ghost" onClick={() => setSelectedId(row.id)} /> },
  ]
  const auditColumns = [{ key: 'date', header: 'Date', width: proportional(1), renderCell: (row: AuditRow) => <Text>{date(row.date)}</Text> }, { key: 'voucherType', header: 'Voucher details', width: proportional(3), renderCell: (row: AuditRow) => <VStack gap={0.5}><Text weight="semibold">{row.voucherType} {row.voucherNumber ?? ''}</Text><Text>{row.party ?? '—'}</Text><Text type="supporting">{row.note ?? ''}</Text></VStack> }, { key: 'classification', header: 'Classification', width: proportional(1), renderCell: (row: AuditRow) => <Text>{statusLabel(row.classification as TdsStatus)}</Text> }, { key: 'amount', header: 'Amount', width: proportional(1), align: 'end' as const, renderCell: (row: AuditRow) => <Text hasTabularNumbers>{amount(row.amount)}</Text> }]
  return <AppShell topNav={<Header />} mobileNav={false} height="auto" contentPadding={4}>
    <VStack gap={8}>
      <Section variant="transparent" padding={2} dividers={['bottom']}>
        <Grid columns={{ minWidth: 280, max: 2, repeat: 'fit' }} gap={4} align="center">
          <VStack gap={1}>
            <Text type="supporting">Tax compliance · Liability workbench</Text>
            <Heading level={1}>TDS Liability Clearance</Heading>
            <Text>{companyName}</Text>
            <Text type="supporting">Books reconstructed through {date(asOf)}</Text>
          </VStack>
          <HStack gap={2} justify="end">
            <Button label="Dashboard" icon={<ArrowLeft aria-hidden />} variant="ghost" onClick={() => router.push(`/dashboard?${query({ org: orgId, company: companyId, from, to })}`)} />
            <Button label="Export workbook" icon={<Download aria-hidden />} variant="secondary" isDisabled={!data} onClick={() => data && exportWorkbook(data, companyName)} />
          </HStack>
        </Grid>
      </Section>

      <Section variant="muted" padding={5}>
        <VStack gap={4}>
          <HStack gap={2} align="center"><CalendarDays aria-hidden /><VStack gap={0.5}><Heading level={3}>Reporting period</Heading><Text type="supporting">Set the deduction window and the books cut-off used for deposit matching.</Text></VStack></HStack>
          <Grid columns={{ minWidth: 180, max: 4, repeat: 'fit' }} gap={3} align="end">
            <DateInput label="From" value={isoDate(draftFrom)} onChange={(value) => setDraftFrom(value ?? '')} />
            <DateInput label="To" value={isoDate(draftTo)} onChange={(value) => setDraftTo(value ?? '')} />
            <DateInput label="Books as of" value={isoDate(draftAsOf)} onChange={(value) => setDraftAsOf(value ?? '')} />
            <Button label="Apply period" variant="primary" isLoading={isPending} onClick={applyDates} />
          </Grid>
        </VStack>
      </Section>
      {!data ? <Card variant="red" padding={4}><Text>Could not load the TDS report. Confirm the selected company has a completed sync and try again.</Text></Card> : <>
        <VStack gap={4}>
          <VStack gap={1}><Text type="supporting">Position at {date(asOf)}</Text><Heading level={2}>Liability flow</Heading></VStack>
          <Grid columns={{ minWidth: 220, max: 4, repeat: 'fit' }} gap={3}>
            <Card padding={4}><VStack gap={2}><Text type="supporting">Liability created</Text><Heading level={2}>{amount(data.kpis.liabilityCreated)}</Heading><Text type="supporting">Total due in the selected period</Text></VStack></Card>
            <Card padding={4}><VStack gap={2}><Text type="supporting">Deposited</Text><Heading level={2}>{amount(data.kpis.deposited)}</Heading><Text type="supporting">{depositCoverage.toFixed(1)}% of liability funded</Text></VStack></Card>
            <Card variant={data.kpis.remaining > 0 ? 'orange' : 'muted'} padding={4}><VStack gap={2}><Text type="supporting">Outstanding</Text><Heading level={2}>{amount(data.kpis.remaining)}</Heading><Text type="supporting">Not yet matched to deposits</Text></VStack></Card>
            <Card variant={data.kpis.overdue > 0 ? 'red' : 'muted'} padding={4}><VStack gap={2}><Text type="supporting">Overdue exposure</Text><Heading level={2}>{amount(data.kpis.overdue)}</Heading><Text type="supporting">Past the statutory due date</Text></VStack></Card>
          </Grid>
          <Section variant="muted" padding={3}>
            <Grid columns={{ minWidth: 180, max: 4, repeat: 'fit' }} gap={3}>
              <VStack gap={1}><Text type="supporting">Cleared on time</Text><Heading level={3}>{statusCounts.CLEARED_ON_TIME ?? 0} months</Heading></VStack>
              <VStack gap={1}><Text type="supporting">Cleared late</Text><Heading level={3}>{statusCounts.CLEARED_LATE ?? 0} months</Heading></VStack>
              <VStack gap={1}><Text type="supporting">Excess deposits</Text><Heading level={3}>{amount(data.kpis.excess)}</Heading></VStack>
              <VStack gap={1}><Text type="supporting">Reconciliation</Text><Heading level={3}>{reconciliationIssues === 0 ? 'Books aligned' : `${reconciliationIssues} to review`}</Heading></VStack>
            </Grid>
          </Section>
        </VStack>

        <Section variant="transparent" padding={0} dividers={['top', 'bottom']}>
          <VStack gap={3}>
            <VStack gap={1}><Heading level={3}>Refine the ledger</Heading><Text type="supporting">Showing {visibleRows.length} of {data.rows.length} monthly positions.</Text></VStack>
            <Grid columns={{ minWidth: 220, max: 3, repeat: 'fit' }} gap={3} align="end">
              <Selector label="Ledger" options={ledgerOptions} value={ledger} onChange={setLedger} hasSearch />
              <Selector label="Clearance status" options={statusOptions} value={status} onChange={setStatus} />
              <CheckboxInput label="Include cleared rows" value={showCleared} onChange={setShowCleared} />
            </Grid>
          </VStack>
        </Section>

        <VStack gap={3}>
          <VStack gap={1}><Heading level={2}>Monthly clearance</Heading><Text type="supporting">Deposits are allocated to the oldest outstanding liability first. Open any row to inspect its voucher trail.</Text></VStack>
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
        <Section variant="muted" padding={4}>
          <VStack gap={3}>
            <VStack gap={1}><Heading level={2}>Book reconciliation</Heading><Text type="supporting">Ledger closings are compared with the reconstructed liability position. Differences outside tolerance require review.</Text></VStack>
            <Table data={data.reconciliation.map((item) => ({ ...item, id: item.ledgerId }))} idKey="id" density="compact" dividers="rows" columns={[{ key: 'ledgerName', header: 'Ledger', width: proportional(2) }, { key: 'expected', header: 'Ledger closing', width: proportional(1), align: 'end', renderCell: (row) => <Text hasTabularNumbers>{amount(Number(row.expected))}</Text> }, { key: 'reconstructed', header: 'Reconstructed', width: proportional(1), align: 'end', renderCell: (row) => <Text hasTabularNumbers>{amount(Number(row.reconstructed))}</Text> }, { key: 'difference', header: 'Difference', width: proportional(1), align: 'end', renderCell: (row) => <Text hasTabularNumbers>{amount(Number(row.difference))}</Text> }, { key: 'withinTolerance', header: 'Result', width: proportional(1), renderCell: (row) => <Token label={row.withinTolerance ? 'Reconciled' : 'Review'} color={row.withinTolerance ? 'green' : 'red'} size="sm" /> }]} />
          </VStack>
        </Section>
      </>}
    </VStack>
  </AppShell>
}
