import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Company, DashboardData, Ledger, LedgerMonthlyData, Organization, TrialBalanceData, TrialBalanceLedgerRow, VoucherLine } from '@/lib/types'

const asNumber = (value: number | string | null | undefined) => Number(value ?? 0)

export function groupTrialBalanceRows(rows: Array<{ ledger_id: string; ledger_name: string; parent_name: string | null; closing_balance: number | string | null; debit_balance: number | string | null; credit_balance: number | string | null }>) {
  const groups = new Map<string, TrialBalanceLedgerRow[]>()
  for (const row of rows) {
    const ledger: TrialBalanceLedgerRow = { ledgerId: row.ledger_id, ledgerName: row.ledger_name, parentName: row.parent_name ?? 'Unassigned', closingBalance: asNumber(row.closing_balance), debitBalance: asNumber(row.debit_balance), creditBalance: asNumber(row.credit_balance) }
    if (ledger.debitBalance === 0 && ledger.creditBalance === 0) continue
    groups.set(ledger.parentName, [...(groups.get(ledger.parentName) ?? []), ledger])
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, ledgers]) => ({ name, ledgers: ledgers.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName)), debitBalance: ledgers.reduce((sum, row) => sum + row.debitBalance, 0), creditBalance: ledgers.reduce((sum, row) => sum + row.creditBalance, 0) }))
}

export async function listOrganizations(): Promise<Organization[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('tb_organizations').select('id,name,created_at').order('name')
  if (error) throw new Error(`Could not load organizations: ${error.message}`)
  return data ?? []
}

export async function listCompanies(orgId: string): Promise<Company[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('tb_companies').select('id,org_id,name,tally_company_guid,last_successful_sync_at,last_sync_status,last_sync_error,is_active,updated_at').eq('org_id', orgId).eq('is_active', true).order('name')
  if (error) throw new Error(`Could not load companies: ${error.message}`)
  return data ?? []
}

