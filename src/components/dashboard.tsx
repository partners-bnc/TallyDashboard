'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@astryxdesign/core/Button'
import { ArrowUpRight, ArrowsClockwise, CaretDown, ChartLineUp, MagnifyingGlass, Receipt, TrendUp, TrendDown, Scales, X, Buildings, ArrowsLeftRight, ChartBar, Clock, Notebook, ShieldCheck, User } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Company, DashboardData, Organization, TdsReportData } from '@/lib/types'
import type { PromotersReportData, GstReportData } from '@/lib/data'
import Header from '@/components/ui/Header'
import Footer from '@/components/ui/Footer'
import styles from './dashboard.module.css'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const tdsMoney = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 })

function withContext(org: string | null, company: string | null, from = '', to = '') {
  const params = new URLSearchParams()
  if (org) params.set('org', org)
  if (company) params.set('company', company)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return `/dashboard/overview?${params.toString()}`
}

function tdsReportHref(org: string | null, company: string | null, ledger: string, from: string, to: string) {
  const params = new URLSearchParams()
  if (org) params.set('org', org)
  if (company) params.set('company', company)
  params.set('ledger', ledger)
  params.set('lockLedger', 'true')
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return `/dashboard/reports/tds-report?${params.toString()}`
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
  icon?: Icon
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

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={styles.empty}>
      <ChartLineUp className="text-slate-900" size={24} weight="light" />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  )
}

