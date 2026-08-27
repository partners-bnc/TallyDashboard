'use client'

import { useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, Scales } from '@phosphor-icons/react'
import type { LedgerMonthlyData, TrialBalanceData } from '@/lib/types'
import Header from '@/components/ui/Header'
import Footer from '@/components/ui/Footer'
import { dashboardUrl } from '@/lib/dashboard-navigation'
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
    startTransition(() => router.replace(`${action}?${query({ org: orgId, company: companyId, ledger: ledgerId, from: String(formData.get('from') ?? ''), to: String(formData.get('to') ?? '') })}`))
  }
  return <form className={styles.periodForm} action={action} onSubmit={applyPeriod}>
    <input type="hidden" name="org" value={orgId} /><input type="hidden" name="company" value={companyId} />{ledgerId && <input type="hidden" name="ledger" value={ledgerId} />}
    <label>From<input type="date" name="from" defaultValue={from} disabled={isPending} /></label>
    <label>To<input type="date" name="to" defaultValue={to} disabled={isPending} /></label>
    <button type="submit" disabled={isPending}>{isPending ? 'Applying…' : 'Apply'}</button>
  </form>
}

function AsOfForm({ orgId, companyId, asOf }: { orgId: string; companyId: string; asOf: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const applyAsOf = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => router.replace(`/dashboard/trial-balance?${query({ org: orgId, company: companyId, to: String(formData.get('to') ?? '') })}`))
  }
  return <form className={styles.periodForm} action="/dashboard/trial-balance" onSubmit={applyAsOf}>
    <input type="hidden" name="org" value={orgId} /><input type="hidden" name="company" value={companyId} />
    <label>As of<input type="date" name="to" defaultValue={asOf} disabled={isPending} /></label>
    <button type="submit" disabled={isPending}>{isPending ? 'Applying…' : 'Apply'}</button>
  </form>
}

export function TrialBalance({ orgId, companyId, companyName, orgName, data, asOf }: { orgId: string; companyId: string; companyName: string; orgName: string; data: TrialBalanceData | null; asOf: string }) {
  const router = useRouter()
  return <div className="min-h-screen bg-background flex flex-col justify-between font-inter"><Header /><main className="flex-grow"><div className={styles.shell}>
    <button className={styles.backButton} type="button" onClick={() => router.back()}><ArrowLeft size={15} /> Back to Overview</button>
    <header className={styles.header}><div><span className={styles.eyebrow}>Trial Balance</span><h1>{companyName}</h1><p>{orgName} · Closing balances as of {asOf || 'today'}</p></div><AsOfForm orgId={orgId} companyId={companyId} asOf={asOf} /></header>
    {data?.sync.error && <div className={styles.warning}>Sync error: {data.sync.error}</div>}
    {data?.history.message && <div className={styles.warning}>{data.history.message}</div>}
    {data?.authoritativeTotals && <div className={styles.warning}>Tally-verified grand total for {data.authoritativeTotals.asOfDate}: {money.format(data.authoritativeTotals.debit)} Dr / {money.format(data.authoritativeTotals.credit)} Cr. Ledger rows and drilldowns remain calculated from imported vouchers.</div>}`r`n    {data?.verification && <section className={styles.warning} aria-label="Tally verification">
      <strong>Tally verification · {data.verification.asOfDate}</strong><br />
      {data.verification.unmatchedCount === 0 ? 'Calculated balances match the uploaded Tally balances.' : `${data.verification.unmatchedCount} ledger differences · ${money.format(data.verification.differenceTotal)} absolute difference`}
      {data.verification.largestDifferences.length > 0 && <ul>{data.verification.largestDifferences.map((row) => <li key={row.ledgerName}>{row.ledgerName}: dashboard {formatBalance(row.calculatedBalance)}, Tally {formatBalance(row.tallyBalance)}, difference {formatBalance(row.difference)}</li>)}</ul>}
    </section>}
    {!data ? <State text="Could not load Trial Balance. Please try again." error /> : !data.history.isAvailable ? <State text={data.history.message ?? 'Verified history is not available for this date.'} error /> : data.groups.length === 0 ? <State text="No ledgers found for this company and period." /> : <section className={styles.tableWrap}>
      <div className={styles.tableHead}><span>Ledger / Group</span><span>Debit</span><span>Credit</span></div>
      {data.groups.map((group) => <div key={group.name}>
        <div className={styles.groupRow}><strong>{group.name}</strong><strong>{group.debitBalance ? money.format(group.debitBalance) : '—'}</strong><strong>{group.creditBalance ? money.format(group.creditBalance) : '—'}</strong></div>
        {group.ledgers.map((ledger) => <button className={styles.ledgerRow} key={ledger.ledgerId} onClick={() => router.push(dashboardUrl('/dashboard/trial-balance/ledger', { orgId, companyId, to: asOf }, { ledger: ledger.ledgerId }))}><span>{ledger.ledgerName}</span><span>{ledger.debitBalance ? money.format(ledger.debitBalance) : '—'}</span><span>{ledger.creditBalance ? money.format(ledger.creditBalance) : '—'}</span></button>)}
      </div>)}
      <div className={styles.totalRow}><strong>Grand Total</strong><strong>{money.format(data.totalDebit)}</strong><strong>{money.format(data.totalCredit)}</strong></div>
    </section>}
  </div></main><Footer /></div>
}