export async function getDashboardData(companyId: string, from?: string, to?: string): Promise<DashboardData> {
  const supabase = await createSupabaseServerClient()
  const [vouchersResult, linesResult, movementTotalsResult, monthlyMovementResult, voucherTypesResult, ledgersResult, syncResult, companyResult] = await Promise.all([
    supabase.from('tb_vouchers').select('id,company_id,voucher_date,voucher_type,voucher_number,party_ledger_name,narration,is_cancelled,is_deleted').eq('company_id', companyId).eq('is_cancelled', false).eq('is_deleted', false).gte('voucher_date', from ?? '1900-01-01').lte('voucher_date', to ?? '2999-12-31').order('voucher_date', { ascending: false }).limit(8),
    supabase.from('tb_ledger_voucher_lines').select('company_id,ledger_id,ledger_name,voucher_ledger_entry_id,line_number,voucher_id,voucher_date,voucher_type,voucher_number,particulars,debit_amount,credit_amount,running_balance').eq('company_id', companyId).gte('voucher_date', from ?? '1900-01-01').lte('voucher_date', to ?? '2999-12-31').order('voucher_date', { ascending: false }).limit(1000),
    supabase.rpc('tb_dashboard_movement_totals', { target_company: companyId, from_date: from ?? null, to_date: to ?? null }),
    supabase.rpc('tb_dashboard_monthly_movement', { target_company: companyId, from_date: from ?? null, to_date: to ?? null }),
    supabase.rpc('tb_dashboard_voucher_type_counts', { target_company: companyId, from_date: from ?? null, to_date: to ?? null }),
    supabase.from('tb_ledgers').select('id,org_id,company_id,name,parent_name,opening_balance,closing_balance,is_deleted').eq('company_id', companyId).eq('is_deleted', false).order('name').limit(1000),
    supabase.from('tb_company_sync_state').select('company_id,last_catalog_seen_at,last_ledger_sync_at,last_voucher_sync_at,last_error,updated_at').eq('company_id', companyId).maybeSingle(),
    supabase.from('tb_companies').select('id,last_successful_sync_at,last_sync_status,last_sync_error').eq('id', companyId).maybeSingle(),
  ])
  if (vouchersResult.error) throw new Error(`Could not load vouchers: ${vouchersResult.error.message}`)
  if (linesResult.error) throw new Error(`Could not load voucher lines: ${linesResult.error.message}`)
  if (movementTotalsResult.error) throw new Error(`Could not load movement totals: ${movementTotalsResult.error.message}`)
  if (monthlyMovementResult.error) throw new Error(`Could not load monthly movement: ${monthlyMovementResult.error.message}`)
  if (voucherTypesResult.error) throw new Error(`Could not load voucher types: ${voucherTypesResult.error.message}`)
  if (ledgersResult.error) throw new Error(`Could not load ledgers: ${ledgersResult.error.message}`)
  if (syncResult.error) throw new Error(`Could not load sync status: ${syncResult.error.message}`)
  if (companyResult.error) throw new Error(`Could not load company freshness: ${companyResult.error.message}`)

  const lines = (linesResult.data ?? []) as VoucherLine[]
  const vouchers = vouchersResult.data ?? []
  const totals = movementTotalsResult.data?.[0]
  const periods = new Map((monthlyMovementResult.data ?? []).map((period) => [
    period.period,
    { debit: asNumber(period.debit_total), credit: asNumber(period.credit_total) },
  ]))
  const lineAmounts = new Map<string, number>()
  for (const line of lines) lineAmounts.set(line.voucher_id ?? '', (lineAmounts.get(line.voucher_id ?? '') ?? 0) + asNumber(line.debit_amount) + asNumber(line.credit_amount))
  return {
    kpis: { totalVouchers: totals?.voucher_count ?? 0, debit: asNumber(totals?.debit_total), credit: asNumber(totals?.credit_total), netMovement: asNumber(totals?.debit_total) - asNumber(totals?.credit_total) },
    activity: [...periods.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([label, values]) => ({ label, ...values })),
    voucherTypes: (voucherTypesResult.data ?? []).slice(0, 8).map((row) => ({ type: row.voucher_type, count: row.voucher_count })),
    recentVouchers: vouchers.map((voucher) => ({ id: voucher.id, date: voucher.voucher_date, type: voucher.voucher_type, number: voucher.voucher_number, party: voucher.party_ledger_name, amount: lineAmounts.get(voucher.id) ?? 0 })),
    ledgers: (ledgersResult.data ?? []) as Ledger[],
    sync: (() => {
      const syncError = syncResult.data?.last_error ?? companyResult.data?.last_sync_error ?? null
      const lastSyncedAt = syncResult.data?.last_voucher_sync_at ?? companyResult.data?.last_successful_sync_at ?? syncResult.data?.last_ledger_sync_at ?? null
      const status = syncError ? 'error' : lastSyncedAt ? 'synced' : null
      return { status, lastSyncedAt, error: syncError }
    })(),
  }
}
export async function searchLedgerLines(companyId: string, ledgerId: string, search?: string, page = 0): Promise<{ ledger: Ledger | null; lines: VoucherLine[]; hasMore: boolean }> {
  const supabase = await createSupabaseServerClient()
  const [ledgerResult, linesResult] = await Promise.all([
    supabase.from('tb_ledgers').select('id,org_id,company_id,name,parent_name,opening_balance,closing_balance,is_deleted').eq('id', ledgerId).eq('company_id', companyId).eq('is_deleted', false).maybeSingle(),
    supabase.from('tb_ledger_voucher_lines').select('company_id,ledger_id,ledger_name,voucher_ledger_entry_id,line_number,voucher_id,voucher_date,voucher_type,voucher_number,particulars,debit_amount,credit_amount,running_balance').eq('company_id', companyId).eq('ledger_id', ledgerId).order('voucher_date', { ascending: false }).range(page * 49, page * 49 + 49),
  ])
  if (ledgerResult.error || linesResult.error) throw new Error('Could not load ledger detail')
  const lines = ((linesResult.data ?? []) as VoucherLine[]).filter((line) => !search || `${line.particulars ?? ''} ${line.voucher_number ?? ''} ${line.voucher_type ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  return { ledger: ledgerResult.data as Ledger | null, lines, hasMore: (linesResult.data?.length ?? 0) === 50 }
}

export async function getTrialBalanceData(companyId: string, from?: string, to?: string): Promise<TrialBalanceData> {
  const supabase = await createSupabaseServerClient()
  const [balanceResult, syncResult, companyResult] = await Promise.all([
    supabase.rpc('tb_trial_balance', { target_company: companyId, from_date: from ?? null, to_date: to ?? null }),
    supabase.from('tb_company_sync_state').select('last_error').eq('company_id', companyId).maybeSingle(),
    supabase.from('tb_companies').select('last_sync_status,last_sync_error').eq('id', companyId).maybeSingle(),
  ])
  if (syncResult.error || companyResult.error) throw new Error('Could not load sync status')

  let balanceRows = balanceResult.data ?? []
  if (balanceResult.error) {
    // Keep the page usable while a deployment is catching up with the RPC migration.
    // Both fallback reads are still company-scoped and remain subject to Supabase RLS.
    let linesQuery = supabase.from('tb_ledger_voucher_lines').select('company_id,ledger_id,ledger_name,voucher_date,debit_amount,credit_amount').eq('company_id', companyId)
    if (to) linesQuery = linesQuery.lte('voucher_date', to)
    const [ledgersResult, linesResult] = await Promise.all([
      supabase.from('tb_ledgers').select('id,name,parent_name,opening_balance').eq('company_id', companyId).eq('is_deleted', false).order('name'),
      linesQuery,
    ])
    if (ledgersResult.error || linesResult.error) throw new Error(`Could not load Trial Balance: ${balanceResult.error.message}`)
    const movementByLedger = new Map<string, number>()
    for (const line of linesResult.data ?? []) movementByLedger.set(line.ledger_id ?? '', (movementByLedger.get(line.ledger_id ?? '') ?? 0) + asNumber(line.credit_amount) - asNumber(line.debit_amount))
    balanceRows = (ledgersResult.data ?? []).map((ledger) => {
      const closing = asNumber(ledger.opening_balance) + (movementByLedger.get(ledger.id) ?? 0)
      return { ledger_id: ledger.id, ledger_name: ledger.name, parent_name: ledger.parent_name, closing_balance: closing, debit_balance: Math.max(-closing, 0), credit_balance: Math.max(closing, 0) }
    })
  }
  const groupRows = groupTrialBalanceRows(balanceRows)
  const syncError = syncResult.data?.last_error ?? companyResult.data?.last_sync_error ?? null
  return { groups: groupRows, totalDebit: groupRows.reduce((sum, row) => sum + row.debitBalance, 0), totalCredit: groupRows.reduce((sum, row) => sum + row.creditBalance, 0), sync: { status: syncError ? 'error' : companyResult.data?.last_sync_status ?? null, error: syncError } }
}

export async function getLedgerMonthlyData(companyId: string, ledgerId: string, from?: string, to?: string): Promise<LedgerMonthlyData | null> {
  const supabase = await createSupabaseServerClient()
  const ledgerResult = await supabase.from('tb_ledgers').select('id,name,parent_name,opening_balance').eq('id', ledgerId).eq('company_id', companyId).eq('is_deleted', false).maybeSingle()
  if (ledgerResult.error) throw new Error(`Could not load ledger: ${ledgerResult.error.message}`)
  if (!ledgerResult.data) return null

  const { data, error } = await supabase.rpc('tb_ledger_monthly_summary', { target_company: companyId, target_ledger: ledgerId, from_date: from ?? null, to_date: to ?? null })
  let rows = data ?? []
  if (error) {
    let linesQuery = supabase.from('tb_ledger_voucher_lines').select('voucher_date,debit_amount,credit_amount').eq('company_id', companyId).eq('ledger_id', ledgerId)
    if (from) linesQuery = linesQuery.gte('voucher_date', from)
    if (to) linesQuery = linesQuery.lte('voucher_date', to)
    const linesResult = await linesQuery.order('voucher_date')
    if (linesResult.error) throw new Error(`Could not load ledger monthly summary: ${error.message}`)
    const lines = linesResult.data ?? []
    const firstDate = from ?? lines[0]?.voucher_date ?? null
    const lastDate = to ?? lines.at(-1)?.voucher_date ?? null
    if (firstDate && lastDate) {
      const start = new Date(`${firstDate.slice(0, 7)}-01T00:00:00Z`)
      const end = new Date(`${lastDate.slice(0, 7)}-01T00:00:00Z`)
      const monthRows: typeof rows = []
      for (const cursor = new Date(start); cursor <= end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
        const period = cursor.toISOString().slice(0, 10)
        const next = new Date(cursor); next.setUTCMonth(next.getUTCMonth() + 1)
        const monthLines = lines.filter((line) => (line.voucher_date ?? '') >= period && (line.voucher_date ?? '') < next.toISOString().slice(0, 10))
        const debit = monthLines.reduce((sum, line) => sum + asNumber(line.debit_amount), 0)
        const credit = monthLines.reduce((sum, line) => sum + asNumber(line.credit_amount), 0)
        const throughMonth = lines.filter((line) => (line.voucher_date ?? '') < next.toISOString().slice(0, 10))
        const closing = asNumber(ledgerResult.data.opening_balance) + throughMonth.reduce((sum, line) => sum + asNumber(line.credit_amount) - asNumber(line.debit_amount), 0)
        monthRows.push({ ledger_id: ledgerId, ledger_name: ledgerResult.data.name, parent_name: ledgerResult.data.parent_name, period, debit_total: debit, credit_total: credit, closing_balance: closing })
      }
      rows = monthRows
    }
  }
  const first = rows[0]
  return {
    ledgerId,
    ledgerName: first?.ledger_name ?? ledgerResult.data.name,
    parentName: first?.parent_name ?? ledgerResult.data.parent_name ?? 'Unassigned',
    months: rows.map((row) => ({ period: row.period, debit: asNumber(row.debit_total), credit: asNumber(row.credit_total), closingBalance: asNumber(row.closing_balance) })),
    totalDebit: rows.reduce((sum, row) => sum + asNumber(row.debit_total), 0),
    totalCredit: rows.reduce((sum, row) => sum + asNumber(row.credit_total), 0),
  }
}
