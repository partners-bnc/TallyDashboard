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

  // 1. Create or update profile
  const { data: profile, error: profileError } = await client
    .from('compliance_mapping_profiles')
    .upsert({
      org_id: parsed.data.orgId,
      company_id: parsed.data.companyId,
      compliance_type: 'TDS',
      status: 'complete',
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,compliance_type' })
    .select('id')
    .single()

  if (profileError || !profile) {
    return { ok: false, error: `Could not save compliance profile: ${profileError?.message ?? 'Unknown error'}` }
  }

  // 2. Clear old decisions
  await client.from('compliance_group_decisions').delete().eq('profile_id', profile.id)
  await client.from('compliance_ledger_decisions').delete().eq('profile_id', profile.id)

  // 3. Save group decisions: TDS is group-mapped (the root TDS group is mapped)
  // Let's resolve the parent groups for the selected ledgers to insert group decisions
  const { data: ledgersData } = await client
    .from('tb_ledgers')
    .select('id,parent_name')
    .in('id', parsed.data.selectedLedgerIds)

  const parentGroups = Array.from(new Set((ledgersData ?? []).map((l) => l.parent_name).filter(Boolean))) as string[]

  if (parentGroups.length > 0) {
    const groupInserts = parentGroups.map((groupName) => ({
      profile_id: profile.id,
      org_id: parsed.data.orgId,
      company_id: parsed.data.companyId,
      compliance_type: 'TDS',
      group_name: groupName,
      selected: true,
    }))
    await client.from('compliance_group_decisions').insert(groupInserts)
  }

  // 4. Save ledger decisions:
  if (parsed.data.selectedLedgerIds.length > 0) {
    const ledgerInserts = parsed.data.selectedLedgerIds.map((ledgerId) => ({
      profile_id: profile.id,
      org_id: parsed.data.orgId,
      company_id: parsed.data.companyId,
      compliance_type: 'TDS',
      ledger_id: ledgerId,
      selected: true,
      category: 'PAYABLE',
      confirmed_by: user.id,
    }))
    await client.from('compliance_ledger_decisions').insert(ledgerInserts)
  }

  revalidatePath('/dashboard/compliance-mapping')
  revalidatePath('/dashboard/reports/tds-report')
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
  const client = createNeonDataApiClient()
  const { data: session, error: sessionError } = await auth.getSession()
  const user = session?.user
  if (sessionError || !user) return { ok: false, error: 'Your session has expired. Please sign in again.' }

  const { data: membership, error: membershipError } = await client
    .from('tb_org_members')
    .select('org_id')
    .eq('org_id', payload.orgId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (membershipError || !membership) return { ok: false, error: 'You do not have access to this organization.' }

  // 1. Create or update profile
  const { data: profile, error: profileError } = await client
    .from('compliance_mapping_profiles')
    .upsert({
      org_id: payload.orgId,
      company_id: payload.companyId,
      compliance_type: payload.complianceType,
      status: 'complete',
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,compliance_type' })
    .select('id')
    .single()

  if (profileError || !profile) {
    return { ok: false, error: `Could not save compliance profile: ${profileError?.message}` }
  }

  // 2. Clear old decisions
  await client.from('compliance_group_decisions').delete().eq('profile_id', profile.id)
  await client.from('compliance_ledger_decisions').delete().eq('profile_id', profile.id)

  // 3. Save group decisions
  if (payload.selectedGroups.length > 0) {
    const groupInserts = payload.selectedGroups.map((groupName) => ({
      profile_id: profile.id,
      org_id: payload.orgId,
      company_id: payload.companyId,
      compliance_type: payload.complianceType,
      group_name: groupName,
      selected: true,
    }))
    const { error: groupErr } = await client.from('compliance_group_decisions').insert(groupInserts)
    if (groupErr) return { ok: false, error: `Could not save group decisions: ${groupErr.message}` }
  }

  // 4. Save ledger decisions
  if (payload.ledgerDecisions.length > 0) {
    const ledgerInserts = payload.ledgerDecisions.map((decision) => ({
      profile_id: profile.id,
      org_id: payload.orgId,
      company_id: payload.companyId,
      compliance_type: payload.complianceType,
      ledger_id: decision.ledgerId,
      selected: decision.selected,
      category: decision.category ?? null,
      confirmed_by: user.id,
    }))
    const { error: ledgerErr } = await client.from('compliance_ledger_decisions').insert(ledgerInserts)
    if (ledgerErr) return { ok: false, error: `Could not save ledger decisions: ${ledgerErr.message}` }
  }

  revalidatePath('/dashboard/compliance-mapping')
  revalidatePath('/dashboard/reports/tds-report')
  return { ok: true }
}
