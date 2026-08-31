import { createNeonDataApiClient } from '@/lib/neon/data-api'
import { cache } from 'react'
import { resolveActiveLedgers } from '@/lib/centralized-mapping'
import type { Company, DashboardData, HistoryCoverage, Ledger, LedgerMonthlyData, Organization, TrialBalanceData, TrialBalanceLedgerRow, VoucherLine, FundsFlowData, FundsFlowGroup, FundsFlowGroupNode, FundsFlowLedger, FundsFlowEntry, FundsFlowSummary, TdsReportData } from '@/lib/types'
import { buildTdsReport, resolveTdsReportPeriod, type TdsLedgerBalance, type TdsSourceLine } from '@/lib/tds'

export { getGstReportData } from '@/lib/gst-data'
export type { GstLedgerBalance, GstReportData } from '@/lib/gst-data'

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

const loadOrganizations = cache(async (): Promise<Organization[]> => {
  const client = createNeonDataApiClient()
  const { data, error } = await client.from('tb_organizations').select('id,name,created_at').order('name')
  if (error) throw new Error(`Could not load organizations: ${error.message}`)
  return data ?? []
})

export function listOrganizations(): Promise<Organization[]> {
  return loadOrganizations()
}

const loadCompanies = cache(async (orgId: string): Promise<Company[]> => {
  const client = createNeonDataApiClient()
  const { data, error } = await client.from('tb_companies').select('id,org_id,name,tally_company_guid,last_successful_sync_at,last_sync_status,last_sync_error,is_active,updated_at').eq('org_id', orgId).eq('is_active', true).order('name')
  if (error) throw new Error(`Could not load companies: ${error.message}`)
  return data ?? []
})

export function listCompanies(orgId: string): Promise<Company[]> {
  return loadCompanies(orgId)
}

export const getOrganization = cache(async (orgId: string): Promise<Organization | null> => {
  const client = createNeonDataApiClient()
  const { data, error } = await client.from('tb_organizations').select('id,name,created_at').eq('id', orgId).maybeSingle()
  if (error) throw new Error(`Could not validate organization: ${error.message}`)
  return data ?? null
})

export const getCompanyContext = cache(async (orgId: string, companyId: string): Promise<Company | null> => {
  const client = createNeonDataApiClient()
  const { data, error } = await client
    .from('tb_companies')
    .select('id,org_id,name,tally_company_guid,last_successful_sync_at,last_sync_status,last_sync_error,is_active,updated_at')
    .eq('id', companyId)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(`Could not validate company: ${error.message}`)
  return data ?? null
})

