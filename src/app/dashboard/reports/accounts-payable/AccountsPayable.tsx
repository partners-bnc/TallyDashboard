'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { AppShell, Dialog, Layout, LayoutContent, Link, VStack } from '@astryxdesign/core'
import { AlertCircle, BarChart2, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Info, Settings2, TrendingDown, TrendingUp, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Header from '@/components/ui/Header'
import type { AccountsPayableLedgerPosition, AccountsPayableReportData, AccountsPayableVoucherEntry } from '@/lib/data'
import { dashboardUrl } from '@/lib/dashboard-navigation'

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const amount = (value: number) => value === 0 ? '—' : money.format(value)
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'short' }).format(new Date(`${value}T00:00:00Z`)) : '—'

// AP accent colour — matching theme (similar to TDS report)
const ACCENT = 'var(--accent)'
const ACCENT_SOFT = 'var(--accent-soft)'
const ACCENT_BORDER = 'var(--accent-border)'
const ACCENT_DARK = 'var(--accent-dark)'

export function AccountsPayable({
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
  data: AccountsPayableReportData | null
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
  const [selectedLedgerInfo, setSelectedLedgerInfo] = useState<AccountsPayableLedgerPosition | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<AccountsPayableVoucherEntry | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const applyDates = () => {
    startTransition(() => {
      router.replace(dashboardUrl('/dashboard/reports/accounts-payable', { orgId, companyId, from: draftFrom, to: draftTo }))
    })
  }

  const groupedLedgers = useMemo(() => {
    const groups: Record<string, AccountsPayableLedgerPosition[]> = {}
    for (const ledger of data?.ledgers ?? []) {
      if (!ledger.ledgerName.toLowerCase().includes(searchQuery.toLowerCase())) continue
      const parent = ledger.parentName || 'Unassigned'
      groups[parent] = [...(groups[parent] ?? []), ledger]
    }
    return groups
  }, [data, searchQuery])

  const balanceChartData = useMemo(() => (data?.ledgers ?? [])
    .filter((ledger) => ledger.debitBalance > 0 || ledger.creditBalance > 0)
    .sort((a, b) => (b.debitBalance + b.creditBalance) - (a.debitBalance + a.creditBalance))
    .slice(0, 8)
    .map((ledger) => ({ name: ledger.ledgerName, debit: ledger.debitBalance, credit: ledger.creditBalance })), [data])

  const groupSummary = useMemo(() => {
    const groups = new Map<string, { debit: number; credit: number }>()
    for (const ledger of data?.ledgers ?? []) {
      const current = groups.get(ledger.parentName) ?? { debit: 0, credit: 0 }
      current.debit += ledger.debitBalance
      current.credit += ledger.creditBalance
      groups.set(ledger.parentName, current)
    }
    return [...groups.entries()].map(([name, balances]) => ({ name, ...balances }))
  }, [data])

  // Filter vouchers based on selection
  const activeEntries = useMemo<AccountsPayableVoucherEntry[]>(() => {
    if (!data) return []
    if (!selectedLedgerId) {
      const all: AccountsPayableVoucherEntry[] = []
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
  const displayDebit = selectedLedgerObj ? selectedLedgerObj.debitBalance : (data?.totalDebitBalance ?? 0)
  const displayCredit = selectedLedgerObj ? selectedLedgerObj.creditBalance : (data?.totalCreditBalance ?? 0)
  const displayNet = selectedLedgerObj ? Math.abs(selectedLedgerObj.creditBalance - selectedLedgerObj.debitBalance) : (data?.netBalance ?? 0)
  const displayNature = selectedLedgerObj 
    ? (selectedLedgerObj.debitBalance >= selectedLedgerObj.creditBalance ? 'Dr' : 'Cr') 
    : (data?.netNature ?? 'Dr')

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
              Payables Overview
            </span>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
              Accounts Payable
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
              {companyName} · Tally closing balances for mapped accounts payable ledgers
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <NextLink href={`/dashboard/compliance-mapping?type=ACCOUNTS_PAYABLE&org=${orgId}&company=${companyId}&returnTo=${encodeURIComponent(`/dashboard/reports/accounts-payable?org=${orgId}&company=${companyId}`)}`} passHref legacyBehavior>
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
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>No accounts payable mapping found</h2>
          <p style={{ fontSize: 14, color: '#64748b', maxWidth: 460, margin: '0 auto 24px', lineHeight: 1.5 }}>
            Select the accounts payable ledger groups and accounts that should appear in this report.
          </p>
          <NextLink href={`/dashboard/compliance-mapping?type=ACCOUNTS_PAYABLE&org=${orgId}&company=${companyId}&returnTo=${encodeURIComponent(`/dashboard/reports/accounts-payable?org=${orgId}&company=${companyId}`)}`} passHref legacyBehavior>
            <Link className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer">
              Go to Accounts Payable Mapping
            </Link>
          </NextLink>
        </div>
      ) : (
        <VStack gap={6}>
          {/* ── KPI Cards ─────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Debit Balance</span>
                <TrendingUp size={16} style={{ color: '#16a34a' }} />
              </div>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.02em' }}>{money.format(displayDebit)}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                {selectedLedgerId ? 'Ledger closing debits' : 'Mapped closing debits (Advances/Adjustments)'}
              </span>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Credit Balance</span>
                <TrendingDown size={16} style={{ color: '#ef4444' }} />
              </div>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: '#ef4444', letterSpacing: '-0.02em' }}>{money.format(displayCredit)}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                {selectedLedgerId ? 'Ledger closing credits' : 'Mapped closing credits (Outstanding Payables)'}
              </span>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net Balance</span>
                <CheckCircle2 size={16} style={{ color: displayNature === 'Dr' ? '#16a34a' : '#ef4444' }} />
              </div>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: displayNature === 'Dr' ? '#16a34a' : '#ef4444', letterSpacing: '-0.02em' }}>
                {money.format(displayNet)}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: displayNature === 'Dr' ? '#15803d' : '#7f1d1d', background: displayNature === 'Dr' ? '#dcfce7' : '#fee2e2', padding: '1px 6px', borderRadius: 4, marginTop: 4 }}>
                {displayNature} closing balance
              </span>
            </div>
          </div>

          {/* ── Two-Column Summary Chart and Groups Section ───── */}
          <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', gap: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <BarChart2 size={18} style={{ color: '#0f172a' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Accounts Payable Closing Balances</h3>
              </div>
              {balanceChartData.length === 0 ? (
                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>No non-zero closing balances to display.</div>
              ) : (
                <div style={{ height: 280, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={balanceChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} hide />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => money.format(value).replace('₹', '')} style={{ fontSize: '11px', fill: '#64748b' }} />
                      <Tooltip formatter={(value) => money.format(Number(value))} />
                      <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                      <Bar name="Debit Balance" dataKey="debit" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar name="Credit Balance" dataKey="credit" fill="#6366f1" radius={[4, 4, 0, 0]} />
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
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Debit</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupSummary.map((group) => (
                      <tr key={group.name} style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>
                        <td style={{ padding: 10, fontWeight: 600 }}>{group.name}</td>
                        <td style={{ padding: 10, textAlign: 'right', color: '#16a34a' }}>{amount(group.debit)}</td>
                        <td style={{ padding: 10, textAlign: 'right', color: '#ef4444' }}>{amount(group.credit)}</td>
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
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Accounts Payable Ledgers &amp; Accounts Breakdown</h3>
                <span style={{ fontSize: 11, color: '#cbd5e1' }}>· Click a ledger row to filter vouchers below</span>
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
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Debit Balance</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Credit Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(groupedLedgers).length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '40px 10px', textAlign: 'center', color: '#64748b' }}>No ledgers match your search.</td>
                    </tr>
                  ) : Object.entries(groupedLedgers).map(([groupName, ledgers]) => {
                    const isCollapsed = !!collapsedGroups[groupName]
                    const groupDebit = ledgers.reduce((sum, ledger) => sum + ledger.debitBalance, 0)
                    const groupCredit = ledgers.reduce((sum, ledger) => sum + ledger.creditBalance, 0)
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
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{amount(groupDebit)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{amount(groupCredit)}</td>
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
                              <td style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{amount(ledger.debitBalance)}</td>
                              <td style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{amount(ledger.creditBalance)}</td>
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
                      {selectedLedgerId ? 'Show All Ledgers ↑' : 'Grand Total'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{money.format(data.totalDebitBalance)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>{money.format(data.totalCreditBalance)}</td>
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
                  Voucher Transaction Logs {selectedLedgerId ? `(${selectedLedgerObj?.ledgerName})` : '(All Mapped Ledgers)'}
                </h3>
              </div>
              <span style={{ fontSize: 12, color: '#64748b' }}>{activeEntries.length} entries</span>
            </div>

            <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1.5fr 1fr 120px 120px 120px', padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
                {['Date', 'Particulars', 'Supplier / Ledger', 'Debit', 'Credit', 'Net Amount'].map((h, i) => (
                  <span key={i} style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i >= 3 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>

              {activeEntries.length > 0 ? (
                <>
                  {activeEntries.map((entry, idx) => {
                    const ledgerName = data?.ledgers.find(l => l.ledgerId === entry.ledgerId)?.ledgerName ?? '—'
                    const net = entry.credit - entry.debit
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
                        <span style={{ fontSize: 12, fontWeight: 700, color: net >= 0 ? '#16a34a' : ACCENT, textAlign: 'right' }}>
                          {amount(net)}
                        </span>
                      </div>
                    )
                  })}
                  {/* Totals row */}
                  {(() => {
                    const td = activeEntries.reduce((s, e) => s + e.debit, 0)
                    const tc = activeEntries.reduce((s, e) => s + e.credit, 0)
                    const tn = tc - td
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '100px 1.5fr 1fr 120px 120px 120px', padding: '14px 20px', alignItems: 'center', background: ACCENT_SOFT, borderTop: `2px solid ${ACCENT_BORDER}` }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT_DARK, gridColumn: '1 / 4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total ({activeEntries.length} entries)</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: td > 0 ? ACCENT : '#94a3b8', textAlign: 'right' }}>{td > 0 ? amount(td) : '—'}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: tc > 0 ? '#16a34a' : '#94a3b8', textAlign: 'right' }}>{tc > 0 ? amount(tc) : '—'}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: tn >= 0 ? '#16a34a' : ACCENT, textAlign: 'right' }}>{tn >= 0 ? '+' : ''}{amount(tn)}</span>
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
                <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Debit Balance</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{amount(selectedLedgerInfo.debitBalance)}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Credit Balance</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#ef4444' }}>{amount(selectedLedgerInfo.creditBalance)}</span>
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
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Debit</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: selectedEntry.debit > 0 ? ACCENT : '#cbd5e1' }}>
                        {selectedEntry.debit > 0 ? amount(selectedEntry.debit) : '—'}
                      </span>
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Credit</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: selectedEntry.credit > 0 ? '#16a34a' : '#cbd5e1' }}>
                        {selectedEntry.credit > 0 ? amount(selectedEntry.credit) : '—'}
                      </span>
                    </div>
                    <div style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: ACCENT_DARK, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Net Impact</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: (selectedEntry.credit - selectedEntry.debit) >= 0 ? '#16a34a' : ACCENT }}>
                        {(selectedEntry.credit - selectedEntry.debit) >= 0 ? '+' : ''}{amount(selectedEntry.credit - selectedEntry.debit)}
                      </span>
                    </div>
                  </div>

                  {/* Detail table */}
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                    {([
                      ['Supplier / Account', selectedEntryLedgerName],
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
