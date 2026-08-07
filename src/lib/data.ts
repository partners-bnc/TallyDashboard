import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Company, DashboardData, HistoryCoverage, Ledger, LedgerMonthlyData, Organization, TrialBalanceData, TrialBalanceLedgerRow, VoucherLine } from '@/lib/types'

const asNumber = (value: number | string | null | undefined) => Number(value ?? 0)

type TrialBalanceSourceRow = { ledger_id: string; ledger_name: string; parent_name: string | null; closing_balance: number | string | null }
type HistoryCoverageRow = { baseline_date: string | null; earliest_voucher_date: string | null; latest_voucher_date: string | null; reconciliation_status: string | null; reconciled_at: string | null }
function historyCoverage(row: HistoryCoverageRow | null | undefined, from?: string, to?: string): HistoryCoverage {
  const baselineDate = row?.baseline_date ?? null
  const reconciliationStatus = row?.reconciliation_status ?? null
  const selectedStart = from || to || null
  const isReconciled = reconciliationStatus === 'complete'
  const isAvailable = isReconciled && !!baselineDate && (!selectedStart || selectedStart >= baselineDate)
  const message = !isReconciled ? 'Historical reconciliation is not complete for this company.' : !baselineDate ? 'No verified history baseline is available for this company.' : selectedStart && selectedStart < baselineDate ? `History available from ${baselineDate}.` : null
  return { baselineDate, earliestVoucherDate: row?.earliest_voucher_date ?? null, latestVoucherDate: row?.latest_voucher_date ?? null, reconciliationStatus, reconciledAt: row?.reconciled_at ?? null, isAvailable, message }
}

