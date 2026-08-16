import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildVoucherDetailEntries } from '@/lib/voucher-detail'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const companyId = params.get('company')
  const voucherId = params.get('voucher')

  if (!companyId || !voucherId) {
    return NextResponse.json({ error: 'company and voucher are required' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const [voucherResult, entriesResult] = await Promise.all([
    supabase
      .from('tb_vouchers')
      .select('id,company_id,voucher_date,effective_date,voucher_type,voucher_number,party_ledger_name,reference,narration,is_cancelled,is_optional,is_deleted')
      .eq('id', voucherId)
      .eq('company_id', companyId)
      .eq('is_deleted', false)
      .maybeSingle(),
    supabase
      .from('tb_voucher_ledger_entries')
      .select('id,voucher_id,company_id,line_number,ledger_name,amount,is_deemed_positive,is_party_ledger,is_billwise')
      .eq('voucher_id', voucherId)
      .eq('company_id', companyId)
      .order('line_number', { ascending: true }),
  ])

  if (voucherResult.error || entriesResult.error) {
    return NextResponse.json({ error: 'Could not load voucher details' }, { status: 500 })
  }
  if (!voucherResult.data) {
    return NextResponse.json({ error: 'Voucher not found in selected company' }, { status: 404 })
  }

  const { entries, totalAmount } = buildVoucherDetailEntries(entriesResult.data ?? [], voucherResult.data.party_ledger_name)

  return NextResponse.json({ voucher: voucherResult.data, entries, totalAmount })
}
