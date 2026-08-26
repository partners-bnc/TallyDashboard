import 'server-only'

import { resolveActiveLedgers } from '@/lib/centralized-mapping'
import { createNeonDataApiClient } from '@/lib/neon/data-api'
import {
  buildGstClosingBalanceReport,
  type GstGroupSource,
  type GstLedgerSource,
  type GstReportData,
  type GstTrialBalanceSource,
} from '@/lib/gst-report'

export type { GstLedgerBalance, GstReportData } from '@/lib/gst-report'

export async function getGstReportData(companyId: string, _from?: string, to?: string): Promise<GstReportData> {
  const client = createNeonDataApiClient()
  const activeMapping = await resolveActiveLedgers(companyId, 'GST')
  const mappedIds = Array.from(activeMapping.activeLedgerIds)

  if (mappedIds.length === 0) {
    return buildGstClosingBalanceReport(companyId, activeMapping.activeLedgerIds, [], [], [])
  }

  const [ledgerResult, groupResult, balanceResult] = await Promise.all([
    client
      .from('tb_ledgers')
      .select('id,name,parent_name,parent_group_id')
      .eq('company_id', companyId)
      .in('id', mappedIds)
      .eq('is_deleted', false),
    client
      .from('tb_ledger_groups')
      .select('id,name,parent_name,parent_group_id')
      .eq('company_id', companyId)
      .eq('is_deleted', false),
    client.rpc('tb_trial_balance', {
      target_company: companyId,
      from_date: null,
      to_date: to ?? null,
    }),
  ])

  const error = ledgerResult.error ?? groupResult.error ?? balanceResult.error
  if (error) throw new Error(`Could not load GST closing balances: ${error.message}`)

  return buildGstClosingBalanceReport(
    companyId,
    activeMapping.activeLedgerIds,
    (ledgerResult.data ?? []) as GstLedgerSource[],
    (groupResult.data ?? []) as GstGroupSource[],
    (balanceResult.data ?? []) as GstTrialBalanceSource[],
  )
}
