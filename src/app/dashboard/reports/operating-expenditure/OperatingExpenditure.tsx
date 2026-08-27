'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { AppShell, Dialog, Layout, LayoutContent, Link, VStack } from '@astryxdesign/core'
import { ArrowLeft, CalendarDays, CreditCard, TrendingDown, TrendingUp, Clock, Info, Settings2, X, FileWarning } from 'lucide-react'
import Header from '@/components/ui/Header'
import type { OperatingExpenditureReportData, OperatingExpenditureVoucherEntry } from '@/lib/data'
import { dashboardUrl } from '@/lib/dashboard-navigation'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
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
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<OperatingExpenditureVoucherEntry | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const applyDates = () => {
    startTransition(() => {
      router.replace(dashboardUrl('/dashboard/reports/operating-expenditure', { orgId, companyId, from: draftFrom, to: draftTo }))
    })
  }

  const filteredLedgers = useMemo(() => {
    if (!data) return []
    return data.ledgers.filter(l => l.ledgerName.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [data, searchQuery])

  const activeEntries = useMemo<OperatingExpenditureVoucherEntry[]>(() => {
    if (!data) return []
    if (!selectedLedgerId) {
      const all: OperatingExpenditureVoucherEntry[] = []
      for (const ledger of filteredLedgers) all.push(...(data.entriesByLedger[ledger.ledgerId] ?? []))
      return all.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    }
    return data.entriesByLedger[selectedLedgerId] ?? []
  }, [data, selectedLedgerId, filteredLedgers])

  const kpiTotal = useMemo(() => !data ? 0 : !selectedLedgerId ? data.totalOpex : (data.ledgers.find(l => l.ledgerId === selectedLedgerId)?.closingBalance ?? 0), [data, selectedLedgerId])
  const kpiOpening = useMemo(() => !data ? 0 : !selectedLedgerId ? data.openingOpex : (data.ledgers.find(l => l.ledgerId === selectedLedgerId)?.openingBalance ?? 0), [data, selectedLedgerId])
  const kpiMovement = useMemo(() => !data ? 0 : !selectedLedgerId ? data.netMovement : (data.ledgers.find(l => l.ledgerId === selectedLedgerId)?.netMovement ?? 0), [data, selectedLedgerId])
  const kpiCount = activeEntries.length

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
              {companyName} · Admin, Sales & General Expenses Audit
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <NextLink href={`/dashboard/compliance-mapping?type=OPEX&org=${orgId}&company=${companyId}&returnTo=${encodeURIComponent(`/dashboard/reports/operating-expenditure?org=${orgId}&company=${companyId}`)}`} passHref legacyBehavior>
              <Link className="px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer">
                <Settings2 size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Manage Mapping
              </Link>
            </NextLink>

            {/* Small Date Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={draftFrom} onChange={e => setDraftFrom(e.target.value)}
                style={{ width: 120, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', fontSize: 11, color: '#0f172a', outline: 'none' }} />
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>to</span>
              <input type="date" value={draftTo} onChange={e => setDraftTo(e.target.value)}
                style={{ width: 120, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', fontSize: 11, color: '#0f172a', outline: 'none' }} />
              <button onClick={applyDates} disabled={isPending}
                style={{ padding: '5px 12px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: isPending ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                {isPending ? '…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Expenses</span>
            <CreditCard size={16} style={{ color: ACCENT }} />
          </div>
          <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: ACCENT, letterSpacing: '-0.02em' }}>{amount(kpiTotal)}</span>
          <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{selectedLedgerId ? 'Ledger closing balance' : 'All mapped closing balances'}</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Opening Balance</span>
            <Clock size={16} style={{ color: '#64748b' }} />
          </div>
          <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{amount(kpiOpening)}</span>
          <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Opening balance in period</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net Movement</span>
            {kpiMovement >= 0
              ? <TrendingUp size={16} style={{ color: ACCENT }} />
              : <TrendingDown size={16} style={{ color: '#16a34a' }} />}
          </div>
          <span style={{ display: 'block', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: kpiMovement >= 0 ? ACCENT : '#16a34a' }}>
            {kpiMovement >= 0 ? '+' : ''}{amount(kpiMovement)}
          </span>
          <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Increase / Decrease in period</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transactions</span>
            <FileWarning size={16} style={{ color: ACCENT }} />
          </div>
          <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{kpiCount}</span>
          <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Vouchers in selection</span>
        </div>
      </div>

      {/* ── Main Table ──────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>

        {/* Section label */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Ledger Accounts &amp; Balances
            </span>
            <span style={{ fontSize: 10, color: '#cbd5e1' }}>· Click a row to filter vouchers</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="text"
              placeholder="Search ledger name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', width: 180, background: '#f8fafc' }}
            />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {data && (
                filteredLedgers.length === data.ledgers.length
                  ? `${data.ledgers.length} ledgers`
                  : `${filteredLedgers.length} of ${data.ledgers.length} ledgers`
              )} · {activeEntries.length} entries
            </span>
          </div>
        </div>

        {/* Ledger summary rows — always all visible, click to filter */}
        {data && filteredLedgers.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '7px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ledger Name</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Closing Balance</span>
            </div>

            {filteredLedgers.map((l, i, arr) => {
              const isSelected = selectedLedgerId === l.ledgerId
              return (
                <div key={l.ledgerId}
                  onClick={() => { setSelectedLedgerId(isSelected ? null : l.ledgerId); setSelectedEntry(null) }}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr auto', padding: '11px 20px',
                    borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: isSelected ? ACCENT_SOFT : '#fff',
                    borderLeft: isSelected ? `3px solid ${ACCENT}` : '3px solid transparent',
                    cursor: 'pointer', transition: 'background 0.12s'
                  }}
                >
                  <span style={{ fontSize: 13, color: isSelected ? ACCENT_DARK : '#334155', fontWeight: isSelected ? 700 : 500 }}>{l.ledgerName}</span>
                  <span style={{ fontSize: 13, color: isSelected ? ACCENT_DARK : '#0f172a', fontWeight: 700, textAlign: 'right' }}>{amount(l.closingBalance)}</span>
                </div>
              )
            })}

            {/* Total row — click to reset */}
            <div onClick={() => { setSelectedLedgerId(null); setSelectedEntry(null) }}
              style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '11px 20px', background: selectedLedgerId === null ? '#fee2e2' : ACCENT_SOFT, borderTop: `2px solid ${ACCENT_BORDER}`, cursor: 'pointer', transition: 'background 0.12s' }}>
              <span style={{ fontSize: 13, color: '#7f1d1d', fontWeight: 800 }}>
                {selectedLedgerId ? 'Show All Expenses ↑' : 'Total Operating Expenditure'}
              </span>
              <span style={{ fontSize: 13, color: ACCENT_DARK, fontWeight: 800, textAlign: 'right' }}>{amount(kpiTotal)}</span>
            </div>
          </>
        )}

        {/* Voucher transactions header */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Voucher Transaction Logs (Period Movement)
          </span>
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 120px 40px 130px 130px 130px', padding: '8px 20px', background: ACCENT_SOFT, borderBottom: `1px solid ${ACCENT_BORDER}`, alignItems: 'center' }}>
          {['Date', 'Particulars', 'Expense Ledger', '', 'Debit (+)', 'Credit (-)', 'Net Amount'].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: ACCENT_DARK, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i >= 4 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>

        {/* Voucher rows */}
        {activeEntries.length > 0 ? (
          <>
            {activeEntries.map((entry, i) => {
              const ledgerName = data?.ledgers.find(l => l.ledgerId === entry.ledgerId)?.ledgerName ?? '—'
              const net = entry.debit - entry.credit
              return (
                <div key={entry.id} onClick={() => setSelectedEntry(entry)}
                  style={{
                    display: 'grid', gridTemplateColumns: '80px 1fr 120px 40px 130px 130px 130px',
                    padding: '11px 20px', cursor: 'pointer', alignItems: 'center',
                    borderBottom: i < activeEntries.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: selectedEntry?.id === entry.id ? ACCENT_SOFT : '#fff',
                    transition: 'background 0.1s'
                  }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{date(entry.date)}</span>
                  <div style={{ minWidth: 0, paddingRight: 12 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.particulars}</span>
                    {entry.number && <span style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginTop: 1 }}>{entry.type} #{entry.number}</span>}
                  </div>
                  <div>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: ACCENT_SOFT, color: ACCENT_DARK, border: `1px solid ${ACCENT_BORDER}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 115 }}>
                      {ledgerName}
                    </span>
                  </div>
                  <span />
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
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 120px 40px 130px 130px 130px', padding: '12px 20px', alignItems: 'center', background: ACCENT_SOFT, borderTop: `2px solid ${ACCENT_BORDER}` }}>
                  <span style={{ fontSize: 11, gridColumn: '1 / 5', fontWeight: 800, color: ACCENT_DARK, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total ({activeEntries.length} entries)</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: td > 0 ? ACCENT : '#94a3b8', textAlign: 'right' }}>{td > 0 ? amount(td) : '—'}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: tc > 0 ? '#16a34a' : '#94a3b8', textAlign: 'right' }}>{tc > 0 ? amount(tc) : '—'}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: tn >= 0 ? ACCENT : '#16a34a', textAlign: 'right' }}>{tn >= 0 ? '+' : ''}{amount(tn)}</span>
                </div>
              )
            })()}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 8 }}>
            <Info size={24} style={{ color: '#cbd5e1' }} />
            <span style={{ fontSize: 13, color: '#94a3b8' }}>No transaction entries found in this period.</span>
          </div>
        )}
      </div>

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
                    {data?.ledgers.find(l => l.ledgerId === selectedEntry.ledgerId)?.ledgerName ?? '—'} · {date(selectedEntry.date)}
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
