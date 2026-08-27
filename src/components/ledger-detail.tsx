'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, Lock, Activity, CaretLeft, CaretRight, MagnifyingGlass, ListDashes, SpinnerGap, X } from '@phosphor-icons/react'
import Header from '@/components/ui/Header'
import Footer from '@/components/ui/Footer'
import styles from './dashboard.module.css'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const voucherMoney = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

type LedgerLine = {
  voucher_id: string | null
  voucher_date: string | null
  voucher_type: string | null
  voucher_number: string | null
  particulars: string | null
  debit_amount: number | null
  credit_amount: number | null
  running_balance: number | null
}

type VoucherDetail = {
  voucher: {
    voucher_date: string | null
    effective_date: string | null
    voucher_type: string | null
    voucher_number: string | null
    party_ledger_name: string | null
    reference: string | null
    narration: string | null
  }
  entries: {
    id: string
    line_number: number
    ledger_name: string
    display_amount: number
  }[]
  totalAmount: number
}

function displayDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

interface LedgerDetailProps {
  orgId: string | null
  companyId: string
  ledgerId: string
}

function Metric({
  label,
  value,
  note,
  tone = '',
  icon: Icon
}: {
  label: string
  value: string
  note?: string
  tone?: string
  icon?: React.ComponentType<{ className?: string; size?: number; weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone' }>
}) {
  return (
    <div className={styles.metric}>
      <div className="flex items-center justify-between gap-4">
        <span>{label}</span>
        {Icon && <Icon className="text-slate-900" size={20} weight="light" />}
      </div>
      <strong className={tone}>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  )
}

export function LedgerDetail({ orgId, companyId, ledgerId }: LedgerDetailProps) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [selectedIndices, setSelectedIndices] = useState<Record<number, boolean>>({})
  const [lines, setLines] = useState<LedgerLine[]>([])
  const [ledgerInfo, setLedgerInfo] = useState<{
    name: string
    parent_name: string | null
    opening_balance: string | null
    closing_balance: string | null
  } | null>(null)

  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null)
  const [voucherDetail, setVoucherDetail] = useState<VoucherDetail | null>(null)
  const [voucherError, setVoucherError] = useState('')

  const loadLedger = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/ledger?company=${companyId}&ledger=${ledgerId}&page=${page}&search=${encodeURIComponent(query)}`, { signal })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Could not load ledger lines')
      setLines(payload.lines ?? [])
      setLedgerInfo(payload.ledger ?? null)
      setHasMore(payload.hasMore ?? false)
    } catch (reason: unknown) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(reason instanceof Error ? reason.message : 'Could not load ledger lines')
    } finally {
      setLoading(false)
    }
  }, [companyId, ledgerId, page, query])

  useEffect(() => {
    const controller = new AbortController()
    // Fetching a new page is an external synchronization; the loader owns its request state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLedger(controller.signal)
    return () => controller.abort()
  }, [loadLedger])

  useEffect(() => {
    if (!selectedVoucherId) return

    const controller = new AbortController()
    fetch(`/api/voucher?company=${companyId}&voucher=${selectedVoucherId}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error ?? 'Could not load voucher details')
        setVoucherDetail(payload)
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setVoucherError(reason instanceof Error ? reason.message : 'Could not load voucher details')
      })

    return () => controller.abort()
  }, [companyId, selectedVoucherId])

  useEffect(() => {
    if (!selectedVoucherId) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedVoucherId(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedVoucherId])

  const opening = Number(ledgerInfo?.opening_balance ?? 0)
  const closing = Number(ledgerInfo?.closing_balance ?? 0)
  const netMovement = closing - opening

  // Selection calculations
  const selectedLines = lines.filter((_, idx) => selectedIndices[idx])
  const selectedCount = selectedLines.length
  const totalSelectedDebit = selectedLines.reduce((sum, line) => sum + (line.debit_amount ?? 0), 0)
  const totalSelectedCredit = selectedLines.reduce((sum, line) => sum + (line.credit_amount ?? 0), 0)

  const openVoucher = (voucherId: string) => {
    setVoucherDetail(null)
    setVoucherError('')
    setSelectedVoucherId(voucherId)
  }

  const router = useRouter()

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between font-inter">
      <Header />

      <main className="flex-grow pt-4 pb-12">
        <div className={styles.shell}>

          {/* Back button & Title Header block */}
          <div className="mb-6">
            <button
              onClick={handleBack}
              className={styles.backButton3d}
            >
              <ArrowLeft size={16} weight="bold" />
              Back to Overview
            </button>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mt-1">
              {/* Key Value Metadata Pairs */}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ledger</span>
                  <h1 className="text-xl md:text-2xl font-semibold text-slate-900 mt-0.5">
                    {ledgerInfo?.name ?? 'Loading Ledger...'}
                  </h1>
                </div>
                <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Group</span>
                  <p className="text-sm md:text-base font-semibold text-slate-700 mt-0.5">
                    {ledgerInfo?.parent_name || 'Unassigned group'}
                  </p>
                </div>
              </div>

              <div className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-full border border-slate-200 w-max flex-shrink-0">
                Company Scoped Read-only
              </div>
            </div>
          </div>

          {/* Metrics summary cards */}
          <section className={`${styles.metrics} mb-8`}>
            <Metric
              label="Opening Balance"
              value={ledgerInfo ? money.format(opening) : '—'}
              note="Starting financial period balance"
              icon={BookOpen}
            />
            <Metric
              label="Closing Balance"
              value={ledgerInfo ? money.format(closing) : '—'}
              note="Latest synchronized balance"
              icon={Lock}
            />
            <Metric
              label="Net Movement"
              value={ledgerInfo ? money.format(netMovement) : '—'}
              note="Debit less credit difference"
              tone={netMovement >= 0 ? styles.debit : styles.credit}
              icon={Activity}
            />
          </section>

          {/* Transactions Table (Without Outer Card background) */}
          <section className="mt-8">
            <div className={styles.ledgerPanelHeader}>
              <div>
                <div className="flex items-center gap-2">
                  <ListDashes size={20} className="text-slate-900 flex-shrink-0" />
                  <h2>Transaction Ledger Lines</h2>
                </div>
              </div>

              {/* Search input bar */}
              <div className={styles.search}>
                <MagnifyingGlass size={18} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(0); setSelectedIndices({}) }}
                  placeholder="Search transactions..."
                  aria-label="Search transactions"
                />
              </div>
            </div>

            {/* Table or loading states */}
            {loading && lines.length === 0 ? (
              <div className="py-20 text-center text-sm text-slate-400 font-medium bg-white border border-slate-200 rounded-2xl">
                Fetching ledger lines...
              </div>
            ) : error ? (
              <div className="py-12 px-4 rounded-2xl border border-red-155 bg-red-50 text-red-650 text-sm text-center font-medium">
                {error}
              </div>
            ) : lines.length === 0 ? (
              <div className="py-20 text-center text-sm text-slate-400 font-medium bg-white border border-slate-200 rounded-2xl">
                No voucher transactions found.
              </div>
            ) : (
              <div className={styles.linesTable}>
                <div className={styles.linesTableHead}>
                  <span className="justify-center">
                    <input
                      type="checkbox"
                      checked={lines.length > 0 && lines.every((_, idx) => selectedIndices[idx])}
                      onChange={(e) => {
                        const checked = e.target.checked
                        const newSelected: Record<number, boolean> = {}
                        if (checked) {
                          lines.forEach((_, idx) => { newSelected[idx] = true })
                        }
                        setSelectedIndices(newSelected)
                      }}
                      className={styles.checkbox}
                    />
                  </span>
                  <span>Date</span>
                  <span>Voucher No.</span>
                  <span>Voucher Type</span>
                  <span>Particulars</span>
                  <span>Debit</span>
                  <span>Credit</span>
                </div>
                <div className="flex flex-col">
                  {lines.map((line, idx) => (
                    <div
                      key={`${line.voucher_id ?? 'line'}-${line.voucher_number ?? idx}-${idx}`}
                      className={styles.lineRow}
                      role={line.voucher_id ? 'button' : undefined}
                      tabIndex={line.voucher_id ? 0 : undefined}
                      onClick={() => line.voucher_id && openVoucher(line.voucher_id)}
                      onKeyDown={(event) => {
                        if (line.voucher_id && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault()
                          openVoucher(line.voucher_id)
                        }
                      }}
                      aria-label={line.voucher_id ? `Open ${line.voucher_type ?? 'voucher'} ${line.voucher_number ?? ''}` : undefined}
                    >
                      <span className="justify-center">
                        <input
                          type="checkbox"
                          checked={!!selectedIndices[idx]}
                          onChange={(e) => {
                            setSelectedIndices(prev => ({
                              ...prev,
                              [idx]: e.target.checked
                            }))
                          }}
                          onClick={(event) => event.stopPropagation()}
                          className={styles.checkbox}
                        />
                      </span>
                      <span className={styles.voucherDate}>
                        {line.voucher_date ?? '—'}
                      </span>
                      <span className="font-mono text-xs text-slate-500 font-medium">
                        {line.voucher_number ?? '—'}
                      </span>
                      <span className="text-slate-900 font-semibold truncate block">
                        {line.voucher_type ?? '—'}
                      </span>
                      <span className="text-slate-650 truncate">
                        {line.particulars || 'No particulars'}
                      </span>
                      <span className="font-semibold text-primary justify-end">
                        {line.debit_amount ? money.format(line.debit_amount) : '—'}
                      </span>
                      <span className="font-semibold text-emerald-650 justify-end">
                        {line.credit_amount ? money.format(line.credit_amount) : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Sticky Total Summary Bar */}
                <div className={styles.summaryBar}>
                  <span>Selected: <strong>{selectedCount}</strong> rows</span>
                  <div className="flex items-center gap-8">
                    <span>Total Debit: <strong className="text-primary font-semibold">{money.format(totalSelectedDebit)}</strong></span>
                    <span>Total Credit: <strong className="text-emerald-650 font-semibold">{money.format(totalSelectedCredit)}</strong></span>
                  </div>
                </div>
              </div>
            )}

            {/* Pagination block */}
            <div className="flex items-center justify-between border-t border-slate-100 mt-6 pt-6 text-sm font-medium text-slate-500 font-inter">
              <button
                onClick={() => { setPage(Math.max(0, page - 1)); setSelectedIndices({}) }}
                disabled={page === 0 || loading}
                className="inline-flex items-center gap-1.5 px-4 h-9 border border-slate-200 rounded-full hover:border-primary hover:text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:text-slate-500 bg-white"
              >
                <CaretLeft size={16} />
                Previous
              </button>

              <span>
                Page <strong className="text-slate-800 font-semibold">{page + 1}</strong>
              </span>

              <button
                onClick={() => { setPage(page + 1); setSelectedIndices({}) }}
                disabled={!hasMore || loading}
                className="inline-flex items-center gap-1.5 px-4 h-9 border border-slate-200 rounded-full hover:border-primary hover:text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:text-slate-500 bg-white"
              >
                Next
                <CaretRight size={16} />
              </button>
            </div>

          </section>

        </div>
      </main>

      {selectedVoucherId && (
        <div className={styles.drawerBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedVoucherId(null) }}>
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="voucher-detail-title">
            <div className={styles.drawerHeader}>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accounting Voucher</span>
                <h2 id="voucher-detail-title">
                  {voucherDetail?.voucher.voucher_type ?? 'Voucher'}
                  {voucherDetail?.voucher.voucher_number ? ` No. ${voucherDetail.voucher.voucher_number}` : ''}
                </h2>
                <span>{voucherDetail?.voucher.voucher_date ? displayDate(voucherDetail.voucher.voucher_date) : 'Loading voucher…'}</span>
              </div>
              <button type="button" aria-label="Close voucher details" onClick={() => setSelectedVoucherId(null)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
                <X size={20} />
              </button>
            </div>

            {!voucherDetail && !voucherError ? (
              <div className={styles.drawerNotice}><SpinnerGap size={20} className="animate-spin mx-auto mb-2" />Loading voucher details…</div>
            ) : voucherError ? (
              <div className={styles.drawerNotice}>{voucherError}</div>
            ) : voucherDetail ? (
              <>
                <div className={styles.drawerStats}>
                  <div className={styles.metric}>
                    <span>{voucherDetail.voucher.voucher_type?.toLowerCase() === 'purchase' ? 'Supplier Invoice No.' : 'Reference'}</span>
                    <strong>{voucherDetail.voucher.reference || '—'}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Party A/c Name</span>
                    <strong>{voucherDetail.voucher.party_ledger_name || '—'}</strong>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Particulars</span>
                    <span>Amount</span>
                  </div>
                  <div className={styles.drawerLines}>
                    {voucherDetail.entries.length ? voucherDetail.entries.map((entry) => (
                      <div key={entry.id} className={styles.drawerLine}>
                        <div><strong>{entry.ledger_name}</strong></div>
                        <div><strong>{voucherMoney.format(entry.display_amount)}</strong></div>
                      </div>
                    )) : <div className={styles.drawerNotice}>No ledger entries found.</div>}
                  </div>
                </div>
                <div className={styles.drawerFooter}>
                  <span>Total</span>
                  <strong>{voucherMoney.format(voucherDetail.totalAmount)}</strong>
                </div>
                {voucherDetail.voucher.narration && (
                  <div className="border-t border-slate-200 pt-4">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Narration</span>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{voucherDetail.voucher.narration}</p>
                  </div>
                )}
              </>
            ) : null}
          </aside>
        </div>
      )}

      <Footer />
    </div>
  )
}
