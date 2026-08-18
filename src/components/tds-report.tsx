'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell, Card, Dialog, Grid, Heading, HStack, Layout, LayoutContent, Text, VStack } from '@astryxdesign/core'
import { ArrowLeft, CalendarDays, Download, Eye, CheckCircle2, AlertTriangle, Clock, TrendingUp, ShieldCheck, AlertCircle, X } from 'lucide-react'
import Header from '@/components/ui/Header'
import type { TdsReportData, TdsStatus } from '@/lib/types'
import XLSX from 'xlsx-js-style'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const amount = (value: number) => value === 0 ? '—' : money.format(value)
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00Z`)) : '—'
const query = (values: Record<string, string | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value)
  return params.toString()
}
const isoDate = (value: string) => value as `${number}${number}${number}${number}-${number}${number}-${number}${number}`

const statusColor = (status: TdsStatus) => status === 'CLEARED_ON_TIME' || status === 'REVERSED' ? 'green' : status === 'CLEARED_LATE' || status === 'PENDING_NOT_DUE' || status === 'PARTIALLY_CLEARED_NOT_DUE' ? 'orange' : status === 'REVIEW_REQUIRED' || status === 'EXCESS_UNALLOCATED' ? 'blue' : 'red'
const statusLabel = (status: TdsStatus) => status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase())

const statusBadgeClass = (status: TdsStatus) => {
  const color = statusColor(status)
  if (color === 'green') return 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
  if (color === 'orange') return 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
  if (color === 'blue') return 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
  return 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
}

const statusDotClass = (status: TdsStatus) => {
  const color = statusColor(status)
  if (color === 'green') return 'bg-emerald-500'
  if (color === 'orange') return 'bg-amber-500'
  if (color === 'blue') return 'bg-blue-500'
  return 'bg-rose-500'
}

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
  const allocations = data.rows.flatMap((row) => row.allocations.map((item) => ({ Ledger: row.ledgerName, 'Deduction Month': row.deductionMonth ?? 'Brought forward', 'Source Type': item.sourceType, 'Source Date': item.sourceDate, 'Source Voucher': item.sourceVoucherNumber ?? '', Allocated: item.allocatedAmount, 'On Time': item.onTimeAmount, Late: item.lateAmount, 'Due Date': item.dueDate ?? '', 'Delay Days': item.delayDays ?? '' })))
  const ledgerPositions = data.ledgerPositions.map((item) => ({ Ledger: item.ledgerName, Outstanding: item.outstanding, Excess: item.excess }))
  const reconciliation = data.reconciliation.map((item) => ({ Ledger: item.ledgerName, 'Computed Outstanding': data.ledgerPositions.find((ledger) => ledger.ledgerId === item.ledgerId)?.outstanding ?? 0, 'Ledger Closing Balance': item.expected, 'Reconstructed Net Position': item.reconstructed, Difference: item.difference, Reconciled: item.withinTolerance ? 'Yes' : 'No' }))
  for (const [name, rows] of [['Summary', summary], ['Ledger Positions', ledgerPositions], ['Monthly Detail', detail], ['Transactions', transactions], ['Allocations', allocations], ['Reconciliation', reconciliation]] as const) {
    const sheet = name === 'Summary' ? XLSX.utils.aoa_to_sheet(rows) : XLSX.utils.json_to_sheet(rows as object[])
    XLSX.utils.book_append_sheet(workbook, sheet, name)
  }
  XLSX.writeFile(workbook, `tds-liability-clearance-${companyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${data.asOfDate}.xlsx`)
}

export function TdsReport({ orgId, companyId, companyName, data, from, to, asOf, initialLedger = 'all' }: { orgId: string; companyId: string; companyName: string; data: TdsReportData | null; from: string; to: string; asOf: string; initialLedger?: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const [ledger, setLedger] = useState(initialLedger)
  const [status, setStatus] = useState('all')
  const [showCleared, setShowCleared] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  
  const visibleRows = useMemo(() => (data?.rows ?? []).filter((row) => (ledger === 'all' || row.ledgerId === ledger) && (status === 'all' || row.status === status) && (showCleared || !['CLEARED_ON_TIME', 'CLEARED_LATE'].includes(row.status)) && (!row.deductionMonth || (row.deductionMonth >= `${from.slice(0, 7)}-01` && row.deductionMonth <= `${to.slice(0, 7)}-01`))), [data, from, ledger, showCleared, status, to])
  const selected = visibleRows.find((row) => row.id === selectedId) ?? null
  const applyDates = () => startTransition(() => router.push(`/dashboard/tds-report?${query({ org: orgId, company: companyId, from: draftFrom, to: draftTo, ledger: ledger === 'all' ? undefined : ledger })}`))
  
  const ledgerOptions = [{ label: 'All TDS ledgers', value: 'all' }, ...(data?.ledgerOptions ?? []).map((item) => ({ label: item.label, value: item.id }))]
  const statusOptions = [{ label: 'All statuses', value: 'all' }, ...(['CLEARED_ON_TIME', 'CLEARED_LATE', 'REVERSED', 'PARTIALLY_CLEARED_OVERDUE', 'PARTIALLY_CLEARED_NOT_DUE', 'UNPAID_OVERDUE', 'PENDING_NOT_DUE', 'EXCESS_UNALLOCATED', 'REVIEW_REQUIRED'] as TdsStatus[]).map((item) => ({ label: statusLabel(item), value: item }))]
  const statusCounts = useMemo(() => visibleRows.reduce<Record<string, number>>((counts, row) => ({ ...counts, [row.status]: (counts[row.status] ?? 0) + 1 }), {}), [visibleRows])
  const depositCoverage = data?.kpis.liabilityCreated ? Math.min(100, (data.kpis.deposited / data.kpis.liabilityCreated) * 100) : 0
  const reconciliationIssues = data?.reconciliation.filter((item) => !item.withinTolerance).length ?? 0

  return <AppShell topNav={<Header />} mobileNav={false} height="auto" contentPadding={4}>
    <VStack gap={8}>
      {/* Premium Header Box */}
      <Card padding={5} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <VStack gap={1}>
            <Text type="supporting" weight="semibold">TAX COMPLIANCE · LIABILITY WORKBENCH</Text>
            <Heading level={1} style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.03em' }}>{companyName}</Heading>
            <Text type="supporting">TDS Liability Clearance · Books reconstructed through {date(asOf)}</Text>
          </VStack>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push(`/dashboard?${query({ org: orgId, company: companyId, from, to })}`)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 transition-all font-semibold shadow-sm cursor-pointer"
            >
              <ArrowLeft size={16} />
              Dashboard
            </button>
            <button 
              disabled={!data}
              onClick={() => data && exportWorkbook(data, companyName)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm transition-all font-semibold shadow-sm cursor-pointer"
            >
              <Download size={16} />
              Export Workbook
            </button>
          </div>
        </div>
      </Card>

      {/* Deduction Period Card */}
      <Card padding={5} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
        <VStack gap={4}>
          <HStack gap={3} align="center">
            <div style={{ padding: '8px', borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <CalendarDays size={20} />
            </div>
            <VStack gap={0.5}>
              <Heading level={3}>Deduction Period</Heading>
              <Text type="supporting">Filter deduction months. Books and deposit matching remain fixed through {date(asOf)}.</Text>
            </VStack>
          </HStack>
          <div className="flex flex-wrap items-end gap-4">
            {/* From Date */}
            <div className="flex flex-col gap-1.5 w-full sm:w-[180px]">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deduction From</span>
              <input 
                type="date" 
                value={isoDate(draftFrom)} 
                max={isoDate(asOf)}
                onChange={(e) => setDraftFrom(e.target.value)} 
                className="h-10 px-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
            {/* To Date */}
            <div className="flex flex-col gap-1.5 w-full sm:w-[180px]">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deduction To</span>
              <input 
                type="date" 
                value={isoDate(draftTo)} 
                max={isoDate(asOf)}
                onChange={(e) => setDraftTo(e.target.value)} 
                className="h-10 px-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
            {/* Apply Button */}
            <button 
              type="button" 
              disabled={isPending} 
              onClick={applyDates}
              className="h-10 px-5 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm transition-all font-semibold shadow-sm cursor-pointer w-full sm:w-auto min-w-[140px]"
            >
              {isPending ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CalendarDays size={16} />
              )}
              Apply Period
            </button>
          </div>
        </VStack>
      </Card>

      {!data ? <Card variant="red" padding={4}><Text>Could not load the TDS report. Confirm the selected company has a completed sync and try again.</Text></Card> : <>
        {reconciliationIssues > 0 && <Card variant="red" padding={4}>
          <VStack gap={1}>
            <Heading level={3}>{reconciliationIssues} ledger {reconciliationIssues === 1 ? 'mismatch' : 'mismatches'} require review</Heading>
            <Text>The outstanding figures below remain the reconstructed amounts. Tally closing balances are shown only as reconciliation evidence and do not replace the calculation.</Text>
          </VStack>
        </Card>}
        {/* KPIs and Summary Cards */}
        <VStack gap={4}>
          <VStack gap={1}><Text type="supporting">Position at {date(asOf)}</Text><Heading level={2}>Liability Flow</Heading></VStack>
          <Grid columns={{ minWidth: 220, max: 4, repeat: 'fit' }} gap={3}>
            {/* Liability Created */}
            <Card padding={4} style={{ background: 'oklch(97% 0.01 245)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
              <VStack gap={2}>
                <HStack justify="between" align="center">
                  <Text type="supporting" weight="semibold">LIABILITY CREATED</Text>
                  <TrendingUp className="text-blue-500" size={18} />
                </HStack>
                <Heading level={2} style={{ fontSize: '24px', fontWeight: '700' }}>{amount(data.kpis.liabilityCreated)}</Heading>
                <Text type="supporting">Total due in the selected period</Text>
              </VStack>
            </Card>
            {/* Deposited */}
            <Card padding={4} style={{ background: 'oklch(98% 0.02 145)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
              <VStack gap={2}>
                <HStack justify="between" align="center">
                  <Text type="supporting" weight="semibold">DEPOSITED</Text>
                  <ShieldCheck className="text-green-500" size={18} />
                </HStack>
                <Heading level={2} style={{ fontSize: '24px', fontWeight: '700' }}>{amount(data.kpis.deposited)}</Heading>
                <Text type="supporting">{depositCoverage.toFixed(1)}% of liability funded</Text>
              </VStack>
            </Card>
            {/* Outstanding */}
            <Card padding={4} style={{ background: 'oklch(98% 0.02 75)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
              <VStack gap={2}>
                <HStack justify="between" align="center">
                  <Text type="supporting" weight="semibold">OUTSTANDING</Text>
                  <AlertCircle className={data.kpis.remaining > 0 ? 'text-amber-500' : 'text-slate-400'} size={18} />
                </HStack>
                <Heading level={2} style={{ fontSize: '24px', fontWeight: '700' }}>{amount(data.kpis.remaining)}</Heading>
                <Text type="supporting">Not yet matched to deposits</Text>
              </VStack>
            </Card>
            {/* Overdue Exposure */}
            <Card padding={4} style={{ background: 'oklch(98% 0.02 25)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
              <VStack gap={2}>
                <HStack justify="between" align="center">
                  <Text type="supporting" weight="semibold">OVERDUE EXPOSURE</Text>
                  <AlertTriangle className={data.kpis.overdue > 0 ? 'text-red-500' : 'text-slate-400'} size={18} />
                </HStack>
                <Heading level={2} style={{ fontSize: '24px', fontWeight: '700' }}>{amount(data.kpis.overdue)}</Heading>
                <Text type="supporting">Past the statutory due date</Text>
              </VStack>
            </Card>
          </Grid>

          {/* Metrics Row */}
          <Grid columns={{ minWidth: 180, max: 4, repeat: 'fit' }} gap={3}>
            <Card padding={4} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
              <HStack gap={3} align="center">
                <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--positive-soft)', color: 'var(--positive)' }}>
                  <CheckCircle2 size={20} />
                </div>
                <VStack gap={0.5}>
                  <Text type="supporting" weight="semibold">CLEARED ON TIME</Text>
                  <Heading level={3} style={{ fontSize: '20px', fontWeight: '700' }}>{statusCounts.CLEARED_ON_TIME ?? 0} months</Heading>
                </VStack>
              </HStack>
            </Card>
            <Card padding={4} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
              <HStack gap={3} align="center">
                <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                  <Clock size={20} />
                </div>
                <VStack gap={0.5}>
                  <Text type="supporting" weight="semibold">CLEARED LATE</Text>
                  <Heading level={3} style={{ fontSize: '20px', fontWeight: '700' }}>{statusCounts.CLEARED_LATE ?? 0} months</Heading>
                </VStack>
              </HStack>
            </Card>
            <Card padding={4} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
              <HStack gap={3} align="center">
                <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  <TrendingUp size={20} />
                </div>
                <VStack gap={0.5}>
                  <Text type="supporting" weight="semibold">EXCESS DEPOSITS</Text>
                  <Heading level={3} style={{ fontSize: '20px', fontWeight: '700' }}>{amount(data.kpis.excess)}</Heading>
                </VStack>
              </HStack>
            </Card>
            <Card padding={4} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', borderColor: reconciliationIssues > 0 ? 'var(--negative)' : 'var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
              <HStack gap={3} align="center">
                <div style={{ padding: '8px', borderRadius: '8px', background: reconciliationIssues > 0 ? 'var(--negative-soft)' : 'var(--paper)', color: reconciliationIssues > 0 ? 'var(--negative)' : 'var(--muted)' }}>
                  <AlertTriangle size={20} />
                </div>
                <VStack gap={0.5}>
                  <Text type="supporting" weight="semibold">RECONCILIATION</Text>
                  <Heading level={3} style={{ fontSize: '20px', fontWeight: '700', color: reconciliationIssues > 0 ? 'var(--negative)' : 'var(--foreground)' }}>
                    {reconciliationIssues === 0 ? 'Books Aligned' : `${reconciliationIssues} to review`}
                  </Heading>
                </VStack>
              </HStack>
            </Card>
          </Grid>
        </VStack>

        {/* Refine Ledger Panel */}
        <div style={{ paddingLeft: '12px', paddingRight: '12px' }}>
          <Card padding={5} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
            <VStack gap={4}>
              <VStack gap={1}>
                <Heading level={3}>Refine the Ledger</Heading>
                <Text type="supporting">Showing {visibleRows.length} of {data.rows.length} monthly positions.</Text>
              </VStack>
              <div className="flex flex-wrap items-center gap-6">
                {/* Ledger */}
                <div className="flex flex-col gap-1.5 w-full sm:w-[240px]">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ledger</span>
                  <select 
                    value={ledger} 
                    onChange={(e) => setLedger(e.target.value)}
                    className="h-10 px-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                  >
                    {ledgerOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Clearance Status */}
                <div className="flex flex-col gap-1.5 w-full sm:w-[200px]">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clearance Status</span>
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-10 px-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Include Cleared Rows */}
                <label className="flex items-center gap-2 mt-5 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={showCleared} 
                    onChange={(e) => setShowCleared(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Include cleared rows</span>
                </label>
              </div>
            </VStack>
          </Card>
        </div>

        {/* Monthly Clearance Table */}
        <VStack gap={4} style={{ paddingLeft: '12px', paddingRight: '12px' }}>
          <VStack gap={1}>
            <Heading level={2}>Monthly Clearance</Heading>
            <Text type="supporting">Deposits are allocated to the oldest outstanding liability first. Open any row to inspect its voucher trail.</Text>
          </VStack>
          
          <div className="w-full overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-slate-500 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th scope="col" className="px-6 py-4">Ledger / Section</th>
                    <th scope="col" className="px-6 py-4">Deduction Month</th>
                    <th scope="col" className="px-6 py-4 text-right">Liability</th>
                    <th scope="col" className="px-6 py-4 text-right">Reversed</th>
                    <th scope="col" className="px-6 py-4 text-right">Deposited</th>
                    <th scope="col" className="px-6 py-4 text-right pr-8">Outstanding</th>
                    <th scope="col" className="px-6 py-4 pl-8">Due Date</th>
                    <th scope="col" className="px-6 py-4">Clearance Status</th>
                    <th scope="col" className="px-6 py-4 text-center">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {visibleRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold">{row.ledgerName}</span>
                          <span className="text-xs text-slate-500">{row.tdsType}{row.sectionCode ? ` · ${row.sectionCode}` : ''}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {row.deductionMonth ? date(row.deductionMonth) : 'Brought forward'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-700 dark:text-slate-300">
                        {amount(row.totalDue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-700 dark:text-slate-300">
                        {amount(row.reversed)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-700 dark:text-slate-300">
                        {amount(row.deposited)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-700 dark:text-slate-300 pr-8">
                        {amount(row.remaining || row.excess)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700 dark:text-slate-300 pl-8">
                        {date(row.dueDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(row.status)}`} />
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => setSelectedId(row.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-sm cursor-pointer"
                        >
                          <Eye size={12} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </VStack>

        {/* Audit Trail Dialog */}
        <Dialog isOpen={!!selected} onOpenChange={(isOpen) => { if (!isOpen) setSelectedId(null) }} width="min(60rem, 95vw)" maxHeight="100dvh" position={{ right: 0, top: 0, bottom: 0 }} purpose="info" padding={0} style={{ height: '100dvh', margin: 0, borderRadius: 'var(--radius-none)', overflow: 'hidden' }}>
          {selected ? <Layout
            height="fill"
            header={<div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Audit Trail</h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">{selected.ledgerName} / {selected.deductionMonth ? date(selected.deductionMonth) : 'Brought forward'}</span>
              </div>
              <button onClick={() => setSelectedId(null)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>}
            content={<LayoutContent padding={4}>
              <VStack gap={4}>
                <HStack gap={2} align="center">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(selected.status)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(selected.status)}`} />
                    {statusLabel(selected.status)}
                  </span>
                  <Text type="supporting">Due {date(selected.dueDate)} · Deposits {selected.depositDates.map(date).join(', ') || '—'}</Text>
                </HStack>
                <Text type="supporting">Payment allocations and liability reversals are listed by their own source classification. Reversals never contribute to Deposited.</Text>

                <div className="w-full overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm text-slate-500 dark:text-slate-400">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th scope="col" className="px-6 py-4">Date</th>
                          <th scope="col" className="px-6 py-4">Voucher Details</th>
                          <th scope="col" className="px-6 py-4">Classification</th>
                          <th scope="col" className="px-6 py-4 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {[...selected.liabilityTransactions, ...selected.depositTransactions].map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                              {date(item.date)}
                            </td>
                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{item.voucherType} {item.voucherNumber ?? ''}</span>
                                <span>{item.party ?? '—'}</span>
                                {item.note && <span className="text-xs text-slate-500">{item.note}</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                              {statusLabel(item.classification as TdsStatus)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-700 dark:text-slate-300">
                              {amount(item.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </VStack>
            </LayoutContent>}
          /> : <VStack gap={0} />}
        </Dialog>
        
        {/* Book Reconciliation Card */}
        <div style={{ paddingLeft: '12px', paddingRight: '12px' }}>
          <Card padding={5} style={{ background: 'var(--paper)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-soft)' }}>
            <VStack gap={4}>
              <VStack gap={1}>
                <Heading level={2}>Book Reconciliation</Heading>
                <Text type="supporting">Ledger closings are compared with the reconstructed liability position. Differences outside tolerance require review.</Text>
              </VStack>
              
              <div className="w-full overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-slate-500 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th scope="col" className="px-6 py-4">Ledger</th>
                        <th scope="col" className="px-6 py-4 text-right">Computed Outstanding</th>
                        <th scope="col" className="px-6 py-4 text-right">Ledger Closing</th>
                        <th scope="col" className="px-6 py-4 text-right">Reconstructed Net</th>
                        <th scope="col" className="px-6 py-4 text-right">Difference</th>
                        <th scope="col" className="px-6 py-4 text-center">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {data.reconciliation.map((row) => (
                        <tr key={row.ledgerId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                            {row.ledgerName}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-slate-700 dark:text-slate-300">
                            {amount(data.ledgerPositions.find((ledger) => ledger.ledgerId === row.ledgerId)?.outstanding ?? 0)}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-slate-700 dark:text-slate-300">
                            {amount(Number(row.expected))}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-slate-700 dark:text-slate-300">
                            {amount(Number(row.reconstructed))}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-slate-700 dark:text-slate-300">
                            {amount(Number(row.difference))}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              row.withinTolerance 
                                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                                : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            }`}>
                              {row.withinTolerance ? 'Reconciled' : 'Review'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </VStack>
          </Card>
        </div>
      </>}
    </VStack>
  </AppShell>
}
