'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { AppShell, Dialog, Layout, LayoutContent, Link, VStack } from '@astryxdesign/core'
import { ArrowLeft, CalendarDays, Eye, ShieldCheck, FileText, Clock, Info, Settings2, X } from 'lucide-react'
import Header from '@/components/ui/Header'
import type { PromotersReportData, PromoterVoucherEntry } from '@/lib/data'
import { dashboardUrl } from '@/lib/dashboard-navigation'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const amount = (value: number) => value === 0 ? '—' : money.format(value)
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'short' }).format(new Date(`${value}T00:00:00Z`)) : '—'

export function PromotersReport({
  orgId,
  companyId,
  companyName,
  data,
  from,
  to
}: {
  orgId: string
  companyId: string
  companyName: string
  data: PromotersReportData | null
  from: string
  to: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)

  // null = All ledgers selected
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null)
  // Entry selected for side panel
  const [selectedEntry, setSelectedEntry] = useState<PromoterVoucherEntry | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const applyDates = () => {
    startTransition(() => {
      router.replace(dashboardUrl('/dashboard/reports/promoters-report', { orgId, companyId, from: draftFrom, to: draftTo }))
    })
  }

  const filteredLedgers = useMemo(() => {
    if (!data) return []
    return data.ledgers.filter(l => l.ledgerName.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [data, searchQuery])

  // Flatten or filter entries based on chip selection
  const activeEntries = useMemo<PromoterVoucherEntry[]>(() => {
    if (!data) return []
    if (!selectedLedgerId) {
      const all: PromoterVoucherEntry[] = []
      for (const ledger of filteredLedgers) {
        all.push(...(data.entriesByLedger[ledger.ledgerId] ?? []))
      }
      return all.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    }
    return data.entriesByLedger[selectedLedgerId] ?? []
  }, [data, selectedLedgerId, filteredLedgers])

  // Reactive KPIs
  const kpiTotalFunding = useMemo(() => {
    if (!data) return 0
    if (!selectedLedgerId) return data.totalCapital
    return data.ledgers.find(l => l.ledgerId === selectedLedgerId)?.closingBalance ?? 0
  }, [data, selectedLedgerId])

  const kpiOpening = useMemo(() => {
    if (!data) return 0
    if (!selectedLedgerId) return data.openingCapital
    return data.ledgers.find(l => l.ledgerId === selectedLedgerId)?.openingBalance ?? 0
  }, [data, selectedLedgerId])

  const kpiMovement = useMemo(() => {
    if (!data) return 0
    if (!selectedLedgerId) return data.netMovement
    return data.ledgers.find(l => l.ledgerId === selectedLedgerId)?.netMovement ?? 0
  }, [data, selectedLedgerId])

  const kpiCount = activeEntries.length

  const selectedEntryLedgerName = useMemo(() =>
    data?.ledgers.find(l => l.ledgerId === selectedEntry?.ledgerId)?.ledgerName ?? '—'
    , [data, selectedEntry])

  return (
    <AppShell topNav={<Header />} mobileNav={false} height="auto" contentPadding={4}>

      {/* Page Header */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '24px 28px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 999, padding: '2px 10px', marginBottom: 8 }}>
              Funding Overview
            </span>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
              Promoter &amp; Shareholder Funding
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, margin: '4px 0 0' }}>
              {companyName} · Unsecured Loans &amp; Capital Account Audit
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <NextLink href={`/dashboard/compliance-mapping?type=PROMOTERS&org=${orgId}&company=${companyId}&returnTo=${encodeURIComponent(`/dashboard/reports/promoters-report?org=${orgId}&company=${companyId}`)}`} passHref legacyBehavior>
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
                style={{ padding: '5px 12px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: isPending ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                {isPending ? '…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Funding</span>
            <ShieldCheck size={16} style={{ color: '#1d4ed8' }} />
          </div>
          <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{amount(kpiTotalFunding)}</span>
          <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{selectedLedgerId ? 'Ledger closing balance' : 'All mapped closing balances'}</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Opening Funding</span>
            <Clock size={16} style={{ color: '#64748b' }} />
          </div>
          <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{amount(kpiOpening)}</span>
          <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Opening balance in period</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net Movement</span>
            <FileText size={16} style={{ color: kpiMovement >= 0 ? '#16a34a' : '#dc2626' }} />
          </div>
          <span style={{ display: 'block', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: kpiMovement >= 0 ? '#16a34a' : '#dc2626' }}>
            {kpiMovement >= 0 ? '+' : ''}{amount(kpiMovement)}
          </span>
          <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Increase / Decrease in period</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transactions</span>
            <Eye size={16} style={{ color: '#1d4ed8' }} />
          </div>
          <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{kpiCount}</span>
          <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Vouchers in selection</span>
        </div>
      </div>


      {/* Main Table */}
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

        {/* Ledger summary rows — all rows always shown; click to filter */}
        {data && filteredLedgers.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '7px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ledger Name</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Closing Balance</span>
            </div>

            {filteredLedgers.map((l, i, arr) => {
              const isSelected = selectedLedgerId === l.ledgerId
              return (
                <div
                  key={l.ledgerId}
                  onClick={() => { setSelectedLedgerId(isSelected ? null : l.ledgerId); setSelectedEntry(null) }}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr auto', padding: '11px 20px',
                    borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: isSelected ? '#eff6ff' : '#fff',
                    borderLeft: isSelected ? '3px solid #1d4ed8' : '3px solid transparent',
                    cursor: 'pointer',
                    transition: 'background 0.12s'
                  }}
                >
                  <span style={{ fontSize: 13, color: isSelected ? '#1d4ed8' : '#334155', fontWeight: isSelected ? 700 : 500 }}>{l.ledgerName}</span>
                  <span style={{ fontSize: 13, color: isSelected ? '#1d4ed8' : '#0f172a', fontWeight: 700, textAlign: 'right' }}>{amount(l.closingBalance)}</span>
                </div>
              )
            })}

            {/* Subgroup Total — click to reset to All */}
            <div
              onClick={() => { setSelectedLedgerId(null); setSelectedEntry(null) }}
              style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '11px 20px', background: selectedLedgerId === null ? '#dbeafe' : '#f0f9ff', borderTop: '2px solid #bfdbfe', cursor: 'pointer', transition: 'background 0.12s' }}
            >
              <span style={{ fontSize: 13, color: '#1e3a5f', fontWeight: 800 }}>
                {selectedLedgerId ? 'Show All Ledgers ↑' : 'Subgroup Balance Total'}
              </span>
              <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 800, textAlign: 'right' }}>{amount(kpiTotalFunding)}</span>
            </div>
          </>
        )}

        {/* Voucher transactions header */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Voucher Transaction Logs (Period Movement)
          </span>
        </div>

        {/* Table column headers — Date | Particulars | Nature/Group | gap | Debit | Credit | Net Amount */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 120px 40px 130px 130px 130px', padding: '8px 20px', background: '#eff6ff', borderBottom: '1px solid #dbeafe', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Particulars</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nature / Group</span>
          <span />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Debit</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Credit</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Net Amount</span>
        </div>

        {/* Voucher rows */}
        {activeEntries.length > 0 ? (
          <>
            {activeEntries.map((entry, i) => {
              const ledgerName = data?.ledgers.find(l => l.ledgerId === entry.ledgerId)?.ledgerName ?? '—'
              const net = entry.credit - entry.debit
              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  style={{
                    display: 'grid', gridTemplateColumns: '80px 1fr 120px 40px 130px 130px 130px',
                    padding: '11px 20px', cursor: 'pointer', alignItems: 'center',
                    borderBottom: i < activeEntries.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: selectedEntry?.id === entry.id ? '#f0f9ff' : '#fff',
                    transition: 'background 0.1s'
                  }}
                >
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{date(entry.date)}</span>
                  <div style={{ minWidth: 0, paddingRight: 12 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.particulars}
                    </span>
                    {entry.number && (
                      <span style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginTop: 1 }}>{entry.type} #{entry.number}</span>
                    )}
                  </div>
                  <div>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 115 }}>
                      {ledgerName}
                    </span>
                  </div>
                  <span />{/* spacer gap */}
                  <span style={{ fontSize: 12, fontWeight: 600, color: entry.debit > 0 ? '#dc2626' : '#94a3b8', textAlign: 'right' }}>
                    {entry.debit > 0 ? amount(entry.debit) : '—'}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: entry.credit > 0 ? '#16a34a' : '#94a3b8', textAlign: 'right' }}>
                    {entry.credit > 0 ? amount(entry.credit) : '—'}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: net >= 0 ? '#16a34a' : '#dc2626', textAlign: 'right' }}>
                    {amount(net)}
                  </span>
                </div>
              )
            })}

            {/* Totals row */}
            {(() => {
              const totalDebit = activeEntries.reduce((s, e) => s + e.debit, 0)
              const totalCredit = activeEntries.reduce((s, e) => s + e.credit, 0)
              const totalNet = totalCredit - totalDebit
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 120px 40px 130px 130px 130px', padding: '12px 20px', alignItems: 'center', background: '#f0f9ff', borderTop: '2px solid #bfdbfe' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8', gridColumn: '1 / 5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total ({activeEntries.length} entries)</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: totalDebit > 0 ? '#dc2626' : '#94a3b8', textAlign: 'right' }}>
                    {totalDebit > 0 ? amount(totalDebit) : '—'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: totalCredit > 0 ? '#16a34a' : '#94a3b8', textAlign: 'right' }}>
                    {totalCredit > 0 ? amount(totalCredit) : '—'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: totalNet >= 0 ? '#16a34a' : '#dc2626', textAlign: 'right' }}>
                    {totalNet >= 0 ? '+' : ''}{amount(totalNet)}
                  </span>
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

      {/* Voucher Detail Side Panel — same pattern as TDS Audit Trail */}
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
                <button
                  onClick={() => setSelectedEntry(null)}
                  style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, color: '#64748b' }}
                >
                  <X size={20} />
                </button>
              </div>
            }
            content={
              <LayoutContent padding={4}>
                <VStack gap={4}>
                  {/* Amounts summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Debit</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: selectedEntry.debit > 0 ? '#dc2626' : '#cbd5e1' }}>
                        {selectedEntry.debit > 0 ? amount(selectedEntry.debit) : '—'}
                      </span>
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Credit</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: selectedEntry.credit > 0 ? '#16a34a' : '#cbd5e1' }}>
                        {selectedEntry.credit > 0 ? amount(selectedEntry.credit) : '—'}
                      </span>
                    </div>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 16px' }}>
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Net Impact</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: (selectedEntry.credit - selectedEntry.debit) >= 0 ? '#16a34a' : '#dc2626' }}>
                        {(selectedEntry.credit - selectedEntry.debit) >= 0 ? '+' : ''}{amount(selectedEntry.credit - selectedEntry.debit)}
                      </span>
                    </div>
                  </div>

                  {/* Detail fields table */}
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                    {([
                      ['Ledger / Account', selectedEntryLedgerName],
                      ['Date', date(selectedEntry.date)],
                      ['Voucher Type', selectedEntry.type],
                      ['Voucher Number', selectedEntry.number ? `#${selectedEntry.number}` : '—'],
                      ['Particulars', selectedEntry.particulars],
                      ['Voucher Entry ID', selectedEntry.id],
                      ['Voucher ID', selectedEntry.voucherId],
                    ] as [string, string][]).map(([label, value], idx, arr) => (
                      <div key={label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', borderBottom: idx < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
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
