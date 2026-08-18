'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@astryxdesign/core/Button'
import { ArrowUpRight, ArrowsClockwise, CaretDown, ChartLineUp, MagnifyingGlass, Receipt, TrendUp, TrendDown, Scales, X, Buildings, ArrowsLeftRight, ChartBar, Clock, Notebook } from '@phosphor-icons/react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Company, DashboardData, Organization } from '@/lib/types'
import Header from '@/components/ui/Header'
import Footer from '@/components/ui/Footer'
import styles from './dashboard.module.css'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 })

function withContext(org: string | null, company: string | null, from = '', to = '') {
  const params = new URLSearchParams()
  if (org) params.set('org', org)
  if (company) params.set('company', company)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return `/dashboard/overview?${params.toString()}`
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
  icon?: React.ComponentType<any>
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
  from,
  to
}: {
  organizations: Organization[]
  companies: Company[]
  selectedOrganizationId: string | null
  selectedCompanyId: string | null
  data: DashboardData | null
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
  
  const filteredLedgers = useMemo(() => {
    return data?.ledgers.filter((ledger) => {
      const matchesLedger = ledger.name.toLowerCase().includes(ledgerSearch.toLowerCase())
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
                  <div className={styles.panelHeader}>
                    <div>
                      <span className={styles.eyebrow}>Composition</span>
                      <div className="flex items-center gap-2 mt-1">
                        <ChartBar size={20} className="text-slate-900 flex-shrink-0" />
                        <h2>Voucher types</h2>
                      </div>
                    </div>
                  </div>
                  {data?.voucherTypes.length ? (
                    <div className={styles.barChart}>
                      <ResponsiveContainer width="100%" height="100%"><BarChart data={data.voucherTypes} layout="vertical" margin={{ left: 0, right: 8 }}><XAxis type="number" hide /><YAxis type="category" dataKey="type" width={78} tickLine={false} axisLine={false} tick={{ fill: 'var(--foreground)', fontSize: 11 }} /><Tooltip cursor={{ fill: 'var(--accent-soft)' }} contentStyle={{ border: '1px solid var(--rule)', borderRadius: 10, background: 'var(--paper)' }} /><Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={16} /></BarChart></ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyPanel title="No voucher mix" detail="Voucher type analysis will appear after synchronization." />
                  )}
                </article>
              </section>

              <section className={styles.gridLower}>
                <article className={`${styles.panel} ${styles.recent}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <span className={styles.eyebrow}>Latest entries</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock size={20} className="text-slate-900 flex-shrink-0" />
                        <h2>Recent vouchers</h2>
                      </div>
                    </div>
                  </div>
                  {data?.recentVouchers.length ? (
                    <div className={styles.voucherTable}>
                      <div className={styles.voucherTableHead}>
                        <span>Date</span>
                        <span>Voucher</span>
                        <span>Party</span>
                        <span>Amount</span>
                      </div>
                      <div className={styles.voucherList}>
                        {data.recentVouchers.map((voucher) => (
                          <div className={styles.voucher} key={voucher.id}>
                            <div className={styles.voucherDate}>
                              {new Date(voucher.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </div>
                            <div className={styles.voucherType}>
                              <strong>{voucher.type} {voucher.number ? `· ${voucher.number}` : ''}</strong>
                            </div>
                            <div className={styles.voucherParty}>
                              <span>{voucher.party || voucher.type}</span>
                            </div>
                            <div className={styles.voucherAmountCol}>
                              <strong className={styles.voucherAmount}>{money.format(voucher.amount)}</strong>
                              <ArrowUpRight size={17} className={styles.mutedIcon} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyPanel title="No recent vouchers" detail="There are no included vouchers for this selection." />
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
                      {data ? `${data.ledgers.length} ledgers` : '0 ledgers'}
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
