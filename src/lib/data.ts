import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Company, DashboardData, Ledger, Organization, VoucherLine } from '@/lib/types'

const asNumber = (value: number | string | null | undefined) => Number(value ?? 0)

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
  const [vouchersResult, linesResult, ledgersResult, syncResult, companyResult] = await Promise.all([
    supabase.from('tb_vouchers').select('id,company_id,voucher_date,voucher_type,voucher_number,party_ledger_name,narration,is_cancelled,is_deleted').eq('company_id', companyId).eq('is_cancelled', false).eq('is_deleted', false).gte('voucher_date', from ?? '1900-01-01').lte('voucher_date', to ?? '2999-12-31').order('voucher_date', { ascending: false }).limit(2500),
    supabase.from('tb_ledger_voucher_lines').select('company_id,ledger_id,ledger_name,voucher_ledger_entry_id,line_number,voucher_id,voucher_date,voucher_type,voucher_number,particulars,debit_amount,credit_amount,running_balance').eq('company_id', companyId).gte('voucher_date', from ?? '1900-01-01').lte('voucher_date', to ?? '2999-12-31').limit(5000),
    supabase.from('tb_ledgers').select('id,org_id,company_id,name,parent_name,opening_balance,closing_balance,is_deleted').eq('company_id', companyId).eq('is_deleted', false).order('name').limit(1000),
    supabase.from('tb_company_sync_state').select('company_id,last_catalog_seen_at,last_ledger_sync_at,last_voucher_sync_at,last_error,updated_at').eq('company_id', companyId).maybeSingle(),
    supabase.from('tb_companies').select('id,last_successful_sync_at,last_sync_status,last_sync_error').eq('id', companyId).maybeSingle(),
  ])
  if (vouchersResult.error) throw new Error(`Could not load vouchers: ${vouchersResult.error.message}`)
  if (linesResult.error) throw new Error(`Could not load voucher lines: ${linesResult.error.message}`)
  if (ledgersResult.error) throw new Error(`Could not load ledgers: ${ledgersResult.error.message}`)
  if (syncResult.error) throw new Error(`Could not load sync status: ${syncResult.error.message}`)
  if (companyResult.error) throw new Error(`Could not load company freshness: ${companyResult.error.message}`)

  const lines = (linesResult.data ?? []) as VoucherLine[]
  const vouchers = vouchersResult.data ?? []
  const debit = lines.reduce((sum, line) => sum + asNumber(line.debit_amount), 0)
  const credit = lines.reduce((sum, line) => sum + asNumber(line.credit_amount), 0)
  const typeCounts = new Map<string, number>()
  for (const voucher of vouchers) typeCounts.set(voucher.voucher_type, (typeCounts.get(voucher.voucher_type) ?? 0) + 1)
  const periods = new Map<string, { debit: number; credit: number }>()
  for (const line of lines) {
    const label = (line.voucher_date ?? '').slice(0, 7) || 'Unknown'
    const period = periods.get(label) ?? { debit: 0, credit: 0 }
    period.debit += asNumber(line.debit_amount); period.credit += asNumber(line.credit_amount); periods.set(label, period)
  }
  const lineAmounts = new Map<string, number>()
  for (const line of lines) lineAmounts.set(line.voucher_id ?? '', (lineAmounts.get(line.voucher_id ?? '') ?? 0) + asNumber(line.debit_amount) + asNumber(line.credit_amount))
  return {
    kpis: { totalVouchers: vouchers.length, debit, credit, netMovement: debit - credit },
    activity: [...periods.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([label, values]) => ({ label, ...values })),
    voucherTypes: [...typeCounts.entries()].sort(([, a], [, b]) => b - a).slice(0, 8).map(([type, count]) => ({ type, count })),
    recentVouchers: vouchers.slice(0, 8).map((voucher) => ({ id: voucher.id, date: voucher.voucher_date, type: voucher.voucher_type, number: voucher.voucher_number, party: voucher.party_ledger_name, amount: lineAmounts.get(voucher.id) ?? 0 })),
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
