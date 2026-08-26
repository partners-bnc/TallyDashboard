'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { AppShell, Dialog, Layout, LayoutContent, Link, VStack } from '@astryxdesign/core'
import { ArrowLeft, CalendarDays, Settings2, BarChart2, TrendingUp, TrendingDown, ClipboardList, Info, AlertCircle, FileText, CheckCircle2, X, ChevronRight, ChevronDown } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import Header from '@/components/ui/Header'
import type { GstReportData, GstLedgerPosition, GstVoucherEntry } from '@/lib/data'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const amount = (value: number) => value === 0 ? '—' : money.format(value)
const absoluteAmount = (value: number) => money.format(Math.abs(value))

const query = (values: Record<string, string | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value)
  return params.toString()
}

// Accent colour variables (indigo standard)
const ACCENT = 'var(--accent, #6366f1)'
const ACCENT_SOFT = 'var(--accent-soft, #e0e7ff)'
const ACCENT_BORDER = 'var(--accent-border, #cbd5e1)'
const ACCENT_DARK = 'var(--accent-dark, #4f46e5)'

export function DutiesAndTaxesReport({
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
  data: GstReportData | null
  from: string
  to: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [taxTypeFilter, setTaxTypeFilter] = useState<string>('all')
  const [selectedLedger, setSelectedLedger] = useState<GstLedgerPosition | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [selectedFilterLedgerId, setSelectedFilterLedgerId] = useState<string | null>(null)

  const applyDates = () => {
    startTransition(() => {
      router.push(`/dashboard/reports/duties-and-taxes?${query({ org: orgId, company: companyId, from: draftFrom, to: draftTo })}`)
    })
  }

  const filteredLedgers = useMemo(() => {
    if (!data) return []
    return data.ledgers.filter((l) => {
      const matchesSearch = l.ledgerName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = categoryFilter === 'all' || l.category === categoryFilter
      const matchesTaxType = taxTypeFilter === 'all' || l.taxType === taxTypeFilter
      return matchesSearch && matchesCategory && matchesTaxType
    })
  }, [data, searchQuery, categoryFilter, taxTypeFilter])

  const groupedLedgers = useMemo(() => {
    const groups: Record<string, GstLedgerPosition[]> = {}
    for (const l of filteredLedgers) {
      const parent = l.parentName || 'Unassigned'
      if (!groups[parent]) groups[parent] = []
      groups[parent].push(l)
    }
    return groups
  }, [filteredLedgers])

  const filteredEntries = useMemo(() => {
    if (!data) return []
    return data.entries.filter((e) => {
      const matchesSearch = e.particulars.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            e.ledgerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            e.voucherNumber.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter
      const matchesTaxType = taxTypeFilter === 'all' || e.taxType === taxTypeFilter
      const matchesLedger = !selectedFilterLedgerId || e.ledgerId === selectedFilterLedgerId
      return matchesSearch && matchesCategory && matchesTaxType && matchesLedger
    })
  }, [data, searchQuery, categoryFilter, taxTypeFilter, selectedFilterLedgerId])

  // Custom tooltips for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '12px', padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', marginBottom: '8px', fontSize: '12px' }}>{label}</p>
          <p style={{ margin: 0, color: '#16a34a', fontSize: '12px', fontWeight: 600 }}>
            Input GST (ITC): {money.format(payload[0].value)}
          </p>
          <p style={{ margin: 0, color: '#6366f1', fontSize: '12px', fontWeight: 600 }}>
            Output GST (Liability): {money.format(payload[1].value)}
          </p>
          <p style={{ margin: '8px 0 0', borderTop: '1px solid #e2e8f0', paddingTop: '6px', fontSize: '12px', fontWeight: 700, color: payload[0].value - payload[1].value >= 0 ? '#16a34a' : '#ef4444' }}>
            Net: {money.format(payload[0].value - payload[1].value)} {payload[0].value - payload[1].value >= 0 ? '(Refundable)' : '(Payable)'}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <AppShell topNav={<Header />} mobileNav={false} height="auto" contentPadding={4}>
      
      {/* ── Page Header ─────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '24px 28px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: ACCENT_DARK, background: ACCENT_SOFT, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 999, padding: '2px 10px', marginBottom: 8 }}>
              Duties & Taxes (GST) Audit
            </span>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
              Duties & Taxes (GST) Report
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
              {companyName} · Input Tax Credit, Output Liability & Net Payable Analysis
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <NextLink href={`/dashboard/compliance-mapping?type=GST&org=${orgId}&company=${companyId}&returnTo=${encodeURIComponent(`/dashboard/reports/duties-and-taxes?org=${orgId}&company=${companyId}`)}`} passHref legacyBehavior>
              <Link className="px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer">
                <Settings2 size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Manage Mapping
              </Link>
            </NextLink>

            {/* Date Filter */}
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

      {!data || data.ledgers.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '60px 40px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <AlertCircle size={48} style={{ color: '#94a3b8', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>No GST mapping found</h2>
          <p style={{ fontSize: 14, color: '#64748b', maxWidth: 460, margin: '0 auto 24px', lineHeight: 1.5 }}>
            Select your GST input, output, and duties ledger groups first to generate this report.
          </p>
          <NextLink href={`/dashboard/compliance-mapping?type=GST&org=${orgId}&company=${companyId}&returnTo=${encodeURIComponent(`/dashboard/reports/duties-and-taxes?org=${orgId}&company=${companyId}`)}`} passHref legacyBehavior>
            <Link className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer">
              Go to GST Mapping
            </Link>
          </NextLink>
        </div>
      ) : (
        <VStack gap={6}>
          {/* ── KPI Cards ───────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Input GST (ITC)</span>
                <TrendingUp size={16} style={{ color: '#16a34a' }} />
              </div>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.02em' }}>{amount(data.totalInput)}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Total input credit in period</span>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Output GST (Liability)</span>
                <TrendingDown size={16} style={{ color: '#ef4444' }} />
              </div>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: '#ef4444', letterSpacing: '-0.02em' }}>{amount(data.totalOutput)}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Total output liability in period</span>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net Position</span>
                <CheckCircle2 size={16} style={{ color: data.netPosition >= 0 ? '#16a34a' : '#f59e0b' }} />
              </div>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: data.netPosition >= 0 ? '#16a34a' : '#ef4444', letterSpacing: '-0.02em' }}>
                {absoluteAmount(data.netPosition)}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: data.netPosition >= 0 ? '#15803d' : '#b45309', background: data.netPosition >= 0 ? '#dcfce7' : '#fef3c7', padding: '1px 6px', borderRadius: 4, marginTop: 4 }}>
                {data.netPosition >= 0 ? 'ITC Refundable / Balance' : 'Net GST Payable'}
              </span>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Other Duties</span>
                <FileText size={16} style={{ color: '#6366f1' }} />
              </div>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{amount(data.totalOthers)}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Customs, Cess & other duties</span>
            </div>
          </div>

          {/* ── Visualization and Trends ───────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', gap: 20 }}>
            {/* Chart */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <BarChart2 size={18} style={{ color: '#0f172a' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Monthly GST Trends</h3>
              </div>

              {data.monthlyTrends.length === 0 ? (
                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
                  No transaction data available in the selected period to display trends.
                </div>
              ) : (
                <div style={{ height: 280, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: '#64748b' }} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(val) => money.format(val).replace('₹', '')} style={{ fontSize: '11px', fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                      <Bar name="Input (ITC)" dataKey="input" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar name="Output (Liability)" dataKey="output" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Tax Type Summary Breakdown */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <ClipboardList size={18} style={{ color: '#0f172a' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>GST Classification Summary</h3>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>
                      <th style={{ padding: '8px 10px' }}>Tax Type</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Input (ITC)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Output (Liability)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Net Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.taxTypes.map((row) => (
                      <tr key={row.type} style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{row.type}</td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#16a34a' }}>{amount(row.input)}</td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#ef4444' }}>{amount(row.output)}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: row.net >= 0 ? '#16a34a' : '#ef4444' }}>
                          {absoluteAmount(row.net)} {row.net >= 0 ? 'Dr' : 'Cr'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Ledgers Breakdown Table ────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardList size={18} style={{ color: '#0f172a' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>GST Ledgers & Accounts Breakdown</h3>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search ledgers..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: 180, padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, outline: 'none' }}
                />

                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, background: '#fff', outline: 'none' }}
                >
                  <option value="all">All Categories</option>
                  <option value="INPUT">Input GST</option>
                  <option value="OUTPUT">Output GST</option>
                  <option value="OTHER">Other Duties</option>
                </select>

                <select
                  value={taxTypeFilter}
                  onChange={e => setTaxTypeFilter(e.target.value)}
                  style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, background: '#fff', outline: 'none' }}
                >
                  <option value="all">All Tax Types</option>
                  <option value="CGST">CGST</option>
                  <option value="SGST">SGST</option>
                  <option value="IGST">IGST</option>
                  <option value="UTGST">UTGST</option>
                  <option value="CESS">Cess</option>
                  <option value="OTHER">Others</option>
                </select>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>
                    <th style={{ padding: '10px 12px' }}>Ledger Account Name</th>
                    <th style={{ padding: '10px 12px' }}>Category</th>
                    <th style={{ padding: '10px 12px' }}>Tax Type</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Opening Balance</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Net Movement</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Closing Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(groupedLedgers).length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px 10px', textAlign: 'center', color: '#64748b' }}>
                        No ledgers match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    Object.entries(groupedLedgers).map(([groupName, ledgers]) => {
                      const isCollapsed = !!collapsedGroups[groupName]
                      return (
                        <React.Fragment key={groupName}>
                          <tr
                            onClick={() => setCollapsedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }))}
                            style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' }}
                            className="hover:bg-slate-100/80 transition-all"
                          >
                            <td colSpan={6} style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', verticalAlign: 'middle' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                {groupName}
                              </span>
                            </td>
                          </tr>
                          {!isCollapsed && ledgers.map((l) => {
                            const isSelected = selectedFilterLedgerId === l.ledgerId
                            return (
                              <tr
                                key={l.ledgerId}
                                onClick={() => setSelectedFilterLedgerId(isSelected ? null : l.ledgerId)}
                                style={{
                                  borderBottom: '1px solid #f1f5f9',
                                  cursor: 'pointer',
                                  transition: 'background 0.1s',
                                  backgroundColor: isSelected ? ACCENT_SOFT : undefined
                                }}
                                className="hover:bg-slate-50"
                              >
                                <td style={{ padding: '12px 12px 12px 24px', fontWeight: 600, color: '#0f172a' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                    <span>{l.ledgerName}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedLedger(l)
                                      }}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        display: 'inline-flex',
                                        alignItems: 'center'
                                      }}
                                      title="View Ledger Details"
                                    >
                                      <Info size={14} className="text-slate-400 hover:text-indigo-600 transition-colors" />
                                    </button>
                                  </div>
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    backgroundColor: l.category === 'INPUT' ? '#dcfce7' : l.category === 'OUTPUT' ? '#e0e7ff' : '#f1f5f9',
                                    color: l.category === 'INPUT' ? '#15803d' : l.category === 'OUTPUT' ? '#4f46e5' : '#475569',
                                  }}>
                                    {l.category === 'INPUT' ? 'Input Credit' : l.category === 'OUTPUT' ? 'Output Liability' : 'Other Duty'}
                                  </span>
                                </td>
                                <td style={{ padding: '12px', fontWeight: 500, color: '#334155' }}>{l.taxType}</td>
                                <td style={{ padding: '12px', textAlign: 'right', color: '#334155' }}>
                                  {money.format(Math.abs(l.openingBalance))} {l.openingBalance < 0 ? 'Dr' : l.openingBalance > 0 ? 'Cr' : ''}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: l.category === 'INPUT' ? '#16a34a' : l.category === 'OUTPUT' ? '#ef4444' : '#0f172a' }}>
                                  {amount(l.netMovement)}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                  {money.format(Math.abs(l.closingBalance))} {l.closingBalance < 0 ? 'Dr' : l.closingBalance > 0 ? 'Cr' : ''}
                                </td>
                              </tr>
                            )
                          })}
                        </React.Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Voucher Transactions Table ─────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardList size={18} style={{ color: '#0f172a' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>GST Voucher Transactions (Audit Trail)</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedFilterLedgerId && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: ACCENT_SOFT,
                    border: `1px solid ${ACCENT_BORDER}`,
                    borderRadius: 8,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: ACCENT_DARK
                  }}>
                    Filtering: {data?.ledgers.find(l => l.ledgerId === selectedFilterLedgerId)?.ledgerName || 'Selected Ledger'}
                    <button 
                      onClick={() => setSelectedFilterLedgerId(null)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        color: ACCENT_DARK
                      }}
                      title="Clear Ledger Filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  {filteredEntries.length} transactions found
                </span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>
                    <th style={{ padding: '10px 12px' }}>Date</th>
                    <th style={{ padding: '10px 12px' }}>Voucher Type</th>
                    <th style={{ padding: '10px 12px' }}>Voucher No</th>
                    <th style={{ padding: '10px 12px' }}>Ledger Name</th>
                    <th style={{ padding: '10px 12px' }}>Particulars</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Debit (Dr)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Credit (Cr)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px 10px', textAlign: 'center', color: '#64748b' }}>
                        No transactions found in this period.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((e, index) => (
                      <tr key={`${e.voucherId}-${index}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', color: '#334155' }}>
                          {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(e.date))}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600, color: '#0f172a' }}>{e.voucherType}</td>
                        <td style={{ padding: '12px', color: '#334155' }}>{e.voucherNumber}</td>
                        <td style={{ padding: '12px', fontWeight: 500, color: '#334155' }}>{e.ledgerName}</td>
                        <td style={{ padding: '12px', color: '#475569', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.particulars}>
                          {e.particulars}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#16a34a', fontWeight: 500 }}>
                          {e.debit > 0 ? money.format(e.debit) : '—'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444', fontWeight: 500 }}>
                          {e.credit > 0 ? money.format(e.credit) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </VStack>
      )}

      {/* ── Ledger Detail Dialog ────────────────────────────── */}
      <Dialog isOpen={selectedLedger !== null} onOpenChange={(open) => { if (!open) setSelectedLedger(null) }}>
        {selectedLedger && (
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{selectedLedger.ledgerName}</h3>
              <button onClick={() => setSelectedLedger(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>
            <VStack gap={4}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Account Category</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{selectedLedger.category}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>GST Classification</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{selectedLedger.taxType}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Opening Balance</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{money.format(Math.abs(selectedLedger.openingBalance))} {selectedLedger.openingBalance < 0 ? 'Dr' : selectedLedger.openingBalance > 0 ? 'Cr' : ''}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Net Movement</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: selectedLedger.category === 'INPUT' ? '#16a34a' : selectedLedger.category === 'OUTPUT' ? '#ef4444' : '#0f172a' }}>
                    {amount(selectedLedger.netMovement)}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Closing Balance</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{money.format(Math.abs(selectedLedger.closingBalance))} {selectedLedger.closingBalance < 0 ? 'Dr' : selectedLedger.closingBalance > 0 ? 'Cr' : ''}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Ledger Audit Information</span>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px', fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
                  <p style={{ margin: '0 0 6px' }}><strong>Ledger Name:</strong> {selectedLedger.ledgerName}</p>
                  <p style={{ margin: '0 0 6px' }}><strong>Tally ID:</strong> {selectedLedger.ledgerId}</p>
                  <p style={{ margin: 0 }}>
                    This ledger has been matched and verified as a <strong>{selectedLedger.taxType} {selectedLedger.category.toLowerCase()} GST account</strong>. 
                    Closing balance and period movement are verified against imported accounting vouchers.
                  </p>
                </div>
              </div>
            </VStack>
          </div>
        )}
      </Dialog>
    </AppShell>
  )
}
