'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Json, SaveTdsComplianceMappingPayload } from '@/lib/types'

const payloadSchema = z.object({
  orgId: z.string().uuid(),
  companyId: z.string().uuid(),
  groups: z.array(z.object({
    groupId: z.string().uuid(),
    selected: z.boolean(),
    suggested: z.boolean(),
  })).max(2000),
  ledgers: z.array(z.object({
    ledgerId: z.string().uuid(),
    selected: z.boolean(),
    suggested: z.boolean(),
    suggestionReason: z.string().trim().max(500).nullable(),
  })).max(10000),
})

export type SaveTdsMappingResult = { ok: true } | { ok: false; error: string }

export async function saveTdsComplianceMapping(
  rawPayload: SaveTdsComplianceMappingPayload,
): Promise<SaveTdsMappingResult> {
  const parsed = payloadSchema.safeParse(rawPayload)
  if (!parsed.success) return { ok: false, error: 'The mapping contains invalid or incomplete data.' }

  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { ok: false, error: 'Your session has expired. Please sign in again.' }

  const { data: membership, error: membershipError } = await supabase
    .from('tb_org_members')
    .select('org_id')
    .eq('org_id', parsed.data.orgId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (membershipError || !membership) return { ok: false, error: 'You do not have access to this organization.' }

  const { error } = await supabase.rpc('tb_save_tds_compliance_mapping', {
    target_org: parsed.data.orgId,
    target_company: parsed.data.companyId,
    mapping_payload: {
      groups: parsed.data.groups,
      ledgers: parsed.data.ledgers,
    } as unknown as Json,
  })
  if (error) return { ok: false, error: `Could not save TDS mappings: ${error.message}` }

  revalidatePath('/dashboard/compliance-mapping')
  revalidatePath('/dashboard/tds-report')
  return { ok: true }
}
