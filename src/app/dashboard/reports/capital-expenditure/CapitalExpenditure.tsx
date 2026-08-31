'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { AppShell, Card, Layout, LayoutContent, Link, VStack, HStack, Text, Heading, Badge } from '@astryxdesign/core'
import { AlertCircle, ClipboardList, Info, Settings2, ChevronDown, ChevronRight } from 'lucide-react'
import Header from '@/components/ui/Header'
import type { CapitalExpenditureReportData, CapitalExpenditureVoucherEntry, CapitalExpenditureLedgerPosition } from '@/lib/data'
import { dashboardUrl } from '@/lib/dashboard-navigation'

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const amount = (value: number) => value === 0 ? '—' : money.format(value)
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'short' }).format(new Date(`${value}T00:00:00Z`)) : '—'

const ACCENT = 'var(--accent, var(--color-border-blue, #0064E0))'
const ACCENT_SOFT = 'var(--accent-soft, var(--color-background-blue, #0171E333))'
const ACCENT_BORDER = 'var(--accent-border, var(--color-border-blue, #0064E0))'
const ACCENT_DARK = 'var(--accent-dark, var(--color-text-blue, #042F97))'

const CAPEX_BLOCK_NAMES: Record<string, string> = {
  A: 'Furniture & Fittings',
  B: 'Machinery & Plant',
  C: 'Land / Plant Land & Charges',
  D: 'Office Equipment',
  E: 'Computer & Laptop',
  F: 'Building Construction',
  N: 'Electrical Equipment',
  OTHER: 'Other / CWIP',
}

interface Props {
  orgId: string
  companyId: string
  companyName: string
  data: CapitalExpenditureReportData | null
  from: string
  to: string
}

