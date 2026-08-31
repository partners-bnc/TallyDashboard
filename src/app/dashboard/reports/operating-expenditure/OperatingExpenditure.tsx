'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { AppShell, Dialog, Layout, LayoutContent, Link, VStack } from '@astryxdesign/core'
import { AlertCircle, BarChart2, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Clock, CreditCard, FileWarning, Info, Settings2, TrendingDown, TrendingUp, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Header from '@/components/ui/Header'
import type { OperatingExpenditureLedgerPosition, OperatingExpenditureReportData, OperatingExpenditureVoucherEntry } from '@/lib/data'
import { dashboardUrl } from '@/lib/dashboard-navigation'

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const amount = (value: number) => value === 0 ? '—' : money.format(value)
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'short' }).format(new Date(`${value}T00:00:00Z`)) : '—'

// Accent colour variables (indigo standard)
const ACCENT = 'var(--accent)'
const ACCENT_SOFT = 'var(--accent-soft)'
const ACCENT_BORDER = 'var(--accent-border)'
const ACCENT_DARK = 'var(--accent-dark)'

export function OperatingExpenditure({
  orgId,
  companyId,
  companyName,
  data,
  from,
  to,
}: {
  orgId: string
  companyId: string
  companyName: string
  data: OperatingExpenditureReportData | null
  from: string
  to: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Selection states
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null)
  const [selectedLedgerInfo, setSelectedLedgerInfo] = useState<OperatingExpenditureLedgerPosition | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<OperatingExpenditureVoucherEntry | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const applyDates = () => {
    startTransition(() => {
      router.replace(dashboardUrl('/dashboard/reports/operating-expenditure', { orgId, companyId, from: draftFrom, to: draftTo }))
    })
  }

  const groupedLedgers = useMemo(() => {
    const groups: Record<string, OperatingExpenditureLedgerPosition[]> = {}
    for (const ledger of data?.ledgers ?? []) {
      if (!ledger.ledgerName.toLowerCase().includes(searchQuery.toLowerCase())) continue
      const parent = ledger.parentName || 'Unassigned'
      groups[parent] = [...(groups[parent] ?? []), ledger]
    }
    return groups
  }, [data, searchQuery])

  const balanceChartData = useMemo(() => (data?.ledgers ?? [])
    .filter((ledger) => ledger.closingBalance > 0)
    .sort((a, b) => b.closingBalance - a.closingBalance)
    .slice(0, 8)
    .map((ledger) => ({ name: ledger.ledgerName, amount: ledger.closingBalance })), [data])

  const groupSummary = useMemo(() => {
    const groups = new Map<string, { opening: number; closing: number; movement: number }>()
    for (const ledger of data?.ledgers ?? []) {
      const current = groups.get(ledger.parentName) ?? { opening: 0, closing: 0, movement: 0 }
      current.opening += ledger.openingBalance
      current.closing += ledger.closingBalance
      current.movement += ledger.netMovement
      groups.set(ledger.parentName, current)
    }
    return [...groups.entries()].map(([name, balances]) => ({ name, ...balances }))
  }, [data])

  // Filter vouchers based on selection
  const activeEntries = useMemo<OperatingExpenditureVoucherEntry[]>(() => {
    if (!data) return []
    if (!selectedLedgerId) {
      const all: OperatingExpenditureVoucherEntry[] = []
      // Collect entries for mapped ledgers
      const mappedIds = new Set((data.ledgers ?? []).map(l => l.ledgerId))
      for (const ledgerId of Object.keys(data.entriesByLedger ?? {})) {
        if (mappedIds.has(ledgerId)) {
          all.push(...(data.entriesByLedger[ledgerId] ?? []))
        }
      }
      return all.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    }
    return data.entriesByLedger[selectedLedgerId] ?? []
  }, [data, selectedLedgerId])

  // Selected ledger object for KPI values
  const selectedLedgerObj = useMemo(() => {
    if (!selectedLedgerId || !data) return null
    return data.ledgers.find(l => l.ledgerId === selectedLedgerId) || null
  }, [data, selectedLedgerId])

  // Dynamic KPI Card Calculations
  const displayTotal = selectedLedgerObj ? selectedLedgerObj.closingBalance : (data?.totalOpex ?? 0)
  const displayOpening = selectedLedgerObj ? selectedLedgerObj.openingBalance : (data?.openingOpex ?? 0)
  const displayMovement = selectedLedgerObj ? selectedLedgerObj.netMovement : (data?.netMovement ?? 0)
  const displayCount = activeEntries.length

  const selectedEntryLedgerName = useMemo(
    () => data?.ledgers.find(l => l.ledgerId === selectedEntry?.ledgerId)?.ledgerName ?? '—',
    [data, selectedEntry]
  )

  return (
    <AppShell topNav={<Header />} mobileNav={false} height="auto" contentPadding={4}>
      {/* ── Page Header ─────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '24px 28px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: ACCENT_DARK, background: ACCENT_SOFT, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 999, padding: '2px 10px', marginBottom: 8 }}>
              Operating Expenditure
            </span>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
              Operating Expenditure
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
              {companyName} · Admin, Sales &amp; General Expenses Audit
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <NextLink href={`/dashboard/compliance-mapping?type=OPEX&org=${orgId}&company=${companyId}&returnTo=${encodeURIComponent(`/dashboard/reports/operating-expenditure?org=${orgId}&company=${companyId}`)}`} passHref legacyBehavior>
              <Link className="px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer">
                <Settings2 size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Manage Mapping
              </Link>
            </NextLink>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" aria-label="Period start date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)}
                style={{ width: 120, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', fontSize: 11, color: '#0f172a', outline: 'none' }} />
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>to</span>
              <input type="date" aria-label="Balance ending date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)}
                style={{ width: 120, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', fontSize: 11, color: '#0f172a', outline: 'none' }} />
              <button onClick={applyDates} disabled={isPending}
                style={{ padding: '5px 12px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: isPending ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                {isPending ? '…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {!data || data.ledgers.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '60px 40px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <AlertCircle size={48} style={{ color: '#94a3b8', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>No operating expenditure mapping found</h2>
          <p style={{ fontSize: 14, color: '#64748b', maxWidth: 460, margin: '0 auto 24px', lineHeight: 1.5 }}>
            Select the operating expenditure ledger groups and accounts that should appear in this report.
          </p>
          <NextLink href={`/dashboard/compliance-mapping?type=OPEX&org=${orgId}&company=${companyId}&returnTo=${encodeURIComponent(`/dashboard/reports/operating-expenditure?org=${orgId}&company=${companyId}`)}`} passHref legacyBehavior>
            <Link className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer">
              Go to OPEX Mapping
            </Link>
          </NextLink>
        </div>
      ) : (
        <VStack gap={6}>
          {/* ── KPI Cards ─────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Expenses</span>
                <CreditCard size={16} style={{ color: ACCENT }} />
              </div>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: ACCENT, letterSpacing: '-0.02em' }}>{money.format(displayTotal)}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                {selectedLedgerId ? 'Ledger closing balance' : 'All mapped closing balances'}
              </span>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Opening Balance</span>
                <Clock size={16} style={{ color: '#64748b' }} />
              </div>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{money.format(displayOpening)}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                Opening balance in period
              </span>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net Movement</span>
                {displayMovement >= 0
                  ? <TrendingUp size={16} style={{ color: ACCENT }} />
                  : <TrendingDown size={16} style={{ color: '#16a34a' }} />}
              </div>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: displayMovement >= 0 ? ACCENT : '#16a34a' }}>
                {displayMovement >= 0 ? '+' : ''}{money.format(displayMovement)}
              </span>
              <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                Increase / Decrease in period
              </span>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transactions</span>
                <FileWarning size={16} style={{ color: ACCENT }} />
              </div>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{displayCount}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                Vouchers in selection
              </span>
            </div>
          </div>

          {/* ── Two-Column Summary Chart and Groups Section ───── */}
          <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', gap: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <BarChart2 size={18} style={{ color: '#0f172a' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Operating Expenditure Balances</h3>
              </div>
              {balanceChartData.length === 0 ? (
                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>No opex balances to display.</div>
              ) : (
                <div style={{ height: 280, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={balanceChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} hide />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => money.format(value).replace('₹', '')} style={{ fontSize: '11px', fill: '#64748b' }} />
                      <Tooltip formatter={(value) => money.format(Number(value))} />
                      <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                      <Bar name="Closing Balance" dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <ClipboardList size={18} style={{ color: '#0f172a' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Group Balance Summary</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>
                      <th style={{ padding: '8px 10px' }}>Group</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Opening</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Closing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupSummary.map((group) => (
                      <tr key={group.name} style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>
                        <td style={{ padding: 10, fontWeight: 600 }}>{group.name}</td>
                        <td style={{ padding: 10, textAlign: 'right', color: '#64748b' }}>{amount(group.opening)}</td>
                        <td style={{ padding: 10, textAlign: 'right', color: '#4f46e5', fontWeight: 700 }}>{amount(group.closing)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Main Breakdown Table (GST-style, clickable rows) ── */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardList size={18} style={{ color: '#0f172a' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Operating Expenditure Ledgers breakdown</h3>
                <span style={{ fontSize: 11, color: '#cbd5e1' }}>· Click a row to filter vouchers</span>
              </div>
              <input
                type="text"
                placeholder="Search ledgers..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                style={{ width: 220, padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, outline: 'none' }}
              />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>
                    <th style={{ padding: '10px 12px' }}>Ledger Account Name</th>
                    <th style={{ padding: '10px 12px' }}>Group</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Opening Balance</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Closing Balance</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Net Movement</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(groupedLedgers).length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px 10px', textAlign: 'center', color: '#64748b' }}>No ledgers match your search.</td>
                    </tr>
                  ) : Object.entries(groupedLedgers).map(([groupName, ledgers]) => {
                    const isCollapsed = !!collapsedGroups[groupName]
                    const groupOpening = ledgers.reduce((sum, ledger) => sum + ledger.openingBalance, 0)
                    const groupClosing = ledgers.reduce((sum, ledger) => sum + ledger.closingBalance, 0)
                    const groupMovement = groupClosing - groupOpening
                    return (
                      <React.Fragment key={groupName}>
                        <tr
                          onClick={() => setCollapsedGroups((previous) => ({ ...previous, [groupName]: !previous[groupName] }))}
                          style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' }}
                          className="hover:bg-slate-100/80 transition-all"
                        >
                          <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                              {groupName}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#64748b' }}>{amount(groupOpening)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#4f46e5' }}>{amount(groupClosing)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: groupMovement >= 0 ? ACCENT : '#16a34a' }}>
                            {groupMovement >= 0 ? '+' : ''}{amount(groupMovement)}
                          </td>
                        </tr>
                        {!isCollapsed && ledgers.map((ledger) => {
                          const isSelected = selectedLedgerId === ledger.ledgerId
                          return (
                            <tr 
                              key={ledger.ledgerId} 
                              onClick={() => { setSelectedLedgerId(isSelected ? null : ledger.ledgerId); setSelectedEntry(null) }}
                              style={{ 
                                borderBottom: '1px solid #f1f5f9',
                                cursor: 'pointer',
                                background: isSelected ? ACCENT_SOFT : '#fff',
                                borderLeft: isSelected ? `3px solid ${ACCENT}` : '3px solid transparent'
                              }} 
                              className="hover:bg-slate-50"
                            >
                              <td style={{ padding: '12px 12px 12px 24px', fontWeight: 600, color: isSelected ? ACCENT_DARK : '#0f172a' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span>{ledger.ledgerName}</span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setSelectedLedgerInfo(ledger) }} 
                                    title="View ledger details" 
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'inline-flex', alignItems: 'center' }}
                                  >
                                    <Info size={14} className="text-slate-400 hover:text-indigo-600 transition-colors" />
                                  </button>
                                </div>
                              </td>
                              <td style={{ padding: 12, color: '#475569' }}>{ledger.parentName}</td>
                              <td style={{ padding: 12, textAlign: 'right', fontWeight: 600, color: '#64748b' }}>{amount(ledger.openingBalance)}</td>
                              <td style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: '#4f46e5' }}>{amount(ledger.closingBalance)}</td>
                              <td style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: ledger.netMovement >= 0 ? ACCENT : '#16a34a' }}>
                                {ledger.netMovement >= 0 ? '+' : ''}{amount(ledger.netMovement)}
                              </td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr 
                    onClick={() => { setSelectedLedgerId(null); setSelectedEntry(null) }}
                    style={{ background: selectedLedgerId === null ? '#f8fafc' : ACCENT_SOFT, borderTop: '2px solid #cbd5e1', cursor: 'pointer' }}
                  >
                    <td colSpan={2} style={{ padding: '12px', fontWeight: 800, color: selectedLedgerId === null ? '#0f172a' : ACCENT_DARK }}>
                      {selectedLedgerId ? 'Show All Expenses ↑' : 'Total Operating Expenditure'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#64748b' }}>{money.format(data.openingOpex)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#4f46e5' }}>{money.format(data.totalOpex)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: data.netMovement >= 0 ? ACCENT : '#16a34a' }}>
                      {data.netMovement >= 0 ? '+' : ''}{money.format(data.netMovement)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── Voucher Transaction Logs Table (Period Movement) ── */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardList size={18} style={{ color: '#0f172a' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Voucher Transaction Logs {selectedLedgerId ? `(${selectedLedgerObj?.ledgerName})` : '(All Mapped Expenses)'}
                </h3>
              </div>
              <span style={{ fontSize: 12, color: '#64748b' }}>{activeEntries.length} entries</span>
            </div>

            <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1.5fr 1fr 120px 120px 120px', padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
                {['Date', 'Particulars', 'Expense Ledger', 'Debit (+)', 'Credit (-)', 'Net Amount'].map((h, i) => (
                  <span key={i} style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i >= 3 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>

              {activeEntries.length > 0 ? (
                <>
                  {activeEntries.map((entry, idx) => {
                    const ledgerName = data?.ledgers.find(l => l.ledgerId === entry.ledgerId)?.ledgerName ?? '—'
                    const net = entry.debit - entry.credit
                    return (
                      <div 
                        key={entry.id} 
                        onClick={() => setSelectedEntry(entry)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '100px 1.5fr 1fr 120px 120px 120px',
                          padding: '12px 20px',
                          cursor: 'pointer',
                          alignItems: 'center',
                          borderBottom: idx < activeEntries.length - 1 ? '1px solid #f1f5f9' : 'none',
                          background: selectedEntry?.id === entry.id ? ACCENT_SOFT : '#fff',
                        }}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{date(entry.date)}</span>
                        <div style={{ minWidth: 0, paddingRight: 12 }}>
                          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.particulars}</span>
                          {entry.number && <span style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginTop: 1 }}>{entry.type} #{entry.number}</span>}
                        </div>
                        <div>
                          <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: ACCENT_SOFT, color: ACCENT_DARK, border: `1px solid ${ACCENT_BORDER}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                            {ledgerName}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: entry.debit > 0 ? ACCENT : '#94a3b8', textAlign: 'right' }}>
                          {entry.debit > 0 ? amount(entry.debit) : '—'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: entry.credit > 0 ? '#16a34a' : '#94a3b8', textAlign: 'right' }}>
                          {entry.credit > 0 ? amount(entry.credit) : '—'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: net >= 0 ? ACCENT : '#16a34a', textAlign: 'right' }}>
                          {amount(net)}
                        </span>
                      </div>
                    )
                  })}
                  {/* Totals row */}
                  {(() => {
                    const td = activeEntries.reduce((s, e) => s + e.debit, 0)
                    const tc = activeEntries.reduce((s, e) => s + e.credit, 0)
                    const tn = td - tc
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '100px 1.5fr 1fr 120px 120px 120px', padding: '14px 20px', alignItems: 'center', background: ACCENT_SOFT, borderTop: `2px solid ${ACCENT_BORDER}` }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT_DARK, gridColumn: '1 / 4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total ({activeEntries.length} entries)</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: td > 0 ? ACCENT : '#94a3b8', textAlign: 'right' }}>{td > 0 ? amount(td) : '—'}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: tc > 0 ? '#16a34a' : '#94a3b8', textAlign: 'right' }}>{tc > 0 ? amount(tc) : '—'}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: tn >= 0 ? ACCENT : '#16a34a', textAlign: 'right' }}>{tn >= 0 ? '+' : ''}{amount(tn)}</span>
                      </div>
                    )
                  })()}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 8, background: '#fff' }}>
                  <Info size={24} style={{ color: '#cbd5e1' }} />
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>No transaction entries found in this period.</span>
                </div>
              )}
            </div>
          </div>
        </VStack>
      )}

      {/* ── Ledger Info Dialog ────────────────────────────── */}
      <Dialog isOpen={selectedLedgerInfo !== null} onOpenChange={(open) => { if (!open) setSelectedLedgerInfo(null) }}>
        {selectedLedgerInfo && (
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>{selectedLedgerInfo.ledgerName}</h3>
              <button onClick={() => setSelectedLedgerInfo(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, display: 'flex', color: '#64748b' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Opening Balance</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#64748b' }}>{amount(selectedLedgerInfo.openingBalance)}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Closing Balance</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#4f46e5' }}>{amount(selectedLedgerInfo.closingBalance)}</span>
              </div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.5, color: '#334155', marginTop: 16 }}>
              <p style={{ margin: '0 0 6px' }}><strong>Group:</strong> {selectedLedgerInfo.parentName}</p>
              <p style={{ margin: '0 0 6px' }}><strong>Tally ID:</strong> {selectedLedgerInfo.ledgerId}</p>
              <p style={{ margin: 0 }}>Closing balance as at <strong>{to}</strong>.</p>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Voucher Detail Side Panel ────────────────────────── */}
      <Dialog
        isOpen={!!selectedEntry}
        onOpenChange={(isOpen) => { if (!isOpen) setSelectedEntry(null) }}
        width="min(44rem, 95vw)"
        maxHeight="100dvh"
        position={{ right: 0, top: 0, bottom: 0 }}
        purpose="info"
        padding={0}
        style={{ height: '100dvh', margin: 0, borderRadius: 'var(--radius-none)', overflow: 'hidden' }}
      >
        {selectedEntry ? (
          <Layout
            height="fill"
            header={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', background: '#f8fafc' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Voucher Detail</h3>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {selectedEntryLedgerName} · {date(selectedEntry.date)}
                  </span>
                </div>
                <button onClick={() => setSelectedEntry(null)}
                  style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, color: '#64748b' }}>
                  <X size={20} />
                </button>
              </div>
            }
            content={
              <LayoutContent padding={4}>
                <VStack gap={4}>
                  {/* Amount cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Debit (Increase)</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: selectedEntry.debit > 0 ? ACCENT : '#cbd5e1' }}>
                        {selectedEntry.debit > 0 ? amount(selectedEntry.debit) : '—'}
                      </span>
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Credit (Decrease)</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: selectedEntry.credit > 0 ? '#16a34a' : '#cbd5e1' }}>
                        {selectedEntry.credit > 0 ? amount(selectedEntry.credit) : '—'}
                      </span>
                    </div>
                    <div style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: ACCENT_DARK, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Net Impact</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: (selectedEntry.debit - selectedEntry.credit) >= 0 ? ACCENT : '#16a34a' }}>
                        {(selectedEntry.debit - selectedEntry.credit) >= 0 ? '+' : ''}{amount(selectedEntry.debit - selectedEntry.credit)}
                      </span>
                    </div>
                  </div>

                  {/* Detail table */}
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                    {([
                      ['Expense Account', selectedEntryLedgerName],
                      ['Date', date(selectedEntry.date)],
                      ['Voucher Type', selectedEntry.type],
                      ['Voucher Number', selectedEntry.number ? `#${selectedEntry.number}` : '—'],
                      ['Particulars', selectedEntry.particulars],
                      ['Voucher Entry ID', selectedEntry.id],
                      ['Voucher ID', selectedEntry.voucherId],
                    ] as [string, string][]).map(([label, value], idx, arr) => (
                      <div key={label} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: idx < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', background: '#f8fafc', borderRight: '1px solid #f1f5f9' }}>
                          {label}
                        </span>
                        <span style={{ fontSize: label.includes('ID') ? 11 : 13, color: '#1e293b', padding: '12px 16px', fontFamily: label.includes('ID') ? 'monospace' : 'inherit', wordBreak: 'break-all' } as React.CSSProperties}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </VStack>
              </LayoutContent>
            }
          />
        ) : <VStack gap={0} />}
      </Dialog>
    </AppShell>
  )
}
