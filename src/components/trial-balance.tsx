'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, Scales, SpinnerGap } from '@phosphor-icons/react'
import type { LedgerMonthlyData, TrialBalanceData } from '@/lib/types'
import Header from '@/components/ui/Header'
import Footer from '@/components/ui/Footer'
import styles from './trial-balance.module.css'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const formatBalance = (value: number) => value === 0 ? '—' : `${money.format(Math.abs(value))} ${value < 0 ? 'Dr' : 'Cr'}`
const query = (values: Record<string, string | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value)
  return params.toString()
}

function PeriodForm({ action, orgId, companyId, ledgerId, from, to }: { action: string; orgId: string; companyId: string; ledgerId?: string; from: string; to: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const applyPeriod = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => router.push(`${action}?${query({ org: orgId, company: companyId, ledger: ledgerId, from: String(formData.get('from') ?? ''), to: String(formData.get('to') ?? '') })}`))
  }
  return <form className={styles.periodForm} action={action} onSubmit={applyPeriod}>
    <input type="hidden" name="org" value={orgId} /><input type="hidden" name="company" value={companyId} />{ledgerId && <input type="hidden" name="ledger" value={ledgerId} />}
    <label>From<input type="date" name="from" defaultValue={from} disabled={isPending} /></label>
    <label>To<input type="date" name="to" defaultValue={to} disabled={isPending} /></label>
    <button type="submit" disabled={isPending}>{isPending ? 'Applying…' : 'Apply'}</button>
  </form>
}

export function TrialBalance({ orgId, companyId, companyName, orgName, data, from, to }: { orgId: string; companyId: string; companyName: string; orgName: string; data: TrialBalanceData | null; from: string; to: string }) {
  const [navigating, setNavigating] = useState(false)
  return <div className="min-h-screen bg-background flex flex-col justify-between font-inter"><Header /><main className="flex-grow"><div className={styles.shell}>
    <button className={styles.backButton} disabled={navigating} onClick={() => { setNavigating(true); window.location.assign(`/dashboard/overview?${query({ org: orgId, company: companyId, from, to })}`) }}>
      {navigating ? <SpinnerGap className={styles.spin} size={15} /> : <ArrowLeft size={15} />} Back to Overview
    </button>
    <header className={styles.header}><div><span className={styles.eyebrow}>Trial Balance</span><h1>{companyName}</h1><p>{orgName} · Opening balance and movement for the selected period</p></div><PeriodForm action="/dashboard/trial-balance" orgId={orgId} companyId={companyId} from={from} to={to} /></header>
    {data?.sync.error && <div className={styles.warning}>Sync error: {data.sync.error}</div>}
    {!data ? <State text="Could not load Trial Balance. Please try again." error /> : data.groups.length === 0 ? <State text="No ledgers found for this company and period." /> : <section className={styles.tableWrap}>
      <div className={styles.tableHead}><span>Ledger / Group</span><span>Opening</span><span>Debit</span><span>Credit</span><span>Closing</span></div>
      {data.groups.map((group) => <div key={group.name}>
        <div className={styles.groupRow}><strong>{group.name}</strong><strong>{formatBalance(group.openingBalance)}</strong><strong>{group.debitTotal ? money.format(group.debitTotal) : '—'}</strong><strong>{group.creditTotal ? money.format(group.creditTotal) : '—'}</strong><strong>{formatBalance(group.closingBalance)}</strong></div>
        {group.ledgers.map((ledger) => <button className={styles.ledgerRow} key={ledger.ledgerId} onClick={() => window.location.assign(`/dashboard/trial-balance/ledger?${query({ org: orgId, company: companyId, ledger: ledger.ledgerId, from, to })}`)}><span>{ledger.ledgerName}</span><span>{formatBalance(ledger.openingBalance)}</span><span>{ledger.debitTotal ? money.format(ledger.debitTotal) : '—'}</span><span>{ledger.creditTotal ? money.format(ledger.creditTotal) : '—'}</span><span>{formatBalance(ledger.closingBalance)}</span></button>)}
      </div>)}
      <div className={styles.totalRow}><strong>Grand Total</strong><strong>{formatBalance(data.totalOpening)}</strong><strong>{money.format(data.totalDebit)}</strong><strong>{money.format(data.totalCredit)}</strong><strong>{formatBalance(data.totalClosing)}</strong></div>
    </section>}
  </div></main><Footer /></div>
}

export function LedgerMonthly({ orgId, companyId, data, from, to }: { orgId: string; companyId: string; data: LedgerMonthlyData | null; from: string; to: string }) {
  if (!data) return <div className="min-h-screen bg-background flex flex-col justify-between font-inter"><Header /><main className="flex-grow"><div className={styles.shell}><State text="Ledger not found in the selected company." error /></div></main><Footer /></div>
  const chartData = data.months.map((month) => ({ ...month, label: new Date(`${month.period}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), credit: -month.credit }))
  return <div className="min-h-screen bg-background flex flex-col justify-between font-inter"><Header /><main className="flex-grow"><div className={styles.shell}>
    <a className={styles.backButton} href={`/dashboard/trial-balance?${query({ org: orgId, company: companyId, from, to })}`}><ArrowLeft size={15} /> Back to Trial Balance</a>
    <header className={styles.header}><div><span className={styles.eyebrow}>Ledger drilldown</span><h1>{data.ledgerName}</h1><p>{data.parentName} · {from || 'All time'} — {to || 'Today'}</p></div><PeriodForm action="/dashboard/trial-balance/ledger" orgId={orgId} companyId={companyId} ledgerId={data.ledgerId} from={from} to={to} /></header>
    <section className={styles.tableWrap}>{data.months.length === 0 ? <div className={styles.state}>No voucher activity for this ledger in the selected period.</div> : <><div className={styles.monthHead}><span>Month</span><span>Debit</span><span>Credit</span><span>Closing Balance</span></div>{data.months.map((month) => <div className={styles.monthRow} key={month.period}><span>{new Date(`${month.period}T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span><span>{month.debit ? money.format(month.debit) : '—'}</span><span>{month.credit ? money.format(month.credit) : '—'}</span><span>{formatBalance(month.closingBalance)}</span></div>)}<div className={styles.monthTotalRow}><strong>Grand Total</strong><strong>{money.format(data.totalDebit)}</strong><strong>{money.format(data.totalCredit)}</strong><strong>{formatBalance(data.months.at(-1)?.closingBalance ?? 0)}</strong></div></>}</section>
    <section className={styles.chartPanel}><div className={styles.panelTitle}><Scales size={19} /> Monthwise movement</div><div className={styles.chart}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid vertical={false} stroke="var(--rule)" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={(value) => money.format(Math.abs(Number(value)))} /><Tooltip formatter={(value, name) => [money.format(Math.abs(Number(value))), name === 'credit' ? 'Credit' : 'Debit']} /><Bar dataKey="debit" fill="var(--accent)" radius={[4, 4, 0, 0]} /><Bar dataKey="credit" fill="var(--positive)" radius={[0, 0, 4, 4]} /></BarChart></ResponsiveContainer></div><div className={styles.legend}><span><i className={styles.debitDot} />Debit</span><span><i className={styles.creditDot} />Credit</span></div></section>
  </div></main><Footer /></div>
}

function State({ text, error = false }: { text: string; error?: boolean }) { return <div className={`${styles.state} ${error ? styles.error : ''}`}>{text}</div> }