export function CapitalExpenditure({
  orgId,
  companyId,
  companyName,
  data,
  from,
  to,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const [searchQuery, setSearchQuery] = useState('')

  // Selection states
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<CapitalExpenditureVoucherEntry | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const applyDates = () => {
    startTransition(() => {
      router.replace(dashboardUrl('/dashboard/reports/capital-expenditure', { orgId, companyId, from: draftFrom, to: draftTo }))
    })
  }

  // Mapped ledgers grouped by Asset Block
  const groupedLedgers = useMemo(() => {
    const groups: Record<string, CapitalExpenditureLedgerPosition[]> = {}
    for (const ledger of data?.ledgers ?? []) {
      if (!ledger.ledgerName.toLowerCase().includes(searchQuery.toLowerCase())) continue
      const cat = ledger.category || 'OTHER'
      groups[cat] = [...(groups[cat] ?? []), ledger]
    }
    return groups
  }, [data, searchQuery])

  // Asset Block summary table
  const blockSummaries = useMemo(() => {
    const summaries: Record<string, { key: string; label: string; total: number; count: number; opening: number }> = {
      A: { key: 'A', label: CAPEX_BLOCK_NAMES.A, total: 0, count: 0, opening: 0 },
      B: { key: 'B', label: CAPEX_BLOCK_NAMES.B, total: 0, count: 0, opening: 0 },
      C: { key: 'C', label: CAPEX_BLOCK_NAMES.C, total: 0, count: 0, opening: 0 },
      D: { key: 'D', label: CAPEX_BLOCK_NAMES.D, total: 0, count: 0, opening: 0 },
      E: { key: 'E', label: CAPEX_BLOCK_NAMES.E, total: 0, count: 0, opening: 0 },
      F: { key: 'F', label: CAPEX_BLOCK_NAMES.F, total: 0, count: 0, opening: 0 },
      N: { key: 'N', label: CAPEX_BLOCK_NAMES.N, total: 0, count: 0, opening: 0 },
      OTHER: { key: 'OTHER', label: CAPEX_BLOCK_NAMES.OTHER, total: 0, count: 0, opening: 0 },
    }

    for (const ledger of data?.ledgers ?? []) {
      const cat = ledger.category || 'OTHER'
      if (summaries[cat]) {
        summaries[cat].total += ledger.closingBalance
        summaries[cat].opening += ledger.openingBalance
        summaries[cat].count += 1
      }
    }

    return Object.values(summaries).filter((s) => s.count > 0)
  }, [data])

  // Selected ledger object
  const selectedLedgerObj = useMemo(() => {
    if (!selectedLedgerId || !data) return null
    return data.ledgers.find((l) => l.ledgerId === selectedLedgerId) || null
  }, [data, selectedLedgerId])

  // Get active voucher lines
  const activeEntries = useMemo(() => {
    if (!data) return []
    if (!selectedLedgerId) {
      // Flatten all entries if nothing is selected
      const all: CapitalExpenditureVoucherEntry[] = []
      for (const entries of Object.values(data.entriesByLedger)) {
        all.push(...entries)
      }
      return all.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    }
    return data.entriesByLedger[selectedLedgerId] ?? []
  }, [data, selectedLedgerId])

  return (
    <AppShell topNav={<Header />} mobileNav={false} height="auto" contentPadding={4}>
      <Layout>
        <LayoutContent style={{ padding: 'var(--spacing-4)', background: 'var(--color-background, #f8fafc)' }}>
          <VStack gap={6} style={{ width: '100%' }}>

            {/* ── Page Header ─────────────────────────────────────── */}
            <Card style={{ padding: 'var(--spacing-5)', width: '100%', boxShadow: 'var(--shadow-low)' }}>
              <HStack justify="between" align="center" wrap="wrap" gap={4} style={{ width: '100%' }}>
                <VStack gap={1}>
                  <HStack gap={2} align="center">
                    <Badge variant="info" label="Capital Expenditure" style={{ backgroundColor: ACCENT_SOFT, color: ACCENT_DARK, border: `1px solid ${ACCENT_BORDER}`, fontWeight: 700 }} />
                  </HStack>
                  <Heading level={2} style={{ margin: 0, fontWeight: 'var(--font-weight-bold)' }}>
                    Capital Expenditure
                  </Heading>
                  <Text type="supporting" style={{ color: 'var(--color-text-muted)' }}>
                    {companyName} · Fixed Assets &amp; Capital Expenses Audit
                  </Text>
                </VStack>

                <VStack align="end" gap={3}>
                  <NextLink href={`/dashboard/compliance-mapping?type=CAPEX&org=${orgId}&company=${companyId}&returnTo=${encodeURIComponent(`/dashboard/reports/capital-expenditure?org=${orgId}&company=${companyId}`)}`} passHref legacyBehavior>
                    <Link className="px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer">
                      <Settings2 size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                      Manage Mapping
                    </Link>
                  </NextLink>

                  <HStack align="center" gap={2}>
                    <input
                      type="date"
                      aria-label="Period start date"
                      value={draftFrom}
                      onChange={(event) => setDraftFrom(event.target.value)}
                      style={{ width: 120, padding: '5px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)', background: 'var(--color-background)', fontSize: 11, color: 'var(--color-text)', outline: 'none' }}
                    />
                    <Text type="supporting" weight="semibold" style={{ color: 'var(--color-text-muted)' }}>to</Text>
                    <input
                      type="date"
                      aria-label="Balance ending date"
                      value={draftTo}
                      onChange={(event) => setDraftTo(event.target.value)}
                      style={{ width: 120, padding: '5px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)', background: 'var(--color-background)', fontSize: 11, color: 'var(--color-text)', outline: 'none' }}
                    />
                    <button
                      onClick={applyDates}
                      disabled={isPending}
                      style={{ padding: '5px 12px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 'var(--radius-element)', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: isPending ? 0.6 : 1, whiteSpace: 'nowrap' }}
                    >
                      {isPending ? '…' : 'Apply'}
                    </button>
                  </HStack>
                </VStack>
              </HStack>
            </Card>

            {!data || data.ledgers.length === 0 ? (
              <Card style={{ padding: 'var(--spacing-8)', textAlign: 'center', width: '100%', boxShadow: 'var(--shadow-low)' }}>
                <VStack gap={4} align="center" style={{ width: '100%' }}>
                  <AlertCircle size={48} style={{ color: 'var(--color-text-muted)' }} />
                  <Heading level={3} style={{ margin: 0 }}>No capital expenditure mapping found</Heading>
                  <Text style={{ color: 'var(--color-text-muted)', maxWidth: 460, lineHeight: 1.5 }}>
                    Select the fixed asset / capital expenditure ledger groups and accounts that should appear in this report.
                  </Text>
                  <NextLink href={`/dashboard/compliance-mapping?type=CAPEX&org=${orgId}&company=${companyId}&returnTo=${encodeURIComponent(`/dashboard/reports/capital-expenditure?org=${orgId}&company=${companyId}`)}`} passHref legacyBehavior>
                    <Link className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer">
                      Go to CAPEX Mapping
                    </Link>
                  </NextLink>
                </VStack>
              </Card>
            ) : (
              <VStack gap={6} style={{ width: '100%' }}>

                {/* ── Group Balance Summary Table ─────────────────────── */}
                <Card style={{ padding: 'var(--spacing-5)', width: '100%', boxShadow: 'var(--shadow-low)' }}>
                  <VStack gap={4} style={{ width: '100%' }}>
                    <HStack gap={2} align="center">
                      <ClipboardList size={18} style={{ color: 'var(--color-text)' }} />
                      <Heading level={3} style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                        Group Balance Summary
                      </Heading>
                    </HStack>

                    <div style={{ overflowX: 'auto', width: '100%' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '1.5px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                            <th style={{ padding: '10px 12px' }}>Group</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Mapped Ledgers</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Opening</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Closing</th>
                          </tr>
                        </thead>
                        <tbody>
                          {blockSummaries.map((group) => (
                            <tr key={group.key} style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                              <td style={{ padding: 12, fontWeight: 600 }}>
                                {group.label}
                              </td>
                              <td style={{ padding: 12, textAlign: 'right', color: 'var(--color-text-muted)' }}>
                                <Badge label={`${group.count} ${group.count === 1 ? 'ledger' : 'ledgers'}`} variant="neutral" />
                              </td>
                              <td style={{ padding: 12, textAlign: 'right', color: 'var(--color-text-muted)' }}>
                                {amount(group.opening)}
                              </td>
                              <td style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: ACCENT }}>
                                {amount(group.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </VStack>
                </Card>

                {/* ── Main Breakdown Table (Collapsible Block Groups) ── */}
                <Card style={{ padding: 'var(--spacing-5)', width: '100%', boxShadow: 'var(--shadow-low)' }}>
                  <VStack gap={4} style={{ width: '100%' }}>
                    <HStack justify="between" align="center" wrap="wrap" gap={3} style={{ width: '100%' }}>
                      <HStack gap={2} align="center">
                        <ClipboardList size={18} style={{ color: 'var(--color-text)' }} />
                        <Heading level={3} style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                          Capital Expenditure Ledgers breakdown
                        </Heading>
                        <Text type="supporting" style={{ color: 'var(--color-text-muted)' }}>
                          · Click a group to expand/collapse, click a ledger to filter voucher entries
                        </Text>
                      </HStack>
                      <input
                        type="text"
                        placeholder="Search ledgers..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        style={{ width: 220, padding: '6px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)', background: 'var(--color-background)', fontSize: 12, outline: 'none', color: 'var(--color-text)' }}
                      />
                    </HStack>

                    <div style={{ overflowX: 'auto', width: '100%' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '1.5px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                            <th style={{ padding: '10px 12px' }}>Ledger Account Name</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Opening Balance</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Closing Balance</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Net Movement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(groupedLedgers).length === 0 ? (
                            <tr>
                              <td colSpan={4} style={{ padding: '40px 10px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                No ledgers match your search.
                              </td>
                            </tr>
                          ) : (
                            Object.entries(groupedLedgers).map(([catKey, ledgers]) => {
                              const isCollapsed = !!collapsedGroups[catKey]
                              const groupName = CAPEX_BLOCK_NAMES[catKey] || catKey
                              const groupOpening = ledgers.reduce((sum, ledger) => sum + ledger.openingBalance, 0)
                              const groupClosing = ledgers.reduce((sum, ledger) => sum + ledger.closingBalance, 0)
                              const groupMovement = groupClosing - groupOpening

                              return (
                                <React.Fragment key={catKey}>
                                  {/* Collapsible Group Row */}
                                  <tr
                                    onClick={() => setCollapsedGroups((previous) => ({ ...previous, [catKey]: !previous[catKey] }))}
                                    style={{
                                      backgroundColor: 'var(--color-background, #f8fafc)',
                                      borderBottom: '1px solid var(--color-border)',
                                      cursor: 'pointer',
                                      userSelect: 'none',
                                    }}
                                  >
                                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                      <HStack gap={1.5} align="center">
                                        {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                        <Text>{groupName}</Text>
                                      </HStack>
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                      {amount(groupOpening)}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: ACCENT }}>
                                      {amount(groupClosing)}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: groupMovement >= 0 ? 'var(--color-text-green)' : 'var(--color-text-red)' }}>
                                      {groupMovement >= 0 ? '+' : ''}{amount(groupMovement)}
                                    </td>
                                  </tr>

                                  {/* Individual Mapped Ledger Rows */}
                                  {!isCollapsed && ledgers.map((ledger) => {
                                    const isSelected = selectedLedgerId === ledger.ledgerId

                                    return (
                                      <tr
                                        key={ledger.ledgerId}
                                        onClick={() => {
                                          setSelectedLedgerId(isSelected ? null : ledger.ledgerId)
                                          setSelectedEntry(null)
                                        }}
                                        style={{
                                          borderBottom: '1px solid var(--color-border)',
                                          cursor: 'pointer',
                                          background: isSelected ? ACCENT_SOFT : 'transparent',
                                          borderLeft: isSelected ? `3px solid ${ACCENT}` : '3px solid transparent',
                                          transition: 'background 0.1s',
                                        }}
                                      >
                                        <td style={{ padding: '12px 12px 12px 24px', fontWeight: 600, color: isSelected ? ACCENT_DARK : 'var(--color-text)' }}>
                                          <HStack justify="between" align="center" style={{ width: '100%' }}>
                                            <HStack gap={1} align="center">
                                              <Text style={{ color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}>-----</Text>
                                              <Text>{ledger.ledgerName}</Text>
                                            </HStack>
                                          </HStack>
                                        </td>
                                        <td style={{ padding: 12, textAlign: 'right', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                          {amount(ledger.openingBalance)}
                                        </td>
                                        <td style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: ACCENT }}>
                                          {amount(ledger.closingBalance)}
                                        </td>
                                        <td style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: ledger.netMovement >= 0 ? 'var(--color-text-green)' : 'var(--color-text-red)' }}>
                                          {ledger.netMovement >= 0 ? '+' : ''}{amount(ledger.netMovement)}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </React.Fragment>
                              )
                            })
                          )}
                        </tbody>
                        <tfoot>
                          <tr
                            onClick={() => {
                              setSelectedLedgerId(null)
                              setSelectedEntry(null)
                            }}
                            style={{
                              background: selectedLedgerId === null ? 'var(--color-background)' : ACCENT_SOFT,
                              borderTop: '2px solid var(--color-border-emphasized)',
                              cursor: 'pointer',
                            }}
                          >
                            <td style={{ padding: '12px', fontWeight: 800, color: selectedLedgerId === null ? 'var(--color-text)' : ACCENT_DARK }}>
                              {selectedLedgerId ? 'Show All Capital Expenditures ↑' : 'Total Capital Expenditure'}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: 'var(--color-text-muted)' }}>
                              {money.format(data.openingCapex)}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: ACCENT }}>
                              {money.format(data.totalCapex)}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: data.netMovement >= 0 ? 'var(--color-text-green)' : 'var(--color-text-red)' }}>
                              {data.netMovement >= 0 ? '+' : ''}{money.format(data.netMovement)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </VStack>
                </Card>

                {/* ── Voucher Transaction Logs Table ─────────────────── */}
                <Card style={{ padding: 'var(--spacing-5)', width: '100%', boxShadow: 'var(--shadow-low)' }}>
                  <VStack gap={4} style={{ width: '100%' }}>
                    <HStack justify="between" align="center" style={{ width: '100%' }}>
                      <HStack gap={2} align="center">
                        <ClipboardList size={18} style={{ color: 'var(--color-text)' }} />
                        <Heading level={3} style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                          Voucher Transaction Logs {selectedLedgerId ? `(${selectedLedgerObj?.ledgerName})` : '(All Mapped CapEx)'}
                        </Heading>
                      </HStack>
                      <Badge label={`${activeEntries.length} entries`} variant="neutral" />
                    </HStack>

                    <div style={{ overflowX: 'auto', width: '100%', borderRadius: 'var(--radius-container)', border: '1px solid var(--color-border)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: 'var(--color-background)', borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                            <th style={{ padding: '12px 20px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</th>
                            <th style={{ padding: '12px 20px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Particulars</th>
                            <th style={{ padding: '12px 20px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CapEx Ledger</th>
                            <th style={{ padding: '12px 20px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Debit (+)</th>
                            <th style={{ padding: '12px 20px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Credit (-)</th>
                            <th style={{ padding: '12px 20px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Net Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeEntries.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ padding: '40px 10px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                No voucher transactions found for this selection.
                              </td>
                            </tr>
                          ) : (
                            activeEntries.map((entry) => {
                              const ledgerName = data?.ledgers.find((l) => l.ledgerId === entry.ledgerId)?.ledgerName ?? '—'
                              const net = entry.debit - entry.credit

                              return (
                                <tr
                                  key={entry.id}
                                  onClick={() => setSelectedEntry(entry)}
                                  style={{
                                    borderBottom: '1px solid var(--color-border)',
                                    cursor: 'pointer',
                                    background: selectedEntry?.id === entry.id ? ACCENT_SOFT : 'transparent',
                                    transition: 'background 0.1s',
                                  }}
                                >
                                  <td style={{ padding: '12px 20px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                    {date(entry.date)}
                                  </td>
                                  <td style={{ padding: '12px 20px' }}>
                                    <VStack gap={0.5}>
                                      <Text weight="semibold" style={{ color: 'var(--color-text)' }}>
                                        {entry.particulars}
                                      </Text>
                                      {entry.number && (
                                        <Text style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                                          {entry.type} #{entry.number}
                                        </Text>
                                      )}
                                    </VStack>
                                  </td>
                                  <td style={{ padding: '12px 20px' }}>
                                    <Badge label={ledgerName} variant="info" style={{ backgroundColor: ACCENT_SOFT, color: ACCENT_DARK, border: `1px solid ${ACCENT_BORDER}` }} />
                                  </td>
                                  <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: entry.debit > 0 ? ACCENT : 'var(--color-text-muted)' }}>
                                    {entry.debit > 0 ? amount(entry.debit) : '—'}
                                  </td>
                                  <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: entry.credit > 0 ? 'var(--color-text-green)' : 'var(--color-text-muted)' }}>
                                    {entry.credit > 0 ? amount(entry.credit) : '—'}
                                  </td>
                                  <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, color: net >= 0 ? ACCENT : 'var(--color-text-red)' }}>
                                    {net >= 0 ? '+' : ''}{money.format(net)}
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </VStack>
                </Card>

              </VStack>
            )}

          </VStack>
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
