import { NextRequest, NextResponse } from 'next/server'
import { createNeonDataApiClient } from '@/lib/neon/data-api'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const companyId = params.get('company')
  const ledgerId = params.get('ledger')
  const page = Math.max(0, Number(params.get('page') ?? '0') || 0)
  const search = params.get('search')?.trim() ?? ''
  if (!companyId || !ledgerId) return NextResponse.json({ error: 'company and ledger are required' }, { status: 400 })
  const client = createNeonDataApiClient()
  const [ledgerResult, linesResult] = await Promise.all([
    client.from('tb_ledgers').select('id,org_id,company_id,name,parent_name,opening_balance,closing_balance,is_deleted').eq('id', ledgerId).eq('company_id', companyId).eq('is_deleted', false).maybeSingle(),
    client.from('tb_ledger_voucher_lines').select('company_id,ledger_id,ledger_name,voucher_ledger_entry_id,line_number,voucher_id,voucher_date,voucher_type,voucher_number,particulars,debit_amount,credit_amount,running_balance').eq('company_id', companyId).eq('ledger_id', ledgerId).order('voucher_date', { ascending: false }).range(page * 50, page * 50 + 50),
  ])
  if (ledgerResult.error || linesResult.error) return NextResponse.json({ error: 'Could not load ledger detail' }, { status: 500 })
  if (!ledgerResult.data) return NextResponse.json({ error: 'Ledger not found in selected company' }, { status: 404 })
  const lines = (linesResult.data ?? []).filter((line) => !search || `${line.particulars ?? ''} ${line.voucher_number ?? ''} ${line.voucher_type ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  return NextResponse.json({ ledger: ledgerResult.data, lines: lines.slice(0, 50), hasMore: lines.length > 50 })
}
