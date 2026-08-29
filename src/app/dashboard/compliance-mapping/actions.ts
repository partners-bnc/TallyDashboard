'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { revalidateComplianceViews } from '@/lib/compliance-revalidation'
import { createNeonDataApiClient } from '@/lib/neon/data-api'
import type { SaveTdsComplianceMappingPayload } from '@/lib/types'

const payloadSchema = z.object({
  orgId: z.string().uuid(),
  companyId: z.string().uuid(),
  selectedLedgerIds: z.array(z.string().uuid()).max(10000),
})

const genericPayloadSchema = z.object({
  orgId: z.string().uuid(),
  companyId: z.string().uuid(),
  complianceType: z.enum(['PROMOTERS', 'GST', 'LOANS', 'ACCOUNTS_PAYABLE', 'OPEX']),
  selectedGroups: z.array(z.string().trim().min(1).max(255)).max(10000),
  ledgerDecisions: z.array(z.object({
    ledgerId: z.string().uuid(),
    selected: z.boolean(),
    category: z.string().trim().min(1).max(255).nullable().optional(),
  })).max(10000),
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

  const { error } = await client.rpc('tb_save_tds_compliance_mapping', {
    target_org: parsed.data.orgId,
    target_company: parsed.data.companyId,
    selected_ledger_ids: parsed.data.selectedLedgerIds,
  })

  if (error) return { ok: false, error: `Could not save TDS mapping: ${error.message}` }

  revalidateComplianceViews('TDS')
  return { ok: true }
}

export type SaveComplianceMappingPayload = {
  orgId: string
  companyId: string
  complianceType: string
  selectedGroups: string[]
  ledgerDecisions: Array<{
    ledgerId: string
    selected: boolean
    category?: string | null
  }>
}

export async function saveComplianceMapping(
  payload: SaveComplianceMappingPayload,
): Promise<SaveTdsMappingResult> {
  if (payload.complianceType === 'TDS') {
    return saveTdsComplianceMapping({
      orgId: payload.orgId,
      companyId: payload.companyId,
      selectedLedgerIds: payload.ledgerDecisions
        .filter((decision) => decision.selected)
        .map((decision) => decision.ledgerId),
    })
  }

  const parsed = genericPayloadSchema.safeParse(payload)
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

  const now = new Date().toISOString()
  const selectedGroups = [...new Set(parsed.data.selectedGroups)]
  const ledgerDecisions = [...new Map(parsed.data.ledgerDecisions.map((decision) => [
    decision.ledgerId,
    {
      ledger_id: decision.ledgerId,
      selected: decision.selected,
      category: decision.category ?? null,
    },
  ])).values()]

  const { error: profileError } = await client
    .from('compliance_mapping_profiles')
    .upsert({
      org_id: parsed.data.orgId,
      company_id: parsed.data.companyId,
      compliance_type: parsed.data.complianceType,
      status: 'complete',
      confirmed_by: user.id,
      confirmed_at: now,
      selected_groups: selectedGroups,
      ledger_decisions: ledgerDecisions,
      updated_at: now,
    }, { onConflict: 'company_id,compliance_type' })

  if (profileError) {
    return { ok: false, error: `Could not save compliance profile: ${profileError?.message}` }
  }

  revalidateComplianceViews(parsed.data.complianceType)
  return { ok: true }
}