export async function getDashboardData(companyId: string, from?: string, to?: string): Promise<DashboardData> {
  const client = createNeonDataApiClient()
  const coverageResult = await client.rpc('tb_history_coverage', { target_company: companyId })
  if (coverageResult.error) throw new Error(`Could not load history coverage: ${coverageResult.error.message}`)
  const history = historyCoverage(coverageResult.data?.[0], from, to)
  const [syncResult, companyResult, ledgersResult] = await Promise.all([
    client.from('tb_company_sync_state').select('company_id,last_catalog_seen_at,last_ledger_sync_at,last_voucher_sync_at,last_error,updated_at').eq('company_id', companyId).maybeSingle(),
    client.from('tb_companies').select('id,last_successful_sync_at,last_sync_status,last_sync_error').eq('id', companyId).maybeSingle(),
    client.from('tb_ledgers').select('id,org_id,company_id,name,parent_name,opening_balance,closing_balance,is_deleted').eq('company_id', companyId).eq('is_deleted', false).order('name').limit(1000),
  ])
  if (syncResult.error || companyResult.error || ledgersResult.error) throw new Error('Could not load dashboard history status')
  if (!companyResult.data) throw new Error('Dashboard company became unavailable during the request')
  const syncError = syncResult.data?.last_error ?? companyResult.data?.last_sync_error ?? null
  const lastSyncedAt = syncResult.data?.last_voucher_sync_at ?? companyResult.data?.last_successful_sync_at ?? syncResult.data?.last_ledger_sync_at ?? null
  const sync = { status: syncError ? 'error' : lastSyncedAt ? 'synced' : null, lastSyncedAt, error: syncError }
  if (!history.isAvailable) return { kpis: { totalVouchers: 0, debit: 0, credit: 0, netMovement: 0 }, activity: [], voucherTypes: [], recentVouchers: [], ledgers: (ledgersResult.data ?? []) as Ledger[], sync, history }

  const [vouchersResult, movementTotalsResult, monthlyMovementResult, voucherTypesResult] = await Promise.all([
    client.from('tb_vouchers').select('id,company_id,voucher_date,voucher_type,voucher_number,party_ledger_name,narration,is_cancelled,is_optional,is_deleted').eq('company_id', companyId).eq('is_cancelled', false).eq('is_optional', false).eq('is_deleted', false).not('voucher_type', 'ilike', '% Order').gte('voucher_date', from ?? history.baselineDate!).lte('voucher_date', to ?? '2999-12-31').order('voucher_date', { ascending: false }).limit(8),
    client.rpc('tb_dashboard_movement_totals', { target_company: companyId, from_date: from ?? history.baselineDate, to_date: to ?? null }),
    client.rpc('tb_dashboard_monthly_movement', { target_company: companyId, from_date: from ?? history.baselineDate, to_date: to ?? null }),
    client.rpc('tb_dashboard_voucher_type_counts', { target_company: companyId, from_date: from ?? history.baselineDate, to_date: to ?? null }),
  ])
  const movementError = vouchersResult.error ?? movementTotalsResult.error ?? monthlyMovementResult.error ?? voucherTypesResult.error
  if (movementError) throw new Error(`Could not load dashboard movement: ${movementError.message}`)
  const recentVoucherIds = (vouchersResult.data ?? []).map((voucher) => voucher.id)
  const recentLinesResult = recentVoucherIds.length
    ? await client
      .from('tb_voucher_ledger_entries')
      .select('voucher_id,amount')
      .eq('company_id', companyId)
      .in('voucher_id', recentVoucherIds)
    : { data: [], error: null }
  if (recentLinesResult.error) throw new Error(`Could not load recent voucher amounts: ${recentLinesResult.error.message}`)
  const totals = movementTotalsResult.data?.[0]
  if (!totals) throw new Error('Dashboard totals query returned no aggregate row')
  const periods = new Map((monthlyMovementResult.data ?? []).map((period) => [period.period, { debit: asNumber(period.debit_total), credit: asNumber(period.credit_total) }]))
  const lineAmounts = new Map<string, number>()
  for (const line of recentLinesResult.data ?? []) {
    lineAmounts.set(line.voucher_id, (lineAmounts.get(line.voucher_id) ?? 0) + Math.abs(asNumber(line.amount)))
  }
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
  const client = createNeonDataApiClient()
  const [ledgerResult, linesResult] = await Promise.all([
    client.from('tb_ledgers').select('id,org_id,company_id,name,parent_name,opening_balance,closing_balance,is_deleted').eq('id', ledgerId).eq('company_id', companyId).eq('is_deleted', false).maybeSingle(),
    client.from('tb_ledger_voucher_lines').select('company_id,ledger_id,ledger_name,voucher_ledger_entry_id,line_number,voucher_id,voucher_date,voucher_type,voucher_number,particulars,debit_amount,credit_amount,running_balance').eq('company_id', companyId).eq('ledger_id', ledgerId).order('voucher_date', { ascending: false }).range(page * 49, page * 49 + 49),
  ])
  if (ledgerResult.error || linesResult.error) throw new Error('Could not load ledger detail')
  const lines = ((linesResult.data ?? []) as VoucherLine[]).filter((line) => !search || `${line.particulars ?? ''} ${line.voucher_number ?? ''} ${line.voucher_type ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  return { ledger: ledgerResult.data as Ledger | null, lines, hasMore: (linesResult.data?.length ?? 0) === 50 }
}

export async function getTrialBalanceData(companyId: string, from?: string, to?: string): Promise<TrialBalanceData> {
  const client = createNeonDataApiClient()
  const coverageResult = await client.rpc('tb_history_coverage', { target_company: companyId })
  if (coverageResult.error) throw new Error(`Could not load history coverage: ${coverageResult.error.message}`)
  const history = historyCoverage(coverageResult.data?.[0], from, to)
  const [syncResult, companyResult] = await Promise.all([
    client.from('tb_company_sync_state').select('last_error').eq('company_id', companyId).maybeSingle(),
    client.from('tb_companies').select('last_sync_status,last_sync_error').eq('id', companyId).maybeSingle(),
  ])
  if (syncResult.error || companyResult.error) throw new Error('Could not load sync status')
  const syncError = syncResult.data?.last_error ?? companyResult.data?.last_sync_error ?? null
  if (!history.isAvailable) return { groups: [], totalDebit: 0, totalCredit: 0, sync: { status: syncError ? 'error' : companyResult.data?.last_sync_status ?? null, error: syncError }, history, verification: null, authoritativeTotals: null }
  const snapshotAsOfDate = to ?? from ?? null
  const snapshotResult = snapshotAsOfDate ? await client.from('tb_tally_trial_balance_snapshots').select('debit_total,credit_total,rows').eq('company_id', companyId).eq('as_of_date', snapshotAsOfDate).maybeSingle() : { data: null, error: null }
  if (snapshotResult.error) throw new Error(`Could not load Tally Trial Balance snapshot: ${snapshotResult.error.message}`)
  const authoritativeTotals = snapshotResult.data ? { asOfDate: snapshotAsOfDate!, debit: asNumber(snapshotResult.data.debit_total), credit: asNumber(snapshotResult.data.credit_total) } : null
  const balanceResult = await client.rpc('tb_trial_balance', { target_company: companyId, from_date: null, to_date: to ?? from ?? null })
  if (balanceResult.error) throw new Error(`Could not load Trial Balance: ${balanceResult.error.message}`)
  const groupRows = groupTrialBalanceRows(balanceResult.data ?? [])
  const asOfDate = to ?? from ?? null
  const verificationResult = asOfDate ? await client.rpc('tb_trial_balance_verification', { target_company: companyId, target_date: asOfDate }) : { data: [], error: null }
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
  const client = createNeonDataApiClient()
  const ledgerResult = await client.from('tb_ledgers').select('id,name,parent_name,opening_balance').eq('id', ledgerId).eq('company_id', companyId).eq('is_deleted', false).maybeSingle()
  if (ledgerResult.error) throw new Error(`Could not load ledger: ${ledgerResult.error.message}`)
  if (!ledgerResult.data) return null

  const { data, error } = await client.rpc('tb_ledger_monthly_summary', { target_company: companyId, target_ledger: ledgerId, from_date: from ?? null, to_date: to ?? null })
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

const SUBGROUP_TO_PRIMARY_MAP: Record<string, string> = {
  // Fixed Assets
  'furniture & fixtures': 'Fixed Assets',
  'furniture and fixtures': 'Fixed Assets',
  'funiture & fixtures': 'Fixed Assets',
  'funiture and fixtures': 'Fixed Assets',
  'plant & machinery': 'Fixed Assets',
  'plant and machinery': 'Fixed Assets',
  'office equipment': 'Fixed Assets',
  'building': 'Fixed Assets',
  'land & buildings': 'Fixed Assets',
  'electrical equipment': 'Fixed Assets',
  'computers': 'Fixed Assets',
  'computer & laptop': 'Fixed Assets',
  'capital work in progress': 'Fixed Assets',
  'capital work-in-progress': 'Fixed Assets',
  'cwip': 'Fixed Assets',
  'fixed assets': 'Fixed Assets',

  // Current Liabilities
  'sundry creditors': 'Current Liabilities',
  'furniture creditors': 'Current Liabilities',
  'funiture creditors': 'Current Liabilities',
  'duties & taxes': 'Current Liabilities',
  'duties and taxes': 'Current Liabilities',
  'provisions': 'Current Liabilities',
  'current liabilities': 'Current Liabilities',

  // Current Assets
  'sundry debtors': 'Current Assets',
  'bank accounts': 'Current Assets',
  'cash-in-hand': 'Current Assets',
  'cash in hand': 'Current Assets',
  'stock-in-hand': 'Current Assets',
  'stock in hand': 'Current Assets',
  'loans & advances (asset)': 'Current Assets',
  'loans & advances': 'Current Assets',
  'loans and advances': 'Current Assets',
  'deposits (asset)': 'Current Assets',
  'deposits': 'Current Assets',
  'investments': 'Current Assets',
  'current assets': 'Current Assets',

  // Loans (Liability)
  'secured loans': 'Loans (Liability)',
  'unsecured loans': 'Loans (Liability)',
  'bank od a/c': 'Loans (Liability)',
  'loans (liability)': 'Loans (Liability)',

  // Capital Account
  'share capital': 'Capital Account',
  'reserves & surplus': 'Reserves & Surplus',
  'capital account': 'Capital Account',

  // Expenses
  'indirect expenses': 'Indirect Expenses',
  'direct expenses': 'Direct Expenses',
  'operating expenses': 'Indirect Expenses',
  'salary & wages': 'Indirect Expenses',
  'salary and wages': 'Indirect Expenses',
  'administrative expenses': 'Indirect Expenses',

  // Incomes
  'indirect incomes': 'Indirect Incomes',
  'direct incomes': 'Direct Incomes',
  'misc income': 'Indirect Incomes',
  'interest income': 'Indirect Incomes',

  // Suspense
  'suspense account': 'Suspense Account',
  'suspense': 'Suspense Account',

  // Sales/Purchases
  'purchase accounts': 'Purchase Accounts',
  'sales accounts': 'Sales Accounts'
}

function getPrimaryGroupForSubgroup(subgroup: string): string {
  const normalized = subgroup.toLowerCase().trim()
  if (SUBGROUP_TO_PRIMARY_MAP[normalized]) {
    return SUBGROUP_TO_PRIMARY_MAP[normalized]
  }

  if (
    normalized.includes('furniture') ||
    normalized.includes('funiture') ||
    normalized.includes('fixtures') ||
    normalized.includes('machinery') ||
    normalized.includes('tools') ||
    normalized.includes('equipment') ||
    normalized.includes('building') ||
    normalized.includes('land') ||
    normalized.includes('fixed asset') ||
    normalized.includes('computer') ||
    normalized.includes('laptop') ||
    normalized.includes('intangible')
  ) {
    return 'Fixed Assets'
  }
  if (
    normalized.includes('creditor') ||
    normalized.includes('liability') ||
    normalized.includes('duties') ||
    normalized.includes('taxes') ||
    normalized.includes('tax') ||
    normalized.includes('gst') ||
    normalized.includes('rcm') ||
    normalized.includes('provision') ||
    normalized.includes('payable') ||
    normalized.includes('payble') ||
    normalized.includes('tds')
  ) {
    return 'Current Liabilities'
  }
  if (
    normalized.includes('debtor') ||
    normalized.includes('bank') ||
    normalized.includes('cash') ||
    normalized.includes('stock') ||
    normalized.includes('advance') ||
    normalized.includes('receivable') ||
    normalized.includes('deposit') ||
    normalized.includes('current asset') ||
    normalized.includes('investment') ||
    normalized.includes('fdr')
  ) {
    return 'Current Assets'
  }
  if (
    normalized.includes('indirect expense') ||
    normalized.includes('salary') ||
    normalized.includes('wages') ||
    normalized.includes('rent') ||
    normalized.includes('operating') ||
    normalized.includes('insurance') ||
    normalized.includes('promotion') ||
    normalized.includes('fees') ||
    normalized.includes('travelling') ||
    normalized.includes('travel') ||
    normalized.includes('admin') ||
    normalized.includes('renewal') ||
    normalized.includes('charges') ||
    normalized.includes('consumables') ||
    normalized.includes('supplies') ||
    normalized.includes('packaging') ||
    normalized.includes('other')
  ) {
    return 'Indirect Expenses'
  }
  if (
    normalized.includes('direct expense') ||
    normalized.includes('freight') ||
    normalized.includes('logistics') ||
    normalized.includes('rm') ||
    normalized.includes('material') ||
    normalized.includes('sample')
  ) {
    return 'Direct Expenses'
  }
  if (normalized.includes('loan') || normalized.includes('borrowing') || normalized.includes('od a/c')) {
    return 'Loans (Liability)'
  }
  if (normalized.includes('income') || normalized.includes('revenue') || normalized.includes('interest')) {
    return 'Indirect Incomes'
  }
  if (normalized.includes('suspense')) {
    return 'Suspense Account'
  }
  if (normalized.includes('purchase')) {
    return 'Purchase Accounts'
  }
  if (normalized.includes('sales')) {
    return 'Sales Accounts'
  }
  if (normalized.includes('branch') || normalized.includes('division')) {
    return 'Branch / Divisions'
  }
  if (normalized.includes('capital') || normalized.includes('reserve') || normalized.includes('surplus')) {
    return 'Capital Account'
  }

  return subgroup
    .split(' ')
    .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '')
    .join(' ')
}

export async function getFundsFlowData(companyId: string, from?: string, to?: string): Promise<FundsFlowData> {
  const client = createNeonDataApiClient()

  // 1. Get history coverage limits
  const coverageResult = await client.rpc('tb_history_coverage', { target_company: companyId })
  if (coverageResult.error) throw new Error(`Could not load history coverage: ${coverageResult.error.message}`)
  const history = historyCoverage(coverageResult.data?.[0], from, to)

  // Get sync status
  const [syncResult, companyResult] = await Promise.all([
    client.from('tb_company_sync_state').select('last_error,last_voucher_sync_at,last_ledger_sync_at').eq('company_id', companyId).maybeSingle(),
    client.from('tb_companies').select('name,last_sync_status,last_sync_error,last_successful_sync_at').eq('id', companyId).maybeSingle(),
  ])
  if (syncResult.error || companyResult.error) throw new Error('Could not load sync status')
  const syncError = syncResult.data?.last_error ?? companyResult.data?.last_sync_error ?? null
  const lastSyncedAt = companyResult.data?.last_successful_sync_at ?? syncResult.data?.last_voucher_sync_at ?? null
  const sync = { status: syncError ? 'error' : lastSyncedAt ? 'synced' : null, lastSyncedAt, error: syncError }

  const fromDate = from ?? history.baselineDate ?? '1970-01-01'
  const toDate = to || null

  // 2. Query Trial Balance closing balances (to map ledgers to their parent groups)
  const balanceResult = await client.rpc('tb_trial_balance', { target_company: companyId, from_date: null, to_date: toDate })
  if (balanceResult.error) throw new Error(`Could not load Trial Balance for report: ${balanceResult.error.message}`)
  const rawBalances = balanceResult.data ?? []

  // Override closing balances with the synced closing_balance column from tb_ledgers table when toDate is null or >= lastSyncedAt (latest state)
  const isLatest = !toDate || (lastSyncedAt && new Date(toDate) >= new Date(lastSyncedAt))
  if (isLatest) {
    const { data: activeLedgers } = await client
      .from('tb_ledgers')
      .select('id, closing_balance')
      .eq('company_id', companyId)
      .eq('is_deleted', false)

    if (activeLedgers) {
      const ledgerBalanceMap = new Map(activeLedgers.map(l => [l.id, l.closing_balance]))
      for (const b of rawBalances) {
        if (b.ledger_id && ledgerBalanceMap.has(b.ledger_id)) {
          b.closing_balance = Number(ledgerBalanceMap.get(b.ledger_id) ?? 0)
        }
      }
    }
  }

  // 3. Query all voucher lines in the date range (paginated to bypass PostgREST max_rows server cap of 1000)
  const rawLines: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    const linesQuery = client
      .from('tb_ledger_voucher_lines')
      .select('ledger_id,ledger_name,voucher_date,voucher_type,voucher_number,particulars,debit_amount,credit_amount,voucher_ledger_entry_id,voucher_id')
      .eq('company_id', companyId)
      .gte('voucher_date', fromDate)
      .order('voucher_date', { ascending: true })
      .order('voucher_ledger_entry_id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (to) {
      linesQuery.lte('voucher_date', to)
    }

    const linesResult = await linesQuery
    if (linesResult.error) throw new Error(`Could not load voucher lines for report: ${linesResult.error.message}`)

    const pageData = linesResult.data ?? []
    rawLines.push(...pageData)

    if (pageData.length < pageSize) {
      hasMore = false
    } else {
      page++
    }
  }

  // Fetch ledger groups for full tree structure
  const { data: dbGroups } = await client
    .from('tb_ledger_groups')
    .select('name, parent_name')
    .eq('company_id', companyId)
    .eq('is_deleted', false)

  const groupParentMap = new Map<string, string>()
  for (const g of dbGroups || []) {
    groupParentMap.set(g.name.toLowerCase(), g.parent_name ?? 'Unassigned')
  }

  // Create mappings of ledger name and ledger ID to Tally Parent Group
  const ledgerParentMap = new Map<string, string>()
  const ledgerIdParentMap = new Map<string, string>()
  for (const b of rawBalances) {
    if (b.ledger_name) ledgerParentMap.set(b.ledger_name.toLowerCase(), b.parent_name ?? 'Unassigned')
    if (b.ledger_id) ledgerIdParentMap.set(b.ledger_id, b.parent_name ?? 'Unassigned')
  }

  const getParentGroup = (ledgerName: string | null, ledgerId: string | null): string => {
    const name = ledgerName ?? ''
    const id = ledgerId ?? ''
    return ledgerParentMap.get(name.toLowerCase()) || ledgerIdParentMap.get(id) || 'Unassigned'
  }

  const formatGroupName = (name: string): string => {
    return name
      .split(' ')
      .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '')
      .join(' ')
  }

  const isTopLevelParent = (pName: string | null | undefined): boolean => {
    if (!pName) return true
    const norm = pName.toLowerCase().trim()
    return norm === 'primary' || norm.includes('primary') || norm === 'unassigned'
  }

  // Helper to trace back to primary group
  const traceToPrimaryGroup = (groupName: string): { primary: string, path: string[] } => {
    const fullPath: string[] = []
    let current = groupName

    const seen = new Set<string>()
    while (current && current.toLowerCase() !== 'unassigned') {
      const currentNorm = current.toLowerCase().trim()
      if (seen.has(currentNorm)) break
      seen.add(currentNorm)

      const formatted = formatGroupName(current)
      fullPath.unshift(formatted)

      const parent = groupParentMap.get(currentNorm)
      if (!parent || isTopLevelParent(parent)) {
        break
      }
      current = parent
    }

    const primary = fullPath[0] || 'Unassigned'
    const path = fullPath.slice(1)
    return { primary, path }
  }

  // Build recursive structure
  const primaryGroupsNodeMap = new Map<string, FundsFlowGroupNode>()

  // 1. Initialize primaryGroupsNodeMap with all top-level groups in the database
  for (const g of dbGroups || []) {
    if (!g.parent_name || isTopLevelParent(g.parent_name)) {
      const formatted = formatGroupName(g.name)
      // Skip "Primary" itself to prevent it from showing as a selectable primary group
      if (formatted.toLowerCase() === 'primary' || formatted.toLowerCase().includes('primary')) {
        continue
      }
      if (!primaryGroupsNodeMap.has(formatted)) {
        primaryGroupsNodeMap.set(formatted, {
          name: formatted,
          debitTotal: 0,
          creditTotal: 0,
          netMovement: 0,
          closingBalance: 0,
          subgroups: [],
          ledgers: [],
          voucherLines: []
        })
      }
    }
  }

  // Ensure Unassigned exists
  if (!primaryGroupsNodeMap.has('Unassigned')) {
    primaryGroupsNodeMap.set('Unassigned', {
      name: 'Unassigned',
      debitTotal: 0,
      creditTotal: 0,
      netMovement: 0,
      closingBalance: 0,
      subgroups: [],
      ledgers: [],
      voucherLines: []
    })
  }

  const ensureNode = (primary: string, path: string[]): FundsFlowGroupNode => {
    let currentPrimary = primaryGroupsNodeMap.get(primary)
    if (!currentPrimary) {
      currentPrimary = { name: primary, debitTotal: 0, creditTotal: 0, netMovement: 0, closingBalance: 0, subgroups: [], ledgers: [], voucherLines: [] }
      primaryGroupsNodeMap.set(primary, currentPrimary)
    }

    let currentNode = currentPrimary
    for (const step of path) {
      let child = currentNode.subgroups.find((s: FundsFlowGroupNode) => s.name === step)
      if (!child) {
        child = { name: step, debitTotal: 0, creditTotal: 0, netMovement: 0, closingBalance: 0, subgroups: [], ledgers: [], voucherLines: [] }
        currentNode.subgroups.push(child)
      }
      currentNode = child
    }

    return currentNode
  }

  // 2. Incorporate closing balances
  for (const b of rawBalances) {
    const subGroupRaw = b.parent_name || 'Unassigned'
    const { primary, path } = traceToPrimaryGroup(subGroupRaw)
    const node = ensureNode(primary, path)

    node.ledgers.push({
      ledgerName: b.ledger_name || 'Unknown Ledger',
      closingBalance: asNumber(b.closing_balance),
      ledgerId: b.ledger_id || undefined
    })
  }

  // 3. Incorporate Voucher Lines
  for (const l of rawLines) {
    const subGroupRaw = getParentGroup(l.ledger_name, l.ledger_id)
    const { primary, path } = traceToPrimaryGroup(subGroupRaw)
    const node = ensureNode(primary, path)

    const entry: FundsFlowEntry = {
      date: l.voucher_date,
      particulars: l.particulars ?? '',
      nature: l.ledger_name,
      debit: asNumber(l.debit_amount),
      credit: asNumber(l.credit_amount),
      amount: asNumber(l.debit_amount) - asNumber(l.credit_amount),
      voucherId: l.voucher_id
    }

    node.voucherLines.push(entry)
  }

  // 4. Roll up totals recursively
  const rollup = (node: FundsFlowGroupNode) => {
    let dTotal = node.voucherLines.reduce((sum: number, item: FundsFlowEntry) => sum + (item.debit ?? 0), 0)
    let cTotal = node.voucherLines.reduce((sum: number, item: FundsFlowEntry) => sum + (item.credit ?? 0), 0)
    let cb = node.ledgers.reduce((sum: number, item: FundsFlowLedger) => sum + item.closingBalance, 0)

    node.ledgers.sort((a: FundsFlowLedger, b: FundsFlowLedger) => a.ledgerName.localeCompare(b.ledgerName))
    node.subgroups.sort((a: FundsFlowGroupNode, b: FundsFlowGroupNode) => a.name.localeCompare(b.name))

    for (const sub of node.subgroups) {
      rollup(sub)
      dTotal += sub.debitTotal
      cTotal += sub.creditTotal
      cb += sub.closingBalance
    }

    node.debitTotal = dTotal
    node.creditTotal = cTotal
    node.closingBalance = cb
    node.netMovement = cTotal - dTotal
  }

  const groups: FundsFlowGroup[] = []

  for (const [primaryName, primaryNode] of primaryGroupsNodeMap.entries()) {
    if (primaryName.toLowerCase() === 'primary' || primaryName.toLowerCase().includes('primary')) {
      continue
    }
    rollup(primaryNode)

    groups.push({
      groupName: primaryName,
      debitTotal: primaryNode.debitTotal,
      creditTotal: primaryNode.creditTotal,
      netMovement: primaryNode.netMovement,
      closingBalance: primaryNode.closingBalance,
      subgroups: primaryNode.subgroups
    })
  }

  // Sort groups alphabetically
  groups.sort((a, b) => a.groupName.localeCompare(b.groupName))

  const totalDebits = groups.reduce((sum, item) => sum + item.debitTotal, 0)
  const totalCredits = groups.reduce((sum, item) => sum + item.creditTotal, 0)
  const netMovement = totalCredits - totalDebits

  return {
    summary: {
      groups: groups.map(g => ({
        groupName: g.groupName,
        debitTotal: g.debitTotal,
        creditTotal: g.creditTotal,
        netMovement: g.netMovement
      })),
      totalDebits,
      totalCredits,
      netMovement
    },
    groups,
    sync,
    history
  }
}

export async function getTdsReportData(companyId: string, from: string, to: string, asOfDate: string, options: { defaultToLatestActivity?: boolean; today?: Date } = {}): Promise<TdsReportData> {
  const client = createNeonDataApiClient()
  const [activeMapping, ledgersResult, sourceResult] = await Promise.all([
    resolveActiveLedgers(companyId, 'TDS'),
    client.from('tb_ledgers').select('id,name,opening_balance,closing_balance').eq('company_id', companyId).eq('is_deleted', false),
    client.rpc('tb_tds_source_lines', { target_company: companyId, target_as_of: asOfDate }),
  ])
  if (ledgersResult.error || sourceResult.error) {
    throw new Error(`Could not load TDS report: ${ledgersResult.error?.message ?? sourceResult.error?.message}`)
  }
  const mappedLedgerIds = activeMapping.activeLedgerIds
  const ledgerBalances: TdsLedgerBalance[] = (ledgersResult.data ?? [])
    .filter((ledger) => mappedLedgerIds.has(ledger.id))
    .map((ledger) => ({ ledgerId: ledger.id, openingBalance: asNumber(ledger.opening_balance), closingBalance: asNumber(ledger.closing_balance) }))
  const lines: TdsSourceLine[] = (sourceResult.data ?? []).map((line) => ({
    companyId: line.company_id,
    mappingId: line.mapping_id,
    ledgerId: line.ledger_id,
    ledgerName: line.ledger_name,
    tdsType: line.tds_type,
    sectionCode: line.section_code,
    roundingTolerance: asNumber(line.rounding_tolerance),
    journalTreatment: line.journal_treatment,
    liabilityVoucherTypes: line.liability_voucher_types || [],
    depositVoucherTypes: line.deposit_voucher_types || [],
    voucherLedgerEntryId: line.voucher_ledger_entry_id,
    voucherDate: line.voucher_date,
    voucherType: line.voucher_type,
    voucherNumber: line.voucher_number,
    party: line.party_ledger_name,
    narration: line.narration,
    rawSignedAmount: asNumber(line.raw_signed_amount),
  }))
  const initial = buildTdsReport({ companyId, asOfDate, from, to, lines, ledgerBalances })
  if (!options.defaultToLatestActivity) return initial
  const period = resolveTdsReportPeriod(undefined, undefined, initial.latestActivityDate, options.today)
  if (period.from === from && period.to === to) return initial
  return buildTdsReport({ companyId, asOfDate, from: period.from, to: period.to, lines, ledgerBalances })
}

export interface PromoterLedgerPosition {
  ledgerId: string
  ledgerName: string
  openingBalance: number
  closingBalance: number
  netMovement: number
}

export interface PromoterVoucherEntry {
  id: string
  voucherId: string
  ledgerId: string
  date: string
  type: string
  number: string
  particulars: string
  amount: number
  debit: number
  credit: number
}

export interface PromotersReportData {
  companyId: string
  totalCapital: number
  openingCapital: number
  netMovement: number
  transactionCount: number
  ledgers: PromoterLedgerPosition[]
  entriesByLedger: Record<string, PromoterVoucherEntry[]>
}

export async function getPromotersReportData(companyId: string, from?: string, to?: string): Promise<PromotersReportData> {
  const client = createNeonDataApiClient()

  const activeMapping = await resolveActiveLedgers(companyId, 'PROMOTERS')
  const mappedIds = Array.from(activeMapping.activeLedgerIds)

  if (mappedIds.length === 0) {
    return {
      companyId,
      totalCapital: 0,
      openingCapital: 0,
      netMovement: 0,
      transactionCount: 0,
      ledgers: [],
      entriesByLedger: {}
    }
  }

  const dbLedgers: any[] = []
  const rawLines: any[] = []
  const chunkSize = 50

  for (let i = 0; i < mappedIds.length; i += chunkSize) {
    const chunkIds = mappedIds.slice(i, i + chunkSize)

    // Fetch ledgers for chunk
    const ledgersResult = await client
      .from('tb_ledgers')
      .select('id, name, opening_balance, closing_balance')
      .eq('company_id', companyId)
      .in('id', chunkIds)
      .eq('is_deleted', false)

    if (ledgersResult.error) {
      throw new Error(`Could not load Promoters ledgers: ${ledgersResult.error.message}`)
    }
    dbLedgers.push(...(ledgersResult.data ?? []))

    // Fetch voucher lines for chunk
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const linesQuery = client
        .from('tb_ledger_voucher_lines')
        .select('ledger_id,ledger_name,voucher_date,voucher_type,voucher_number,particulars,debit_amount,credit_amount,voucher_ledger_entry_id,voucher_id')
        .eq('company_id', companyId)
        .in('ledger_id', chunkIds)
        .order('voucher_date', { ascending: true })
        .order('voucher_ledger_entry_id', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (from) {
        linesQuery.gte('voucher_date', from)
      }
      if (to) {
        linesQuery.lte('voucher_date', to)
      }

      const linesResult = await linesQuery
      if (linesResult.error) {
        throw new Error(`Could not load Promoters voucher lines: ${linesResult.error.message}`)
      }

      const pageData = linesResult.data ?? []
      rawLines.push(...pageData)

      if (pageData.length < pageSize) {
        hasMore = false
      } else {
        page++
      }
    }
  }

  const ledgers: PromoterLedgerPosition[] = dbLedgers.map(l => {
    const lines = rawLines.filter(line => line.ledger_id === l.id)
    const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit_amount ?? 0), 0)
    const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit_amount ?? 0), 0)
    const net = totalCredit - totalDebit

    return {
      ledgerId: l.id,
      ledgerName: l.name,
      openingBalance: Number(l.opening_balance ?? 0),
      closingBalance: Number(l.closing_balance ?? 0),
      netMovement: net
    }
  })

  const entriesByLedger: Record<string, PromoterVoucherEntry[]> = {}
  for (const line of rawLines) {
    if (!line.ledger_id) continue
    const entries = entriesByLedger[line.ledger_id] ?? []
    const debit = Number(line.debit_amount ?? 0)
    const credit = Number(line.credit_amount ?? 0)

    entries.push({
      id: line.voucher_ledger_entry_id,
      voucherId: line.voucher_id,
      ledgerId: line.ledger_id,
      date: line.voucher_date,
      type: line.voucher_type,
      number: line.voucher_number,
      particulars: line.particulars ?? 'Unassigned',
      amount: credit - debit,
      debit,
      credit
    })
    entriesByLedger[line.ledger_id] = entries
  }

  const totalCapital = ledgers.reduce((sum, l) => sum + l.closingBalance, 0)
  const openingCapital = ledgers.reduce((sum, l) => sum + l.openingBalance, 0)
  const netMovement = ledgers.reduce((sum, l) => sum + l.netMovement, 0)

  return {
    companyId,
    totalCapital,
    openingCapital,
    netMovement,
    transactionCount: rawLines.length,
    ledgers,
    entriesByLedger
  }
}
// ─── Accounts Payable Report ───────────────────────────────────────────────

export interface AccountsPayableLedgerPosition {
  ledgerId: string
  ledgerName: string
  parentName: string
  debitBalance: number
  creditBalance: number
}

export interface AccountsPayableVoucherEntry {
  id: string
  voucherId: string
  ledgerId: string
  date: string
  type: string
  number: string
  particulars: string
  amount: number
  debit: number
  credit: number
}

export interface AccountsPayableReportData {
  companyId: string
  totalDebitBalance: number
  totalCreditBalance: number
  netBalance: number
  netNature: 'Dr' | 'Cr'
  ledgers: AccountsPayableLedgerPosition[]
  entriesByLedger: Record<string, AccountsPayableVoucherEntry[]>
}

export async function getAccountsPayableData(companyId: string, from?: string, to?: string): Promise<AccountsPayableReportData> {
  const client = createNeonDataApiClient()
  const activeMapping = await resolveActiveLedgers(companyId, 'ACCOUNTS_PAYABLE')
  const mappedIds = Array.from(activeMapping.activeLedgerIds)

  if (mappedIds.length === 0) {
    return {
      companyId,
      totalDebitBalance: 0,
      totalCreditBalance: 0,
      netBalance: 0,
      netNature: 'Dr',
      ledgers: [],
      entriesByLedger: {},
    }
  }

  const [ledgerResult, groupResult, balanceResult] = await Promise.all([
    client
      .from('tb_ledgers')
      .select('id,name,parent_name,parent_group_id')
      .eq('company_id', companyId)
      .eq('is_deleted', false),
    client
      .from('tb_ledger_groups')
      .select('id,name,parent_name,parent_group_id')
      .eq('company_id', companyId)
      .eq('is_deleted', false),
    client.rpc('tb_trial_balance', {
      target_company: companyId,
      from_date: from ?? null,
      to_date: to ?? null,
    }),
  ])

  const error = ledgerResult.error ?? groupResult.error ?? balanceResult.error
  if (error) {
    throw new Error(`Could not load Accounts Payable trial balance: ${error.message}`)
  }

  const balanceByLedgerId = new Map((balanceResult.data ?? []).map((row: any) => [row.ledger_id, row]))
  const mappedIdsSet = new Set(mappedIds)

  const ledgers: AccountsPayableLedgerPosition[] = (ledgerResult.data ?? [])
    .filter((l) => mappedIdsSet.has(l.id))
    .map((ledger): AccountsPayableLedgerPosition => {
      const row = balanceByLedgerId.get(ledger.id)
      const closingBalance = Number(row?.closing_balance ?? 0)
      return {
        ledgerId: ledger.id,
        ledgerName: row?.ledger_name ?? ledger.name,
        parentName: row?.parent_name ?? ledger.parent_name ?? 'Unassigned',
        debitBalance: row?.debit_balance == null ? Math.max(-closingBalance, 0) : Number(row.debit_balance),
        creditBalance: row?.credit_balance == null ? Math.max(closingBalance, 0) : Number(row.credit_balance),
      }
    })
    .sort((a, b) => a.parentName.localeCompare(b.parentName) || a.ledgerName.localeCompare(b.ledgerName))

  const totalDebitBalance = ledgers.reduce((sum, ledger) => sum + ledger.debitBalance, 0)
  const totalCreditBalance = ledgers.reduce((sum, ledger) => sum + ledger.creditBalance, 0)
  const difference = totalDebitBalance - totalCreditBalance

  // Fetch voucher lines in chunks to avoid HTTP URI limit issues
  const rawLines: any[] = []
  const chunkSize = 50
  for (let i = 0; i < mappedIds.length; i += chunkSize) {
    const chunkIds = mappedIds.slice(i, i + chunkSize)
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const linesQuery = client
        .from('tb_ledger_voucher_lines')
        .select('ledger_id,ledger_name,voucher_date,voucher_type,voucher_number,particulars,debit_amount,credit_amount,voucher_ledger_entry_id,voucher_id')
        .eq('company_id', companyId)
        .in('ledger_id', chunkIds)
        .order('voucher_date', { ascending: true })
        .order('voucher_ledger_entry_id', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (from) linesQuery.gte('voucher_date', from)
      if (to) linesQuery.lte('voucher_date', to)

      const linesResult = await linesQuery
      if (linesResult.error) {
        throw new Error(`Could not load Accounts Payable voucher lines: ${linesResult.error.message}`)
      }

      const pageData = linesResult.data ?? []
      rawLines.push(...pageData)

      if (pageData.length < pageSize) {
        hasMore = false
      } else {
        page++
      }
    }
  }

  const entriesByLedger: Record<string, AccountsPayableVoucherEntry[]> = {}
  for (const line of rawLines) {
    if (!line.ledger_id) continue
    const entries = entriesByLedger[line.ledger_id] ?? []
    const debit = Number(line.debit_amount ?? 0)
    const credit = Number(line.credit_amount ?? 0)
    entries.push({
      id: line.voucher_ledger_entry_id,
      voucherId: line.voucher_id,
      ledgerId: line.ledger_id,
      date: line.voucher_date,
      type: line.voucher_type,
      number: line.voucher_number,
      particulars: line.particulars ?? 'Unassigned',
      amount: credit - debit,
      debit,
      credit,
    })
    entriesByLedger[line.ledger_id] = entries
  }

  return {
    companyId,
    totalDebitBalance: Math.round((totalDebitBalance + Number.EPSILON) * 100) / 100,
    totalCreditBalance: Math.round((totalCreditBalance + Number.EPSILON) * 100) / 100,
    netBalance: Math.round((Math.abs(difference) + Number.EPSILON) * 100) / 100,
    netNature: difference >= 0 ? 'Dr' : 'Cr',
    ledgers,
    entriesByLedger,
  }
}

export interface OperatingExpenditureLedgerPosition {
  ledgerId: string
  ledgerName: string
  parentName: string
  openingBalance: number
  closingBalance: number
  netMovement: number
}

export interface OperatingExpenditureVoucherEntry {
  id: string
  voucherId: string
  ledgerId: string
  date: string
  type: string
  number: string
  particulars: string
  amount: number
  debit: number
  credit: number
}

export interface OperatingExpenditureReportData {
  companyId: string
  totalOpex: number
  openingOpex: number
  netMovement: number
  transactionCount: number
  ledgers: OperatingExpenditureLedgerPosition[]
  entriesByLedger: Record<string, OperatingExpenditureVoucherEntry[]>
}

export async function getOperatingExpenditureReportData(companyId: string, from?: string, to?: string): Promise<OperatingExpenditureReportData> {
  const client = createNeonDataApiClient()
  const activeMapping = await resolveActiveLedgers(companyId, 'OPEX')
  const mappedIds = Array.from(activeMapping.activeLedgerIds)

  if (mappedIds.length === 0) {
    return { companyId, totalOpex: 0, openingOpex: 0, netMovement: 0, transactionCount: 0, ledgers: [], entriesByLedger: {} }
  }

  // 1. Fetch ledgers and trial balance
  const [ledgerResult, balanceResult] = await Promise.all([
    client
      .from('tb_ledgers')
      .select('id,name,parent_name,parent_group_id')
      .eq('company_id', companyId)
      .eq('is_deleted', false),
    client.rpc('tb_trial_balance', {
      target_company: companyId,
      from_date: from ?? null,
      to_date: to ?? null,
    }),
  ])

  if (ledgerResult.error) {
    throw new Error(`Could not load Operating Expenditure ledgers: ${ledgerResult.error.message}`)
  }
  if (balanceResult.error) {
    throw new Error(`Could not load Operating Expenditure trial balance: ${balanceResult.error.message}`)
  }

  const balanceByLedgerId = new Map((balanceResult.data ?? []).map((row: any) => [row.ledger_id, row]))
  const mappedIdsSet = new Set(mappedIds)

  const ledgers: OperatingExpenditureLedgerPosition[] = (ledgerResult.data ?? [])
    .filter((l) => mappedIdsSet.has(l.id))
    .map((ledger): OperatingExpenditureLedgerPosition => {
      const row = balanceByLedgerId.get(ledger.id)
      const openingBalance = Number(row?.opening_balance ?? 0)
      const closingBalance = Number(row?.closing_balance ?? 0)
      return {
        ledgerId: ledger.id,
        ledgerName: row?.ledger_name ?? ledger.name,
        parentName: row?.parent_name ?? ledger.parent_name ?? 'Unassigned',
        openingBalance,
        closingBalance,
        netMovement: closingBalance - openingBalance,
      }
    })
    .sort((a, b) => a.parentName.localeCompare(b.parentName) || a.ledgerName.localeCompare(b.ledgerName))

  // 2. Fetch voucher lines in chunks to avoid HTTP URI limit issues
  const rawLines: any[] = []
  const chunkSize = 50
  for (let i = 0; i < mappedIds.length; i += chunkSize) {
    const chunkIds = mappedIds.slice(i, i + chunkSize)
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const linesQuery = client
        .from('tb_ledger_voucher_lines')
        .select('ledger_id,ledger_name,voucher_date,voucher_type,voucher_number,particulars,debit_amount,credit_amount,voucher_ledger_entry_id,voucher_id')
        .eq('company_id', companyId)
        .in('ledger_id', chunkIds)
        .order('voucher_date', { ascending: true })
        .order('voucher_ledger_entry_id', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (from) linesQuery.gte('voucher_date', from)
      if (to) linesQuery.lte('voucher_date', to)

      const linesResult = await linesQuery
      if (linesResult.error) {
        throw new Error(`Could not load Operating Expenditure voucher lines: ${linesResult.error.message}`)
      }

      const pageData = linesResult.data ?? []
      rawLines.push(...pageData)

      if (pageData.length < pageSize) {
        hasMore = false
      } else {
        page++
      }
    }
  }

  const entriesByLedger: Record<string, OperatingExpenditureVoucherEntry[]> = {}
  for (const line of rawLines) {
    if (!line.ledger_id) continue
    const entries = entriesByLedger[line.ledger_id] ?? []
    const debit = Number(line.debit_amount ?? 0)
    const credit = Number(line.credit_amount ?? 0)
    entries.push({
      id: line.voucher_ledger_entry_id,
      voucherId: line.voucher_id,
      ledgerId: line.ledger_id,
      date: line.voucher_date,
      type: line.voucher_type,
      number: line.voucher_number,
      particulars: line.particulars ?? 'Unassigned',
      amount: debit - credit,
      debit,
      credit,
    })
    entriesByLedger[line.ledger_id] = entries
  }

  const totalOpex = ledgers.reduce((s, l) => s + l.closingBalance, 0)
  const openingOpex = ledgers.reduce((s, l) => s + l.openingBalance, 0)
  const netMovement = totalOpex - openingOpex

  return {
    companyId,
    totalOpex: Math.round((totalOpex + Number.EPSILON) * 100) / 100,
    openingOpex: Math.round((openingOpex + Number.EPSILON) * 100) / 100,
    netMovement: Math.round((netMovement + Number.EPSILON) * 100) / 100,
    transactionCount: rawLines.length,
    ledgers,
    entriesByLedger,
  }
}

export interface CapitalExpenditureLedgerPosition {
  ledgerId: string
  ledgerName: string
  parentName: string
  openingBalance: number
  closingBalance: number
  netMovement: number
  category: string | null
}

export interface CapitalExpenditureVoucherEntry {
  id: string
  voucherId: string
  ledgerId: string
  ledgerName: string
  date: string
  type: string
  number: string | null
  particulars: string
  amount: number
  debit: number
  credit: number
}

export interface CapitalExpenditureReportData {
  companyId: string
  totalCapex: number
  openingCapex: number
  netMovement: number
  transactionCount: number
  ledgers: CapitalExpenditureLedgerPosition[]
  entriesByLedger: Record<string, CapitalExpenditureVoucherEntry[]>
}

function getCapexBlock(ledgerName: string, parentName?: string): string {
  const name = ledgerName.toLowerCase()
  const parent = (parentName || '').toLowerCase()

  if (name.includes('furniture') || parent.includes('furniture')) return 'A'
  if (name.includes('machinery') || name.includes('plant') || parent.includes('machinery') || parent.includes('plant')) {
    if (name.includes('land') || name.includes('govt. charges') || name.includes('govt charges')) return 'C'
    return 'B'
  }
  if (name.includes('land') || parent.includes('land')) return 'C'
  if (name.includes('office') || parent.includes('office')) return 'D'
  if (name.includes('computer') || name.includes('laptop') || name.includes('software') || parent.includes('computer') || parent.includes('laptop')) return 'E'
  if (name.includes('building') || name.includes('construction') || parent.includes('building')) return 'F'
  if (name.includes('electrical') || parent.includes('electrical')) return 'N'
  return 'OTHER'
}

export async function getCapitalExpenditureReportData(companyId: string, from?: string, to?: string): Promise<CapitalExpenditureReportData> {
  const client = createNeonDataApiClient()
  const activeMapping = await resolveActiveLedgers(companyId, 'CAPEX')
  const mappedIds = Array.from(activeMapping.activeLedgerIds)

  if (mappedIds.length === 0) {
    return { companyId, totalCapex: 0, openingCapex: 0, netMovement: 0, transactionCount: 0, ledgers: [], entriesByLedger: {} }
  }

  // 1. Fetch ledgers and trial balance
  const [ledgerResult, balanceResult] = await Promise.all([
    client
      .from('tb_ledgers')
      .select('id,name,parent_name,parent_group_id')
      .eq('company_id', companyId)
      .eq('is_deleted', false),
    client.rpc('tb_trial_balance', {
      target_company: companyId,
      from_date: from ?? null,
      to_date: to ?? null,
    }),
  ])

  if (ledgerResult.error) {
    throw new Error(`Could not load Capital Expenditure ledgers: ${ledgerResult.error.message}`)
  }
  if (balanceResult.error) {
    throw new Error(`Could not load Capital Expenditure trial balance: ${balanceResult.error.message}`)
  }

  const balanceByLedgerId = new Map((balanceResult.data ?? []).map((row: any) => [row.ledger_id, row]))
  const mappedIdsSet = new Set(mappedIds)

  const ledgers: CapitalExpenditureLedgerPosition[] = (ledgerResult.data ?? [])
    .filter((l) => mappedIdsSet.has(l.id))
    .map((ledger): CapitalExpenditureLedgerPosition => {
      const row = balanceByLedgerId.get(ledger.id)
      const openingBalance = -Number(row?.opening_balance ?? 0)
      const closingBalance = -Number(row?.closing_balance ?? 0)
      const ledgerName = row?.ledger_name ?? ledger.name
      const parentName = row?.parent_name ?? ledger.parent_name ?? 'Unassigned'
      return {
        ledgerId: ledger.id,
        ledgerName,
        parentName,
        openingBalance,
        closingBalance,
        netMovement: closingBalance - openingBalance,
        category: getCapexBlock(ledgerName, parentName),
      }
    })
    .sort((a, b) => a.parentName.localeCompare(b.parentName) || a.ledgerName.localeCompare(b.ledgerName))

  // 2. Fetch voucher lines in chunks to avoid HTTP URI limit issues
  const rawLines: any[] = []
  const chunkSize = 50
  for (let i = 0; i < mappedIds.length; i += chunkSize) {
    const chunkIds = mappedIds.slice(i, i + chunkSize)
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const linesQuery = client
        .from('tb_ledger_voucher_lines')
        .select('ledger_id,ledger_name,voucher_date,voucher_type,voucher_number,particulars,debit_amount,credit_amount,voucher_ledger_entry_id,voucher_id')
        .eq('company_id', companyId)
        .in('ledger_id', chunkIds)
        .order('voucher_date', { ascending: true })
        .order('voucher_ledger_entry_id', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (from) linesQuery.gte('voucher_date', from)
      if (to) linesQuery.lte('voucher_date', to)

      const linesResult = await linesQuery
      if (linesResult.error) {
        throw new Error(`Could not load Capital Expenditure voucher lines: ${linesResult.error.message}`)
      }

      const pageData = linesResult.data ?? []
      rawLines.push(...pageData)

      if (pageData.length < pageSize) {
        hasMore = false
      } else {
        page++
      }
    }
  }

  const entriesByLedger: Record<string, CapitalExpenditureVoucherEntry[]> = {}
  for (const line of rawLines) {
    if (!line.ledger_id) continue
    const entries = entriesByLedger[line.ledger_id] ?? []
    const debit = Number(line.debit_amount ?? 0)
    const credit = Number(line.credit_amount ?? 0)
    entries.push({
      id: line.voucher_ledger_entry_id,
      voucherId: line.voucher_id,
      ledgerId: line.ledger_id,
      ledgerName: line.ledger_name ?? 'Unassigned',
      date: line.voucher_date,
      type: line.voucher_type,
      number: line.voucher_number,
      particulars: line.particulars ?? 'Unassigned',
      amount: debit - credit,
      debit,
      credit,
    })
    entriesByLedger[line.ledger_id] = entries
  }

  const totalCapex = ledgers.reduce((s, l) => s + l.closingBalance, 0)
  const openingCapex = ledgers.reduce((s, l) => s + l.openingBalance, 0)
  const netMovement = totalCapex - openingCapex

  return {
    companyId,
    totalCapex: Math.round((totalCapex + Number.EPSILON) * 100) / 100,
    openingCapex: Math.round((openingCapex + Number.EPSILON) * 100) / 100,
    netMovement: Math.round((netMovement + Number.EPSILON) * 100) / 100,
    transactionCount: rawLines.length,
    ledgers,
    entriesByLedger,
  }
}

export interface DetailedFundsFlowItem {
  key: string
  name: string
  refCode: string
  openingBalance: number
  closingBalance: number
  netMovement: number
  ledgerIds: string[]
}

export interface DetailedFundsFlowSection {
  title: string
  items: DetailedFundsFlowItem[]
  totalOpening: number
  totalClosing: number
  totalMovement: number
}

export interface DetailedFundsFlowReportData {
  companyId: string
  leftColumn: DetailedFundsFlowSection[]
  rightColumn: DetailedFundsFlowSection[]
  allVouchersByRefCode: Record<string, CapitalExpenditureVoucherEntry[]>
}

export async function getDetailedFundsFlowReportData(companyId: string, from?: string, to?: string): Promise<DetailedFundsFlowReportData> {
  const client = createNeonDataApiClient()

  // 1. Resolve active mappings for all 6 reports
  const [capexMap, apMap, opexMap, promotersMap, gstMap, tdsMap] = await Promise.all([
    resolveActiveLedgers(companyId, 'CAPEX'),
    resolveActiveLedgers(companyId, 'ACCOUNTS_PAYABLE'),
    resolveActiveLedgers(companyId, 'OPEX'),
    resolveActiveLedgers(companyId, 'PROMOTERS'),
    resolveActiveLedgers(companyId, 'GST'),
    resolveActiveLedgers(companyId, 'TDS'),
  ])

  const capexIds = Array.from(capexMap.activeLedgerIds)
  const apIds = Array.from(apMap.activeLedgerIds)
  const opexIds = Array.from(opexMap.activeLedgerIds)
  const promoterIds = Array.from(promotersMap.activeLedgerIds)
  const gstIds = Array.from(gstMap.activeLedgerIds)
  const tdsIds = Array.from(tdsMap.activeLedgerIds)

  // 2. Fetch all trial balances
  const [ledgerResult, balanceResult] = await Promise.all([
    client
      .from('tb_ledgers')
      .select('id,name,parent_name,parent_group_id')
      .eq('company_id', companyId)
      .eq('is_deleted', false),
    client.rpc('tb_trial_balance', {
      target_company: companyId,
      from_date: from ?? null,
      to_date: to ?? null,
    }),
  ])

  if (ledgerResult.error) throw new Error(`Could not load ledgers: ${ledgerResult.error.message}`)
  if (balanceResult.error) throw new Error(`Could not load trial balance: ${balanceResult.error.message}`)

  const balanceByLedgerId = new Map((balanceResult.data ?? []).map((row: any) => [row.ledger_id, row]))
  const allLedgers = ledgerResult.data ?? []

  // Helper to extract balances
  const getLedgerBalances = (ledgerId: string, invert: boolean = false) => {
    const row = balanceByLedgerId.get(ledgerId)
    const sign = invert ? -1 : 1
    const opening = Number(row?.opening_balance ?? 0) * sign
    const closing = Number(row?.closing_balance ?? 0) * sign
    return {
      opening,
      closing,
      movement: closing - opening,
      name: row?.ledger_name || allLedgers.find((l) => l.id === ledgerId)?.name || 'Unassigned',
      parentName: row?.parent_name || allLedgers.find((l) => l.id === ledgerId)?.parent_name || 'Unassigned',
    }
  }

  // ── 1. TDS COMPLIANCE (Inverted sign, Debit = Receivable T2, Credit = Payable T1) ──
  let tdsPayableOpening = 0, tdsPayableClosing = 0
  let tdsReceivableOpening = 0, tdsReceivableClosing = 0
  const tdsPayableIds: string[] = []
  const tdsReceivableIds: string[] = []

  for (const id of tdsIds) {
    const row = balanceByLedgerId.get(id)
    const opening = Number(row?.opening_balance ?? 0)
    const closing = Number(row?.closing_balance ?? 0)

    if (closing > 0) { // Credit balance = payable liability
      tdsPayableOpening += opening
      tdsPayableClosing += closing
      tdsPayableIds.push(id)
    } else { // Debit balance = receivable asset
      tdsReceivableOpening += -opening
      tdsReceivableClosing += -closing
      tdsReceivableIds.push(id)
    }
  }

  const tdsItems: DetailedFundsFlowItem[] = []
  if (tdsIds.length > 0) {
    tdsItems.push({
      key: 'tds-payable',
      name: '-----TDS Payable',
      refCode: 'T1',
      openingBalance: tdsPayableOpening,
      closingBalance: tdsPayableClosing,
      netMovement: tdsPayableClosing - tdsPayableOpening,
      ledgerIds: tdsPayableIds,
    })
    tdsItems.push({
      key: 'tds-receivable',
      name: '-----TDS Receivable',
      refCode: 'T2',
      openingBalance: tdsReceivableOpening,
      closingBalance: tdsReceivableClosing,
      netMovement: tdsReceivableClosing - tdsReceivableOpening,
      ledgerIds: tdsReceivableIds,
    })
  }

  // ── 2. OPERATING EXPENDITURE (Inverted sign, debit = positive expense) ──
  let opexSalaryOpening = 0, opexSalaryClosing = 0
  let opexJammuOpening = 0, opexJammuClosing = 0
  let opexRajasthanOpening = 0, opexRajasthanClosing = 0
  let opexCwipOpening = 0, opexCwipClosing = 0
  let opexOtherOpening = 0, opexOtherClosing = 0

  const opexSalaryIds: string[] = []
  const opexJammuIds: string[] = []
  const opexRajasthanIds: string[] = []
  const opexCwipIds: string[] = []
  const opexOtherIds: string[] = []

  for (const id of opexIds) {
    const bal = getLedgerBalances(id, true)
    const nameLower = bal.name.toLowerCase()
    const parentLower = bal.parentName.toLowerCase()

    if (nameLower.includes('salary') || nameLower.includes('wages') || nameLower.includes('employee') || parentLower.includes('salary') || parentLower.includes('wages')) {
      opexSalaryOpening += bal.opening
      opexSalaryClosing += bal.closing
      opexSalaryIds.push(id)
    } else if (nameLower.includes('jammu') || parentLower.includes('jammu')) {
      opexJammuOpening += bal.opening
      opexJammuClosing += bal.closing
      opexJammuIds.push(id)
    } else if (nameLower.includes('rajasthan') || parentLower.includes('rajasthan')) {
      if (nameLower.includes('cwip')) {
        opexCwipOpening += bal.opening
        opexCwipClosing += bal.closing
        opexCwipIds.push(id)
      } else {
        opexRajasthanOpening += bal.opening
        opexRajasthanClosing += bal.closing
        opexRajasthanIds.push(id)
      }
    } else if (nameLower.includes('cwip') || parentLower.includes('cwip')) {
      opexCwipOpening += bal.opening
      opexCwipClosing += bal.closing
      opexCwipIds.push(id)
    } else {
      opexOtherOpening += bal.opening
      opexOtherClosing += bal.closing
      opexOtherIds.push(id)
    }
  }

  const opexItems: DetailedFundsFlowItem[] = []
  if (opexIds.length > 0) {
    opexItems.push({
      key: 'opex-salary',
      name: '-----Salaries & Wages Due',
      refCode: '-',
      openingBalance: opexSalaryOpening,
      closingBalance: opexSalaryClosing,
      netMovement: opexSalaryClosing - opexSalaryOpening,
      ledgerIds: opexSalaryIds,
    })
    opexItems.push({
      key: 'opex-jammu',
      name: '-----Other Expense(Jammu)',
      refCode: 'I',
      openingBalance: opexJammuOpening,
      closingBalance: opexJammuClosing,
      netMovement: opexJammuClosing - opexJammuOpening,
      ledgerIds: opexJammuIds,
    })
    opexItems.push({
      key: 'opex-rajasthan',
      name: '-----Other Expense(Rajasthan)',
      refCode: 'I1',
      openingBalance: opexRajasthanOpening,
      closingBalance: opexRajasthanClosing,
      netMovement: opexRajasthanClosing - opexRajasthanOpening,
      ledgerIds: opexRajasthanIds,
    })
    opexItems.push({
      key: 'opex-others',
      name: '-----Others',
      refCode: 'J',
      openingBalance: opexOtherOpening,
      closingBalance: opexOtherClosing,
      netMovement: opexOtherClosing - opexOtherOpening,
      ledgerIds: opexOtherIds,
    })
    opexItems.push({
      key: 'opex-cwip',
      name: '-----CWIP Expense (Rajasthan)',
      refCode: '-',
      openingBalance: opexCwipOpening,
      closingBalance: opexCwipClosing,
      netMovement: opexCwipClosing - opexCwipOpening,
      ledgerIds: opexCwipIds,
    })
  }

  // ── 3. ACCOUNTS PAYABLE (Credits = positive liability, Debits = negative/advance) ──
  let apAdvanceOpening = 0, apAdvanceClosing = 0
  let apOutstandingOpening = 0, apOutstandingClosing = 0
  const apAdvanceLedgerIds: string[] = []
  const apOutstandingLedgerIds: string[] = []

  for (const id of apIds) {
    const row = balanceByLedgerId.get(id)
    const opening = Number(row?.opening_balance ?? 0)
    const closing = Number(row?.closing_balance ?? 0)

    if (closing < 0) {
      apAdvanceOpening += -opening
      apAdvanceClosing += -closing
      apAdvanceLedgerIds.push(id)
    } else {
      apOutstandingOpening += opening
      apOutstandingClosing += closing
      apOutstandingLedgerIds.push(id)
    }
  }

  const apItems: DetailedFundsFlowItem[] = []
  if (apIds.length > 0) {
    apItems.push({
      key: 'ap-advance',
      name: '-----Advance to Supplier',
      refCode: 'H',
      openingBalance: apAdvanceOpening,
      closingBalance: apAdvanceClosing,
      netMovement: apAdvanceClosing - apAdvanceOpening,
      ledgerIds: apAdvanceLedgerIds,
    })
    apItems.push({
      key: 'ap-outstanding',
      name: '-----Vendor Outstanding',
      refCode: 'H1',
      openingBalance: apOutstandingOpening,
      closingBalance: apOutstandingClosing,
      netMovement: apOutstandingClosing - apOutstandingOpening,
      ledgerIds: apOutstandingLedgerIds,
    })
  }

  // ── 4. CAPITAL EXPENDITURE (Inverted sign, debit = positive, grouped by parent group) ──
  const capexGroupMap = new Map<string, {
    name: string
    opening: number
    closing: number
    movement: number
    ledgerIds: string[]
  }>()

  for (const id of capexIds) {
    const bal = getLedgerBalances(id, true)
    const parent = bal.parentName || 'Unassigned'
    const current = capexGroupMap.get(parent) ?? {
      name: parent,
      opening: 0,
      closing: 0,
      movement: 0,
      ledgerIds: [] as string[],
    }
    current.opening += bal.opening
    current.closing += bal.closing
    current.movement += bal.movement
    current.ledgerIds.push(id)
    capexGroupMap.set(parent, current)
  }

  const capexItems: DetailedFundsFlowItem[] = []
  for (const [parentName, g] of capexGroupMap.entries()) {
    const ref = getCapexBlock(parentName, parentName)
    capexItems.push({
      key: `capex-${parentName}`,
      name: `-----${parentName}`,
      refCode: ref === 'OTHER' ? '-' : ref,
      openingBalance: g.opening,
      closingBalance: g.closing,
      netMovement: g.movement,
      ledgerIds: g.ledgerIds,
    })
  }

  // Sort Capital Expenditure groups
  capexItems.sort((a, b) => {
    if (a.refCode === '-' && b.refCode !== '-') return 1
    if (a.refCode !== '-' && b.refCode === '-') return -1
    return a.refCode.localeCompare(b.refCode) || a.name.localeCompare(b.name)
  })

  // ── 5. PROMOTERS (Credits = positive liability/equity) ──────────────────
  const promoterItems: DetailedFundsFlowItem[] = []
  let shareCapitalOpening = 0, shareCapitalClosing = 0
  const shareCapitalIds: string[] = []

  for (const id of promoterIds) {
    const bal = getLedgerBalances(id, false)
    const nameLower = bal.name.toLowerCase()
    if (nameLower.includes('share capital') || nameLower.includes('equity') || nameLower.includes('sharecapital')) {
      shareCapitalOpening += bal.opening
      shareCapitalClosing += bal.closing
      shareCapitalIds.push(id)
    } else {
      promoterItems.push({
        key: `promoter-${id}`,
        name: `-------${bal.name}`,
        refCode: 'K',
        openingBalance: bal.opening,
        closingBalance: bal.closing,
        netMovement: bal.movement,
        ledgerIds: [id],
      })
    }
  }

  if (shareCapitalIds.length > 0) {
    promoterItems.push({
      key: 'share-capital',
      name: '-------Share capital Introduced',
      refCode: '-',
      openingBalance: shareCapitalOpening,
      closingBalance: shareCapitalClosing,
      netMovement: shareCapitalClosing - shareCapitalOpening,
      ledgerIds: shareCapitalIds,
    })
  }

  // ── 6. DUTIES & TAXES GST (Debit = Input G1, Credit = Output G2) ──
  let gstInputOpening = 0, gstInputClosing = 0
  let gstOutputOpening = 0, gstOutputClosing = 0
  const gstInputIds: string[] = []
  const gstOutputIds: string[] = []

  for (const id of gstIds) {
    const row = balanceByLedgerId.get(id)
    const opening = Number(row?.opening_balance ?? 0)
    const closing = Number(row?.closing_balance ?? 0)

    const isOutput = row?.ledger_name?.toLowerCase().includes('output') || row?.ledger_name?.toLowerCase().includes('cgst @') || row?.ledger_name?.toLowerCase().includes('sgst @') || row?.ledger_name?.toLowerCase().includes('igst @')

    if (!isOutput) { // input credit is debit-natured
      gstInputOpening += -opening
      gstInputClosing += -closing
      gstInputIds.push(id)
    } else { // output liability is credit-natured
      gstOutputOpening += opening
      gstOutputClosing += closing
      gstOutputIds.push(id)
    }
  }

  const gstItems: DetailedFundsFlowItem[] = []
  if (gstIds.length > 0) {
    gstItems.push({
      key: 'gst-input',
      name: '-----GST Input Tax Credit',
      refCode: 'G1',
      openingBalance: gstInputOpening,
      closingBalance: gstInputClosing,
      netMovement: gstInputClosing - gstInputOpening,
      ledgerIds: gstInputIds,
    })
    gstItems.push({
      key: 'gst-output',
      name: '-----GST Output Liability',
      refCode: 'G2',
      openingBalance: gstOutputOpening,
      closingBalance: gstOutputClosing,
      netMovement: gstOutputClosing - gstOutputOpening,
      ledgerIds: gstOutputIds,
    })
  }

  // Helper to check if an item has active balances
  const hasBalance = (item: DetailedFundsFlowItem) => {
    return Math.abs(item.openingBalance) >= 0.01 || Math.abs(item.closingBalance) >= 0.01 || Math.abs(item.netMovement) >= 0.01
  }

  // Filter out empty items dynamically
  const activeCapexItems = capexItems.filter(hasBalance)
  const activePromoterItems = promoterItems.filter(hasBalance)
  const activeTdsItems = tdsItems.filter(hasBalance)
  const activeOpexItems = opexItems.filter(hasBalance)
  const activeApItems = apItems.filter(hasBalance)
  const activeGstItems = gstItems.filter(hasBalance)

  // Dynamically assign sequential reference codes (A1, A2, B1, B2 etc.)
  activeCapexItems.forEach((item, index) => {
    item.refCode = `A${index + 1}`
  })
  activePromoterItems.forEach((item, index) => {
    item.refCode = `B${index + 1}`
  })
  activeTdsItems.forEach((item, index) => {
    item.refCode = `C${index + 1}`
  })
  activeOpexItems.forEach((item, index) => {
    item.refCode = `D${index + 1}`
  })
  activeApItems.forEach((item, index) => {
    item.refCode = `E${index + 1}`
  })
  activeGstItems.forEach((item, index) => {
    item.refCode = `F${index + 1}`
  })

  // Assemble Left and Right Columns
  const leftColumn: DetailedFundsFlowSection[] = [
    {
      title: 'Capital Expenditure',
      items: activeCapexItems,
      totalOpening: activeCapexItems.reduce((s, i) => s + i.openingBalance, 0),
      totalClosing: activeCapexItems.reduce((s, i) => s + i.closingBalance, 0),
      totalMovement: activeCapexItems.reduce((s, i) => s + i.netMovement, 0),
    },
    {
      title: 'Promoters Report',
      items: activePromoterItems,
      totalOpening: activePromoterItems.reduce((s, i) => s + i.openingBalance, 0),
      totalClosing: activePromoterItems.reduce((s, i) => s + i.closingBalance, 0),
      totalMovement: activePromoterItems.reduce((s, i) => s + i.netMovement, 0),
    },
  ]

  const rightColumn: DetailedFundsFlowSection[] = [
    {
      title: 'TDS Compliance Report',
      items: activeTdsItems,
      totalOpening: activeTdsItems.reduce((s, i) => s + i.openingBalance, 0),
      totalClosing: activeTdsItems.reduce((s, i) => s + i.closingBalance, 0),
      totalMovement: activeTdsItems.reduce((s, i) => s + i.netMovement, 0),
    },
    {
      title: 'Operating Expenditure',
      items: activeOpexItems,
      totalOpening: activeOpexItems.reduce((s, i) => s + i.openingBalance, 0),
      totalClosing: activeOpexItems.reduce((s, i) => s + i.closingBalance, 0),
      totalMovement: activeOpexItems.reduce((s, i) => s + i.netMovement, 0),
    },
    {
      title: 'Accounts Payable',
      items: activeApItems,
      totalOpening: activeApItems.reduce((s, i) => s + i.openingBalance, 0),
      totalClosing: activeApItems.reduce((s, i) => s + i.closingBalance, 0),
      totalMovement: activeApItems.reduce((s, i) => s + i.netMovement, 0),
    },
    {
      title: 'Duties & Taxes GST',
      items: activeGstItems,
      totalOpening: activeGstItems.reduce((s, i) => s + i.openingBalance, 0),
      totalClosing: activeGstItems.reduce((s, i) => s + i.closingBalance, 0),
      totalMovement: activeGstItems.reduce((s, i) => s + i.netMovement, 0),
    },
  ]

  // 3. Fetch transaction vouchers for all mapped ledgers and categorize by Ref Code
  const allLedgerIds = [
    ...capexIds,
    ...apIds,
    ...opexIds,
    ...promoterIds,
    ...gstIds,
    ...tdsIds,
  ]

  const rawLines: any[] = []
  if (allLedgerIds.length > 0) {
    const chunkSize = 50
    for (let i = 0; i < allLedgerIds.length; i += chunkSize) {
      const chunkIds = allLedgerIds.slice(i, i + chunkSize)
      let page = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const linesQuery = client
          .from('tb_ledger_voucher_lines')
          .select('ledger_id,ledger_name,voucher_date,voucher_type,voucher_number,particulars,debit_amount,credit_amount,voucher_ledger_entry_id,voucher_id')
          .eq('company_id', companyId)
          .in('ledger_id', chunkIds)
          .order('voucher_date', { ascending: true })
          .order('voucher_ledger_entry_id', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (from) linesQuery.gte('voucher_date', from)
        if (to) linesQuery.lte('voucher_date', to)

        const linesResult = await linesQuery
        if (linesResult.error) throw new Error(`Could not load voucher lines: ${linesResult.error.message}`)

        const pageData = linesResult.data ?? []
        rawLines.push(...pageData)

        if (pageData.length < pageSize) hasMore = false
        else page++
      }
    }
  }

  // Helper map from ledgerId to Ref Code
  const ledgerIdToRefCode = new Map<string, string>()
  const setRef = (id: string, ref: string) => {
    if (ref !== '-') ledgerIdToRefCode.set(id, ref)
  }

  for (const item of [...activeCapexItems, ...activeApItems, ...activeOpexItems, ...activePromoterItems, ...activeGstItems, ...activeTdsItems]) {
    for (const lid of item.ledgerIds) {
      setRef(lid, item.refCode)
    }
  }

  const allVouchersByRefCode: Record<string, CapitalExpenditureVoucherEntry[]> = {}
  for (const line of rawLines) {
    if (!line.ledger_id) continue
    const ref = ledgerIdToRefCode.get(line.ledger_id) || '-'
    const entries = allVouchersByRefCode[ref] ?? []
    const debit = Number(line.debit_amount ?? 0)
    const credit = Number(line.credit_amount ?? 0)

    entries.push({
      id: line.voucher_ledger_entry_id,
      voucherId: line.voucher_id,
      ledgerId: line.ledger_id,
      ledgerName: line.ledger_name ?? 'Unassigned',
      date: line.voucher_date,
      type: line.voucher_type,
      number: line.voucher_number,
      particulars: line.particulars ?? 'Unassigned',
      amount: debit - credit,
      debit,
      credit,
    })
    allVouchersByRefCode[ref] = entries
  }

  return {
    companyId,
    leftColumn,
    rightColumn,
    allVouchersByRefCode,
  }
}