export function LedgerMonthly({ orgId, companyId, data, from, to }: { orgId: string; companyId: string; data: LedgerMonthlyData | null; from: string; to: string }) {
  const router = useRouter()
  if (!data) return <div className="min-h-screen bg-background flex flex-col justify-between font-inter"><Header /><main className="flex-grow"><div className={styles.shell}><State text="Ledger not found in the selected company." error /></div></main><Footer /></div>
  const chartData = data.months.map((month) => ({ ...month, label: new Date(`${month.period}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), credit: -month.credit }))
  return <div className="min-h-screen bg-background flex flex-col justify-between font-inter"><Header /><main className="flex-grow"><div className={styles.shell}>
    <button className={styles.backButton} type="button" onClick={() => router.back()}><ArrowLeft size={15} /> Back to Trial Balance</button>
    <header className={styles.header}><div><span className={styles.eyebrow}>Ledger drilldown</span><h1>{data.ledgerName}</h1><p>{data.parentName} · {from || 'All time'} — {to || 'Today'}</p></div><PeriodForm action="/dashboard/trial-balance/ledger" orgId={orgId} companyId={companyId} ledgerId={data.ledgerId} from={from} to={to} /></header>
    <section className={styles.tableWrap}>{data.months.length === 0 ? <div className={styles.state}>No voucher activity for this ledger in the selected period.</div> : <><div className={styles.monthHead}><span>Month</span><span>Debit</span><span>Credit</span><span>Closing Balance</span></div>{data.months.map((month) => <div className={styles.monthRow} key={month.period}><span>{new Date(`${month.period}T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span><span>{month.debit ? money.format(month.debit) : '—'}</span><span>{month.credit ? money.format(month.credit) : '—'}</span><span>{formatBalance(month.closingBalance)}</span></div>)}<div className={styles.monthTotalRow}><strong>Grand Total</strong><strong>{money.format(data.totalDebit)}</strong><strong>{money.format(data.totalCredit)}</strong><strong>{formatBalance(data.months.at(-1)?.closingBalance ?? 0)}</strong></div></>}</section>
    <section className={styles.chartPanel}><div className={styles.panelTitle}><Scales size={19} /> Monthwise movement</div><div className={styles.chart}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid vertical={false} stroke="var(--rule)" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={(value) => money.format(Math.abs(Number(value)))} /><Tooltip formatter={(value, name) => [money.format(Math.abs(Number(value))), name === 'credit' ? 'Credit' : 'Debit']} /><Bar dataKey="debit" fill="var(--accent)" radius={[4, 4, 0, 0]} /><Bar dataKey="credit" fill="var(--positive)" radius={[0, 0, 4, 4]} /></BarChart></ResponsiveContainer></div><div className={styles.legend}><span><i className={styles.debitDot} />Debit</span><span><i className={styles.creditDot} />Credit</span></div></section>
  </div></main><Footer /></div>
}

function State({ text, error = false }: { text: string; error?: boolean }) { return <div className={`${styles.state} ${error ? styles.error : ''}`}>{text}</div> }




