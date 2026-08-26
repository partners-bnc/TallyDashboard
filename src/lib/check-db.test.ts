import { test } from 'vitest'
import { createNeonDataApiClient } from '@/lib/neon/data-api'
import { getGstReportData } from '@/lib/gst-data'

test('inspect database values', async () => {
  const client = createNeonDataApiClient()
  
  // Get companies
  const { data: companies, error: compErr } = await client.from('tb_companies').select('id, name')
  if (compErr) {
    console.error('Companies error:', compErr)
    return
  }
  console.log('COMPANIES:', companies)
  
  const company = companies?.[0]
  if (!company) {
    console.log('No companies found!')
    return
  }
  
  // Check sync state
  const { data: syncState } = await client.from('tb_company_sync_state').select('*').eq('company_id', company.id).maybeSingle()
  console.log('SYNC STATE:', syncState)
  
  // Check GST ledgers
  const { data: ledgers } = await client.from('tb_ledgers').select('id, name, parent_name, opening_balance, closing_balance').eq('company_id', company.id).eq('is_deleted', false)
  console.log('GST LEDGERS:')
  for (const l of ledgers || []) {
    const name = l.name.toLowerCase()
    if (name.includes('gst') || name.includes('rcm') || name.includes('tax') || name.includes('duty') || name.includes('payable')) {
      console.log(`- ${l.name} (Parent: ${l.parent_name}) | Opening: ${l.opening_balance} | Closing: ${l.closing_balance}`)
    }
  }

  // Get GST Report data for period
  try {
    const reportData = await getGstReportData(company.id, '2021-04-01', '2027-03-31')
    console.log('REPORT DATA LEDGERS:')
    for (const l of reportData.ledgers) {
      console.log(`- ${l.ledgerName} (Group: ${l.parentName}) | Debit: ${l.debitBalance} | Credit: ${l.creditBalance}`)
    }
  } catch (err) {
    console.error('Report error:', err)
  }
})
