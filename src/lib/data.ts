import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Company, DashboardData, HistoryCoverage, Ledger, LedgerMonthlyData, Organization, TrialBalanceData, TrialBalanceLedgerRow, VoucherLine, FundsFlowData, FundsFlowGroup, FundsFlowSubgroup, FundsFlowEntry, FundsFlowSummary } from '@/lib/types'

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
  const supabase = await createSupabaseServerClient()
  
  // 1. Get history coverage limits
  const coverageResult = await supabase.rpc('tb_history_coverage', { target_company: companyId })
  if (coverageResult.error) throw new Error(`Could not load history coverage: ${coverageResult.error.message}`)
  const history = historyCoverage(coverageResult.data?.[0], from, to)
  
  // Get sync status
  const [syncResult, companyResult] = await Promise.all([
    supabase.from('tb_company_sync_state').select('last_error,last_voucher_sync_at,last_ledger_sync_at').eq('company_id', companyId).maybeSingle(),
    supabase.from('tb_companies').select('name,last_sync_status,last_sync_error,last_successful_sync_at').eq('id', companyId).maybeSingle(),
  ])
  if (syncResult.error || companyResult.error) throw new Error('Could not load sync status')
  const syncError = syncResult.data?.last_error ?? companyResult.data?.last_sync_error ?? null
  const lastSyncedAt = companyResult.data?.last_successful_sync_at ?? syncResult.data?.last_voucher_sync_at ?? null
  const sync = { status: syncError ? 'error' : lastSyncedAt ? 'synced' : null, lastSyncedAt, error: syncError }

  const fromDate = from ?? history.baselineDate ?? '1970-01-01'
  const toDate = to || null

  // 2. Query Trial Balance closing balances (to map ledgers to their parent groups)
  const balanceResult = await supabase.rpc('tb_trial_balance', { target_company: companyId, from_date: null, to_date: toDate })
  if (balanceResult.error) throw new Error(`Could not load Trial Balance for report: ${balanceResult.error.message}`)
  const rawBalances = balanceResult.data ?? []

  // Override closing balances with the synced closing_balance column from tb_ledgers table when toDate is null or >= lastSyncedAt (latest state)
  const isLatest = !toDate || (lastSyncedAt && new Date(toDate) >= new Date(lastSyncedAt))
  if (isLatest) {
    const { data: activeLedgers } = await supabase
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
    const linesQuery = supabase
      .from('tb_ledger_voucher_lines')
      .select('ledger_id,ledger_name,voucher_date,voucher_type,voucher_number,particulars,debit_amount,credit_amount,voucher_ledger_entry_id')
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

  // Dynamic Grouping Map: Primary Group -> Subgroup -> Subgroup Data
  interface SubgroupDataAccumulator {
    ledgers: { ledgerName: string; closingBalance: number; ledgerId?: string }[]
    voucherLines: FundsFlowEntry[]
  }
  
  const primaryGroupsMap = new Map<string, Map<string, SubgroupDataAccumulator>>()

  // 1. Initialize Subgroups and Ledgers from rawBalances (to capture all subgroups with active closing balances)
  for (const b of rawBalances) {
    const subGroupRaw = b.parent_name || 'Unassigned'
    const subGroup = formatGroupName(subGroupRaw)
    const primaryGroup = getPrimaryGroupForSubgroup(subGroupRaw)
    
    if (!primaryGroupsMap.has(primaryGroup)) {
      primaryGroupsMap.set(primaryGroup, new Map())
    }
    const subMap = primaryGroupsMap.get(primaryGroup)!
    if (!subMap.has(subGroup)) {
      subMap.set(subGroup, { ledgers: [], voucherLines: [] })
    }
    
    subMap.get(subGroup)!.ledgers.push({
      ledgerName: b.ledger_name || 'Unknown Ledger',
      closingBalance: asNumber(b.closing_balance),
      ledgerId: b.ledger_id || undefined
    })
  }

  // 2. Incorporate Voucher Lines into existing or new subgroups
  for (const l of rawLines) {
    const subGroupRaw = getParentGroup(l.ledger_name, l.ledger_id)
    const subGroup = formatGroupName(subGroupRaw)
    const primaryGroup = getPrimaryGroupForSubgroup(subGroupRaw)
    
    const entry: FundsFlowEntry = {
      date: l.voucher_date,
      particulars: l.particulars ?? '',
      nature: l.ledger_name,
      debit: asNumber(l.debit_amount),
      credit: asNumber(l.credit_amount),
      amount: asNumber(l.debit_amount) - asNumber(l.credit_amount)
    }
    
    if (!primaryGroupsMap.has(primaryGroup)) {
      primaryGroupsMap.set(primaryGroup, new Map())
    }
    const subMap = primaryGroupsMap.get(primaryGroup)!
    if (!subMap.has(subGroup)) {
      subMap.set(subGroup, { ledgers: [], voucherLines: [] })
    }
    
    subMap.get(subGroup)!.voucherLines.push(entry)
  }

  const groups: FundsFlowGroup[] = []
  
  for (const [primaryName, subMap] of primaryGroupsMap.entries()) {
    const subgroupsList: FundsFlowSubgroup[] = []
    let groupDebitTotal = 0
    let groupCreditTotal = 0
    let groupClosingBalance = 0
    
    for (const [subName, acc] of subMap.entries()) {
      const debitTotal = acc.voucherLines.reduce((sum, item) => sum + (item.debit ?? 0), 0)
      const creditTotal = acc.voucherLines.reduce((sum, item) => sum + (item.credit ?? 0), 0)
      const closingBalance = acc.ledgers.reduce((sum, item) => sum + item.closingBalance, 0)
      
      acc.ledgers.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName))
      
      subgroupsList.push({
        subgroupName: subName,
        debitTotal,
        creditTotal,
        netMovement: creditTotal - debitTotal,
        closingBalance,
        ledgers: acc.ledgers,
        voucherLines: acc.voucherLines
      })
      
      groupDebitTotal += debitTotal
      groupCreditTotal += creditTotal
      groupClosingBalance += closingBalance
    }
    
    subgroupsList.sort((a, b) => a.subgroupName.localeCompare(b.subgroupName))
    
    // Only show groups that have active transactions or non-zero closing balances
    if (Math.abs(groupClosingBalance) > 0.005 || Math.abs(groupDebitTotal) > 0.005 || Math.abs(groupCreditTotal) > 0.005) {
      groups.push({
        groupName: primaryName,
        debitTotal: groupDebitTotal,
        creditTotal: groupCreditTotal,
        netMovement: groupCreditTotal - groupDebitTotal,
        subgroups: subgroupsList
      })
    }
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