export function groupTrialBalanceRows(rows: TrialBalanceSourceRow[]) {
  const groups = new Map<string, TrialBalanceLedgerRow[]>()
  // A Trial Balance is a raw debit/credit report. Do not net income and
  // expense groups into Profit & Loss: Tally shows each ledger separately.
  for (const row of rows) {
    const closingBalance = asNumber(row.closing_balance)
    const ledger: TrialBalanceLedgerRow = { ledgerId: row.ledger_id, ledgerName: row.ledger_name, parentName: row.parent_name ?? 'Unassigned', closingBalance, debitBalance: Math.max(-closingBalance, 0), creditBalance: Math.max(closingBalance, 0) }
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
  const coverageResult = await supabase.rpc('tb_history_coverage', { target_company: companyId })
  if (coverageResult.error) throw new Error(`Could not load history coverage: ${coverageResult.error.message}`)
  const history = historyCoverage(coverageResult.data?.[0], from, to)
  const [syncResult, companyResult, ledgersResult] = await Promise.all([
    supabase.from('tb_company_sync_state').select('company_id,last_catalog_seen_at,last_ledger_sync_at,last_voucher_sync_at,last_error,updated_at').eq('company_id', companyId).maybeSingle(),
    supabase.from('tb_companies').select('id,last_successful_sync_at,last_sync_status,last_sync_error').eq('id', companyId).maybeSingle(),
    supabase.from('tb_ledgers').select('id,org_id,company_id,name,parent_name,opening_balance,closing_balance,is_deleted').eq('company_id', companyId).eq('is_deleted', false).order('name').limit(1000),
  ])
  if (syncResult.error || companyResult.error || ledgersResult.error) throw new Error('Could not load dashboard history status')
  const syncError = syncResult.data?.last_error ?? companyResult.data?.last_sync_error ?? null
  const lastSyncedAt = syncResult.data?.last_voucher_sync_at ?? companyResult.data?.last_successful_sync_at ?? syncResult.data?.last_ledger_sync_at ?? null
  const sync = { status: syncError ? 'error' : lastSyncedAt ? 'synced' : null, lastSyncedAt, error: syncError }
  if (!history.isAvailable) return { kpis: { totalVouchers: 0, debit: 0, credit: 0, netMovement: 0 }, activity: [], voucherTypes: [], recentVouchers: [], ledgers: (ledgersResult.data ?? []) as Ledger[], sync, history }

  const [vouchersResult, linesResult, movementTotalsResult, monthlyMovementResult, voucherTypesResult] = await Promise.all([
    supabase.from('tb_vouchers').select('id,company_id,voucher_date,voucher_type,voucher_number,party_ledger_name,narration,is_cancelled,is_optional,is_deleted').eq('company_id', companyId).eq('is_cancelled', false).eq('is_optional', false).eq('is_deleted', false).not('voucher_type', 'ilike', '% Order').gte('voucher_date', from ?? history.baselineDate!).lte('voucher_date', to ?? '2999-12-31').order('voucher_date', { ascending: false }).limit(8),
    supabase.from('tb_ledger_voucher_lines').select('company_id,ledger_id,ledger_name,voucher_ledger_entry_id,line_number,voucher_id,voucher_date,voucher_type,voucher_number,particulars,debit_amount,credit_amount,running_balance').eq('company_id', companyId).gte('voucher_date', from ?? history.baselineDate!).lte('voucher_date', to ?? '2999-12-31').order('voucher_date', { ascending: false }).limit(1000),
    supabase.rpc('tb_dashboard_movement_totals', { target_company: companyId, from_date: from ?? history.baselineDate, to_date: to ?? null }),
    supabase.rpc('tb_dashboard_monthly_movement', { target_company: companyId, from_date: from ?? history.baselineDate, to_date: to ?? null }),
    supabase.rpc('tb_dashboard_voucher_type_counts', { target_company: companyId, from_date: from ?? history.baselineDate, to_date: to ?? null }),
  ])
  if (vouchersResult.error || linesResult.error || movementTotalsResult.error || monthlyMovementResult.error || voucherTypesResult.error) throw new Error('Could not load dashboard movement')
  const lines = (linesResult.data ?? []) as VoucherLine[]
  const totals = movementTotalsResult.data?.[0]
  const periods = new Map((monthlyMovementResult.data ?? []).map((period) => [period.period, { debit: asNumber(period.debit_total), credit: asNumber(period.credit_total) }]))
  const lineAmounts = new Map<string, number>()
  for (const line of lines) lineAmounts.set(line.voucher_id ?? '', (lineAmounts.get(line.voucher_id ?? '') ?? 0) + asNumber(line.debit_amount) + asNumber(line.credit_amount))
  return {
    kpis: { totalVouchers: totals?.voucher_count ?? 0, debit: asNumber(totals?.debit_total), credit: asNumber(totals?.credit_total), netMovement: asNumber(totals?.debit_total) - asNumber(totals?.credit_total) },
    activity: [...periods.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([label, values]) => ({ label, ...values })),
    voucherTypes: (voucherTypesResult.data ?? []).slice(0, 8).map((row) => ({ type: row.voucher_type, count: row.voucher_count })),
    recentVouchers: (vouchersResult.data ?? []).map((voucher) => ({ id: voucher.id, date: voucher.voucher_date, type: voucher.voucher_type, number: voucher.voucher_number, party: voucher.party_ledger_name, amount: lineAmounts.get(voucher.id) ?? 0 })),
    ledgers: (ledgersResult.data ?? []) as Ledger[],
    sync,
    history,
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
  const coverageResult = await supabase.rpc('tb_history_coverage', { target_company: companyId })
  if (coverageResult.error) throw new Error(`Could not load history coverage: ${coverageResult.error.message}`)
  const history = historyCoverage(coverageResult.data?.[0], from, to)
  const [syncResult, companyResult] = await Promise.all([
    supabase.from('tb_company_sync_state').select('last_error').eq('company_id', companyId).maybeSingle(),
    supabase.from('tb_companies').select('last_sync_status,last_sync_error').eq('id', companyId).maybeSingle(),
  ])
  if (syncResult.error || companyResult.error) throw new Error('Could not load sync status')
  const syncError = syncResult.data?.last_error ?? companyResult.data?.last_sync_error ?? null
  if (!history.isAvailable) return { groups: [], totalDebit: 0, totalCredit: 0, sync: { status: syncError ? 'error' : companyResult.data?.last_sync_status ?? null, error: syncError }, history, verification: null, authoritativeTotals: null }
  const snapshotAsOfDate = to ?? from ?? null
  const snapshotResult = snapshotAsOfDate ? await supabase.from('tb_tally_trial_balance_snapshots').select('debit_total,credit_total,rows').eq('company_id', companyId).eq('as_of_date', snapshotAsOfDate).maybeSingle() : { data: null, error: null }
  if (snapshotResult.error) throw new Error(`Could not load Tally Trial Balance snapshot: ${snapshotResult.error.message}`)
  const authoritativeTotals = snapshotResult.data ? { asOfDate: snapshotAsOfDate!, debit: asNumber(snapshotResult.data.debit_total), credit: asNumber(snapshotResult.data.credit_total) } : null
  const balanceResult = await supabase.rpc('tb_trial_balance', { target_company: companyId, from_date: null, to_date: to ?? from ?? null })
  if (balanceResult.error) throw new Error(`Could not load Trial Balance: ${balanceResult.error.message}`)
  const groupRows = groupTrialBalanceRows(balanceResult.data ?? [])
  const asOfDate = to ?? from ?? null
  const verificationResult = asOfDate ? await supabase.rpc('tb_trial_balance_verification', { target_company: companyId, target_date: asOfDate }) : { data: [], error: null }
  if (verificationResult.error) throw new Error(`Could not load Tally verification: ${verificationResult.error.message}`)
  const verificationRows = verificationResult.data ?? []
  const verification = verificationRows.length ? {
    asOfDate: asOfDate!, tallyTotal: verificationRows.reduce((sum, row) => sum + Math.abs(asNumber(row.tally_balance)), 0),
    calculatedTotal: verificationRows.reduce((sum, row) => sum + Math.abs(asNumber(row.calculated_balance)), 0),
    differenceTotal: verificationRows.reduce((sum, row) => sum + Math.abs(asNumber(row.difference)), 0),
    unmatchedCount: verificationRows.filter((row) => Math.abs(asNumber(row.difference)) > 0.005).length,
    largestDifferences: verificationRows.filter((row) => Math.abs(asNumber(row.difference)) > 0.005).sort((a, b) => Math.abs(asNumber(b.difference)) - Math.abs(asNumber(a.difference))).slice(0, 10).map((row) => ({ ledgerName: row.ledger_name ?? 'Missing ledger', calculatedBalance: asNumber(row.calculated_balance), tallyBalance: asNumber(row.tally_balance), difference: asNumber(row.difference) }))
  } : null
  return { groups: groupRows, totalDebit: authoritativeTotals?.debit ?? groupRows.reduce((sum, row) => sum + row.debitBalance, 0), totalCredit: authoritativeTotals?.credit ?? groupRows.reduce((sum, row) => sum + row.creditBalance, 0), sync: { status: syncError ? 'error' : companyResult.data?.last_sync_status ?? null, error: syncError }, history, verification, authoritativeTotals }
}
export async function getLedgerMonthlyData(companyId: string, ledgerId: string, from?: string, to?: string): Promise<LedgerMonthlyData | null> {
  const supabase = await createSupabaseServerClient()
  const ledgerResult = await supabase.from('tb_ledgers').select('id,name,parent_name,opening_balance').eq('id', ledgerId).eq('company_id', companyId).eq('is_deleted', false).maybeSingle()
  if (ledgerResult.error) throw new Error(`Could not load ledger: ${ledgerResult.error.message}`)
  if (!ledgerResult.data) return null

  const { data, error } = await supabase.rpc('tb_ledger_monthly_summary', { target_company: companyId, target_ledger: ledgerId, from_date: from ?? null, to_date: to ?? null })
  if (error) throw new Error(`Could not load ledger monthly summary: ${error.message}`)
  const rows = data ?? []
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









