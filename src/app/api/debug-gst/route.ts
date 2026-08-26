import { NextRequest, NextResponse } from 'next/server'
import { createNeonDataApiClient } from '@/lib/neon/data-api'
import { getGstReportData } from '@/lib/data'
import fs from 'fs'

export async function GET(request: NextRequest) {
  try {
    const client = createNeonDataApiClient()
    
    // Get companies
    const { data: companies, error: compErr } = await client.from('tb_companies').select('id, name')
    if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 })
    
    const company = companies?.[0]
    if (!company) return NextResponse.json({ error: 'No companies found' }, { status: 404 })
    
    // Get GST report data
    const gstReport = await getGstReportData(company.id, '2021-04-01', '2027-03-31')
    
    // Get all synced ledgers
    const { data: allLedgers, error: ledgErr } = await client
      .from('tb_ledgers')
      .select('id, name, parent_name, opening_balance, closing_balance')
      .eq('company_id', company.id)
      .eq('is_deleted', false)
      
    if (ledgErr) return NextResponse.json({ error: ledgErr.message }, { status: 500 })
    
    const result = {
      company,
      gstReport,
      allLedgers
    }

    // Write to scratch file
    fs.writeFileSync(
      '/Users/anshu/.gemini/antigravity-ide/brain/e210b611-e085-460d-aba6-4e7bcc3a33a4/scratch/debug_gst_dump.json',
      JSON.stringify(result, null, 2)
    )
    
    return NextResponse.json({
      message: "Dumped successfully to scratch file!",
      company,
      gstReport
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 })
  }
}