export function Dashboard({
  organizations,
  companies,
  selectedOrganizationId,
  selectedCompanyId,
  data,
  tdsData,
  promoterData,
  gstData,
  from,
  to
}: {
  organizations: Organization[]
  companies: Company[]
  selectedOrganizationId: string | null
  selectedCompanyId: string | null
  data: DashboardData | null
  tdsData: TdsReportData | null
  promoterData: PromotersReportData | null
  gstData: GstReportData | null
  from: string
  to: string
}) {
  const router = useRouter()
  const [isApplyingPeriod, startPeriodTransition] = useTransition()
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [groupSearch, setGroupSearch] = useState('')
  const [dateOpen, setDateOpen] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const selectedOrg = organizations.find((org) => org.id === selectedOrganizationId)
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId)
  const totalTdsOutstanding = tdsData?.ledgerPositions.reduce((sum, position) => sum + position.outstanding, 0) ?? 0
  
  const filteredLedgers = useMemo(() => {
    return data?.ledgers.filter((ledger) => {
      const qLedger = ledgerSearch.toLowerCase()
      const matchesLedger = ledger.name.toLowerCase().includes(qLedger) || ledger.id.toLowerCase().includes(qLedger)
      const matchesGroup = (ledger.parent_name ?? '').toLowerCase().includes(groupSearch.toLowerCase())
      return matchesLedger && matchesGroup
    }) ?? []
  }, [data?.ledgers, ledgerSearch, groupSearch])

  const applyPeriod = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const nextFrom = String(formData.get('from') ?? '')
    const nextTo = String(formData.get('to') ?? '')
    setDateOpen(false)
    startPeriodTransition(() => router.push(withContext(selectedOrganizationId, selectedCompanyId, nextFrom, nextTo)))
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between font-inter">
      <Header />
      <main className="flex-grow">
        <div className={styles.shell}>
          
          {!selectedCompanyId ? (
            <section className={styles.emptyContext}>
              <div className={styles.emptyContextRule} />
              <span className={styles.eyebrow}>Awaiting context</span>
              <h1>Your numbers, in their proper context.</h1>
              <p>Select an organization, then choose one company. TallyOne Ai will keep every view scoped to that choice.</p>
              <div className={styles.steps}>
                <span><b>01</b> Organization</span>
                <span><b>02</b> Company</span>
                <span><b>03</b> Executive view</span>
              </div>
            </section>
          ) : (
            <>
              {/* Single Merged Header Container */}
              <section className={styles.dashboardHeader}>
                <div className={styles.headerInfo}>
                  <div className="flex items-start gap-3">
                    <div className={styles.companyIconBox}>
                      <Buildings size={20} weight="light" />
                    </div>
                    <div className="min-w-0">
                      <h1 className={styles.companyTitle}>{selectedCompany?.name}</h1>
                      <span className={styles.orgSubtitle}>{selectedOrg?.name} · Read-only workspace</span>
                    </div>
                  </div>
                </div>
                
                <div className={styles.headerControlsColumn}>
                  {/* Status row in the right side */}
                  <div className={styles.statusRow}>
                    <span>Executive overview</span>
                    <span className="text-slate-355">•</span>
                    <div className={styles.syncBadgeCompact}>
                      <span className={data?.sync.status === 'error' ? styles.dotError : styles.dot} />
                      <span>
                        {data?.sync.status === 'error' 
                          ? 'Sync error' 
                          : data?.sync.lastSyncedAt 
                            ? `Synced ${new Date(data.sync.lastSyncedAt).toLocaleDateString('en-IN')}` 
                            : 'Not synced'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.selectsWrapperCompact}>
                    <div className={`${styles.selectsCompact} ${isTransitioning ? styles.loadingSelects : ''}`}>
                      <div className={styles.selectField}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pr-1">Org</span>
                        <select 
                          value={selectedOrganizationId ?? ''} 
                          disabled={isTransitioning}
                          onChange={(e) => { 
                            setIsTransitioning(true); 
                            window.location.assign(withContext(e.target.value || null, null)) 
                          }}
                        >
                          {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                        </select>
                      </div>
                      <div className={styles.selectField}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pr-1">Company</span>
                        <select 
                          value={selectedCompanyId ?? ''} 
                          disabled={isTransitioning} 
                          onChange={(e) => {
                            setIsTransitioning(true);
                            window.location.assign(withContext(selectedOrganizationId, e.target.value || null));
                          }}
                        >
                          {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                        </select>
                      </div>
                    </div>
                    {isTransitioning && (
                      <div className={styles.selectSpinnerCompact}>
                        <ArrowsClockwise className={styles.spin} size={13} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {selectedCompanyId && (
                      <>
                        <button
                          type="button"
                          className={styles.trialBalanceButton}
                          disabled={isTransitioning}
                          onClick={() => {
                            setIsTransitioning(true)
                            const params = new URLSearchParams({ org: selectedOrganizationId ?? '', company: selectedCompanyId })
                            if (from) params.set('from', from)
                            if (to) params.set('to', to)
                            window.location.assign(`/dashboard/trial-balance?${params.toString()}`)
                          }}
                        >
                          Trial Balance
                        </button>
                        <button
                          type="button"
                          className={styles.trialBalanceButton}
                          disabled={isTransitioning}
                          onClick={() => {
                            setIsTransitioning(true)
                            const params = new URLSearchParams({ org: selectedOrganizationId ?? '', company: selectedCompanyId })
                            if (from) params.set('from', from)
                            if (to) params.set('to', to)
                            window.location.assign(`/dashboard/reports/tds-report?${params.toString()}`)
                          }}
                        >
                          TDS Report
                        </button>
                        <button
                          type="button"
                          className={styles.trialBalanceButton}
                          disabled={isTransitioning}
                          onClick={() => {
                            setIsTransitioning(true)
                            const params = new URLSearchParams({ org: selectedOrganizationId ?? '', company: selectedCompanyId })
                            if (from) params.set('from', from)
                            if (to) params.set('to', to)
                            window.location.assign(`/dashboard/funds-flow?${params.toString()}`)
                          }}
                        >
                          Funds Flow
                        </button>
                      </>
                    )}
                    <div className={styles.dateControl}>
                      <button onClick={() => setDateOpen(!dateOpen)} className={styles.dateButton} aria-expanded={dateOpen} disabled={isTransitioning}>
                        Period <span>{from || to ? `${from || 'Start'} — ${to || 'Today'}` : 'All time'}</span>
                        <CaretDown size={14} />
                      </button>
                      {dateOpen && (
                        <form className={styles.datePopover} action="/dashboard/overview" onSubmit={applyPeriod}>
                          <input type="hidden" name="org" value={selectedOrganizationId ?? ''} />
                          <input type="hidden" name="company" value={selectedCompanyId} />
                          <label>From<input name="from" type="date" defaultValue={from} /></label>
                          <label>To<input name="to" type="date" defaultValue={to} /></label>
                          <Button label={isApplyingPeriod ? 'Applying…' : 'Apply period'} type="submit" isDisabled={isApplyingPeriod} />
                        </form>
                      )}
                    </div>
                    {(from || to) && (
                      <button 
                        onClick={() => {
                          setIsTransitioning(true);
                          window.location.assign(withContext(selectedOrganizationId, selectedCompanyId, '', ''));
                        }} 
                        disabled={isTransitioning}
                        className={styles.resetPeriodButton}
                        title="Reset period to all-time"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {data?.sync.error && (
                <div className={styles.warning} role="status">
                  <ArrowsClockwise size={18} />
                  {data.sync.error}
                </div>
              )}

              {data?.history.message && (<div className={styles.warning} role="status"><Clock size={18} />{data.history.message}</div>)}
              <section className={styles.metrics}>
                {data?.history.isAvailable ? (
                  <>
                    <Metric label="Voucher activity" value={compact.format(data.kpis.totalVouchers)} icon={Receipt} />
                    <Metric label="Debit movement" value={money.format(data.kpis.debit)} tone={styles.debit} icon={TrendUp} />
                    <Metric label="Credit movement" value={money.format(data.kpis.credit)} tone={styles.credit} icon={TrendDown} />
                    <Metric label="Net movement" value={money.format(data.kpis.netMovement)} tone={styles.net} icon={Scales} />
                    <Metric label="TDS Outstanding" value={tdsMoney.format(totalTdsOutstanding)} tone={totalTdsOutstanding > 0 ? styles.debit : ''} icon={ShieldCheck} />
                  </>
                ) : (
                  <EmptyPanel title="No overview yet" detail="Select a company with available accounting data." />
                )}
              </section>

              <section className={styles.grid}>
                <article className={`${styles.panel} ${styles.activity}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <span className={styles.eyebrow}>Movement</span>
                      <div className="flex items-center gap-2 mt-1">
                        <ArrowsLeftRight size={20} className="text-slate-900 flex-shrink-0" />
                        <h2>Debit vs credit</h2>
                      </div>
                    </div>
                  </div>
                  {data?.activity.length ? (
                    <>
                      <div className={styles.chart}>
                        <ResponsiveContainer width="100%" height="100%"><AreaChart data={data.activity}><defs><linearGradient id="debitFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--accent)" stopOpacity={.2}/><stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--rule)" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(v) => compact.format(v)} /><Tooltip formatter={(value) => money.format(Number(value))} contentStyle={{ border: '1px solid var(--rule)', borderRadius: 10, background: 'var(--paper)' }} /><Area type="monotone" dataKey="debit" name="Debit" stroke="var(--accent)" fill="url(#debitFill)" strokeWidth={2} /><Area type="monotone" dataKey="credit" name="Credit" stroke="var(--positive)" fill="none" strokeWidth={2} /></AreaChart></ResponsiveContainer>
                      </div>
                      <div className={styles.legend}>
                        <span><i className={styles.legendDebit} />Debit</span>
                        <span><i className={styles.legendCredit} />Credit</span>
                      </div>
                    </>
                  ) : (
                    <EmptyPanel title="No movement in this period" detail="Try a wider date range or confirm that the company has synchronized vouchers." />
                  )}
                </article>

                <article className={`${styles.panel} ${styles.types}`}>
                  <div className={styles.panelHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                    <div>
                      <span className={styles.eyebrow}>Composition</span>
                      <div className="flex items-center gap-2 mt-1">
                        <User size={20} className="text-slate-900 flex-shrink-0" />
                        <h2>Promoters Summary</h2>
                      </div>
                    </div>
                    {selectedCompanyId && (
                      <Link
                        href={`/dashboard/reports/promoters-report?org=${selectedOrganizationId ?? ''}&company=${selectedCompanyId ?? ''}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/40 rounded-lg transition-colors border border-amber-100 dark:border-amber-900/50 cursor-pointer"
                        style={{ alignSelf: 'center' }}
                      >
                        <ArrowUpRight size={12} weight="bold" />
                        Audit
                      </Link>
                    )}
                  </div>
                  {promoterData && promoterData.ledgers.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {/* Summary Metrics */}
                      <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Funding</span>
                          <strong className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{money.format(promoterData.totalCapital)}</strong>
                        </div>
                        <div>
                          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Net Movement</span>
                          <strong className={`text-sm font-bold mt-0.5 block ${promoterData.netMovement >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {promoterData.netMovement >= 0 ? '+' : ''}{money.format(promoterData.netMovement)}
                          </strong>
                        </div>
                      </div>
                      
                      {/* Small Ledgers List */}
                      <div className="overflow-y-auto max-h-[200px] pr-1 space-y-1.5">
                        {promoterData.ledgers.map((l) => (
                          <div key={l.ledgerId} className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-800 pb-1.5">
                            <span className="truncate pr-2 font-medium text-slate-600 dark:text-slate-400">{l.ledgerName}</span>
                            <strong className="text-slate-800 dark:text-slate-200 flex-shrink-0">{money.format(l.closingBalance)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyPanel title="No promoters data" detail="Promoters & Unsecured Loans summary will appear after mapping." />
                  )}
                </article>
              </section>

              <section className={styles.gridLower}>
                <article className={`${styles.panel} ${styles.recent}`}>
                  <div className={styles.panelHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                    <div>
                      <span className={styles.eyebrow}>Books at 31 Mar 2027</span>
                      <div className="flex items-center gap-2 mt-1">
                        <ShieldCheck size={20} className="text-slate-900 flex-shrink-0" />
                        <h2>TDS compliances</h2>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/reports/tds-report?org=${selectedOrganizationId ?? ''}&company=${selectedCompanyId ?? ''}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}&ledger=all`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/40 rounded-lg transition-colors border border-blue-100 dark:border-blue-900/50 cursor-pointer"
                      style={{ alignSelf: 'center' }}
                    >
                      <ArrowUpRight size={14} weight="bold" />
                      View All
                    </Link>
                  </div>
                  {tdsData ? (
                    <div className={styles.tdsTable}>
                      <div className={styles.tdsTableHead}>
                        <span>Ledgers</span>
                        <span>Outstanding</span>
                        <span>Percentage of outstanding</span>
                        <span>View</span>
                      </div>
                      <div className={styles.tdsList}>
                        {tdsData.ledgerPositions.length ? tdsData.ledgerPositions.map((position) => (
                          <div className={styles.tdsRow} key={position.ledgerId}>
                            <strong className={styles.tdsLedger}>{position.ledgerName}</strong>
                            <strong className={styles.tdsOutstanding}>{tdsMoney.format(position.outstanding)}</strong>
                            <span className={styles.tdsPercentage}>{totalTdsOutstanding > 0 ? `${((position.outstanding / totalTdsOutstanding) * 100).toFixed(1)}%` : '0.0%'}</span>
                            <Link
                              href={tdsReportHref(selectedOrganizationId, selectedCompanyId, position.ledgerId, from, to)}
                              className={styles.tdsView}
                              aria-label={`View ${position.ledgerName} in the TDS report`}
                            >
                              <ArrowUpRight size={17} aria-hidden="true" />
                            </Link>
                          </div>
                        )) : <span className={styles.tdsEmpty}>No mapped TDS ledgers</span>}
                      </div>
                      <div className={styles.tdsTotal}>
                        <span>Total outstanding due</span>
                        <strong>{tdsMoney.format(totalTdsOutstanding)}</strong>
                      </div>
                    </div>
                  ) : (
                    <EmptyPanel title="No TDS positions" detail="No mapped TDS ledger positions are available through 31 March 2027." />
                  )}
                </article>

                <article className={`${styles.panel} ${styles.freshness}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <span className={styles.eyebrow}>Data stewardship</span>
                      <div className="flex items-center gap-2 mt-1">
                        <ArrowsClockwise size={20} className="text-slate-900 flex-shrink-0" />
                        <h2>Sync freshness</h2>
                      </div>
                    </div>
                  </div>
                  <div className={styles.freshnessBody}>
                    <div className={data?.sync.status === 'error' ? styles.freshnessIconError : styles.freshnessIcon}>
                      <ArrowsClockwise size={26} />
                    </div>
                    <strong>{data?.sync.status === 'error' ? 'Review sync status' : data?.sync.lastSyncedAt ? 'Data is available' : 'Awaiting first sync'}</strong>
                    <p>{data?.sync.lastSyncedAt ? `Last voucher sync ${new Date(data.sync.lastSyncedAt).toLocaleString('en-IN')}.` : 'This company has not reported a successful voucher sync yet.'}</p>
                  </div>
                </article>
              </section>

              <section className={styles.gridLower} style={{ marginTop: 24 }}>
                <article className={styles.panel} style={{ gridColumn: 'span 2' }}>
                  <div className={styles.panelHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                    <div>
                      <span className={styles.eyebrow}>Tax Compliance</span>
                      <div className="flex items-center gap-2 mt-1">
                        <ShieldCheck size={20} className="text-slate-900 flex-shrink-0" />
                        <h2>Duties & Taxes (GST)</h2>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/reports/duties-and-taxes?org=${selectedOrganizationId ?? ''}&company=${selectedCompanyId ?? ''}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 rounded-lg transition-colors border border-indigo-100 dark:border-indigo-900/50 cursor-pointer"
                      style={{ alignSelf: 'center' }}
                    >
                      <ArrowUpRight size={14} weight="bold" />
                      View Audit
                    </Link>
                  </div>
                  {gstData && gstData.ledgers.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 16 }}>
                      {/* Left: Summary Metrics & Mini Classification Table */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                          <div style={{ background: 'var(--bg-sidebar, #f8fafc)', border: '1px solid var(--rule, #e2e8f0)', borderRadius: 12, padding: 12 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase' }}>Input GST (ITC)</span>
                            <strong style={{ display: 'block', fontSize: 16, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>{money.format(gstData.totalInput)}</strong>
                          </div>
                          <div style={{ background: 'var(--bg-sidebar, #f8fafc)', border: '1px solid var(--rule, #e2e8f0)', borderRadius: 12, padding: 12 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase' }}>Output GST</span>
                            <strong style={{ display: 'block', fontSize: 16, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>{money.format(gstData.totalOutput)}</strong>
                          </div>
                          <div style={{ background: 'var(--bg-sidebar, #f8fafc)', border: '1px solid var(--rule, #e2e8f0)', borderRadius: 12, padding: 12 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase' }}>Net Position</span>
                            <strong style={{ display: 'block', fontSize: 16, fontWeight: 800, color: gstData.netPosition >= 0 ? '#16a34a' : '#ef4444', marginTop: 4 }}>
                              {money.format(Math.abs(gstData.netPosition))}
                            </strong>
                            <span style={{ fontSize: 8, fontWeight: 600, color: gstData.netPosition >= 0 ? '#15803d' : '#b45309' }}>
                              {gstData.netPosition >= 0 ? 'Refundable' : 'Payable'}
                            </span>
                          </div>
                        </div>

                        {/* Miniature Classification Table */}
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--rule, #e2e8f0)', textAlign: 'left', color: 'var(--muted, #64748b)' }}>
                                <th style={{ padding: '6px 4px' }}>Tax Type</th>
                                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Input</th>
                                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Output</th>
                                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Net</th>
                              </tr>
                            </thead>
                            <tbody>
                              {gstData.taxTypes.slice(0, 3).map((t) => (
                                <tr key={t.type} style={{ borderBottom: '1px solid var(--rule, #f1f5f9)', color: 'var(--foreground, #334155)' }}>
                                  <td style={{ padding: '6px 4px', fontWeight: 600 }}>{t.type}</td>
                                  <td style={{ padding: '6px 4px', textAlign: 'right', color: '#16a34a' }}>{money.format(t.input)}</td>
                                  <td style={{ padding: '6px 4px', textAlign: 'right', color: '#ef4444' }}>{money.format(t.output)}</td>
                                  <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700, color: t.net >= 0 ? '#16a34a' : '#ef4444' }}>
                                    {money.format(Math.abs(t.net))} {t.net >= 0 ? 'Dr' : 'Cr'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Right: Small Bar Chart */}
                      <div style={{ height: 180 }}>
                        {gstData.monthlyTrends.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={gstData.monthlyTrends} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                              <CartesianGrid vertical={false} stroke="var(--rule, #f1f5f9)" />
                              <XAxis dataKey="month" tickLine={false} axisLine={false} style={{ fontSize: '10px', fill: 'var(--muted, #64748b)' }} />
                              <YAxis tickLine={false} axisLine={false} style={{ fontSize: '10px', fill: 'var(--muted, #64748b)' }} tickFormatter={(v) => compact.format(v)} />
                              <Tooltip formatter={(value) => money.format(Number(value))} />
                              <Bar name="Input" dataKey="input" fill="#10b981" radius={[3, 3, 0, 0]} />
                              <Bar name="Output" dataKey="output" fill="var(--accent, #6366f1)" radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted, #64748b)', fontSize: 12 }}>
                            No monthly transaction data available.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <EmptyPanel title="No Duties & Taxes mapped" detail="GST summary & trends will appear after mapping GST groups." />
                  )}
                </article>
              </section>

              <section className={`${styles.panel} ${styles.ledgerPanel}`}>
                <div className={styles.ledgerPanelHeader}>
                  <div>
                    <span className={styles.eyebrow}>Chart of accounts</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Notebook size={20} className="text-slate-900 flex-shrink-0" />
                      <h2>Find a ledger</h2>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 justify-end">
                    <span className={styles.ledgerCount}>
                      {data ? `${filteredLedgers.length} ledgers ${filteredLedgers.length !== data.ledgers.length ? '(filtered)' : ''}` : '0 ledgers'}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className={`${styles.search} ${styles.searchSmall}`}>
                        <MagnifyingGlass size={18} />
                        <input value={ledgerSearch} onChange={(e) => setLedgerSearch(e.target.value)} placeholder="Search ledger" aria-label="Search ledger" />
                      </div>
                      <div className={`${styles.search} ${styles.searchSmall}`}>
                        <MagnifyingGlass size={18} />
                        <input value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} placeholder="Search group" aria-label="Search group" />
                      </div>
                    </div>
                  </div>
                </div>

                {filteredLedgers.length ? (
                  <div className={styles.ledgerTable}>
                    <div className={styles.tableHead}>
                      <span>ID</span>
                      <span>Name</span>
                      <span>Group</span>
                      <span className="justify-end pr-4">Opening</span>
                      <span className="justify-end pr-4">Closing</span>
                    </div>
                    {filteredLedgers.slice(0, 80).map((ledger) => (
                      <button
                        className={styles.ledgerRow}
                        key={ledger.id}
                        onClick={() => window.location.assign(`/dashboard/ledger?org=${selectedOrganizationId}&company=${selectedCompanyId}&ledger=${ledger.id}`)}
                      >
                        <span><small>{ledger.id.slice(0, 8)}</small></span>
                        <span><strong>{ledger.name}</strong></span>
                        <span>{ledger.parent_name || 'Unassigned'}</span>
                        <span className="justify-end pr-4">{money.format(Number(ledger.opening_balance ?? 0))}</span>
                        <span className="justify-end pr-4">{money.format(Number(ledger.closing_balance ?? 0))}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel title="No ledgers found" detail={(ledgerSearch || groupSearch) ? 'Try a different search term.' : 'Chart of accounts is empty for this company.'} />
                )}
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
