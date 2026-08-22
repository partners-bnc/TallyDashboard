'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { createNeonDataApiClient } from '@/lib/neon/data-api'
import type { SaveTdsComplianceMappingPayload } from '@/lib/types'

const payloadSchema = z.object({
  orgId: z.string().uuid(),
  companyId: z.string().uuid(),
  selectedLedgerIds: z.array(z.string().uuid()).max(10000),
}).superRefine((payload, context) => {
  if (new Set(payload.selectedLedgerIds).size !== payload.selectedLedgerIds.length) {
    context.addIssue({ code: 'custom', message: 'Selected ledgers must be unique.' })
  }
})

export type SaveTdsMappingResult = { ok: true } | { ok: false; error: string }

export async function saveTdsComplianceMapping(
  rawPayload: SaveTdsComplianceMappingPayload,
): Promise<SaveTdsMappingResult> {
  const parsed = payloadSchema.safeParse(rawPayload)
  if (!parsed.success) return { ok: false, error: 'The mapping contains invalid or incomplete data.' }

  const client = createNeonDataApiClient()
  const { data: session, error: sessionError } = await auth.getSession()
  const user = session?.user
  if (sessionError || !user) return { ok: false, error: 'Your session has expired. Please sign in again.' }

  const { data: membership, error: membershipError } = await client
    .from('tb_org_members')
    .select('org_id')
    .eq('org_id', parsed.data.orgId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (membershipError || !membership) return { ok: false, error: 'You do not have access to this organization.' }

  const { error } = await client.rpc('tb_save_tds_compliance_mapping', {
    target_org: parsed.data.orgId,
    target_company: parsed.data.companyId,
    selected_ledger_ids: parsed.data.selectedLedgerIds,
  })
  if (error) return { ok: false, error: `Could not save TDS mappings: ${error.message}` }

  revalidatePath('/dashboard/compliance-mapping')
  revalidatePath('/dashboard/tds-report')
  return { ok: true }
}
