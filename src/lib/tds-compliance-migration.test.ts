import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve('supabase/migrations/20260820163647_simplify_tds_ledger_mapping.sql'),
  'utf8',
).replace(/\r\n/g, '\n')
const jammuCorrection = readFileSync(
  resolve('supabase/migrations/20260820165223_restore_jammu_confirmed_tds_mappings.sql'),
  'utf8',
).replace(/\r\n/g, '\n')

describe('simplified TDS compliance mapping migration', () => {
  it('removes drafts, their mappings, and both decision tables', () => {
    expect(migration).toContain("p.status = 'complete'")
    expect(migration).toContain("delete from public.compliance_mapping_profiles\nwhere status <> 'complete'")
    expect(migration).toContain('drop table public.compliance_group_decisions')
    expect(migration).toContain('drop table public.compliance_ledger_decisions')
  })

  it('preserves only Jammu’s four confirmed payable mappings', () => {
    expect(migration).toContain("c.name ilike '%Jammu%'")
    expect(migration).toContain("'TDS on Contractor'")
    expect(migration).toContain("'TDS on Professional Fees'")
    expect(migration).toContain("'TDS on Rent'")
    expect(migration).toContain("'TDS on Salary'")
    expect(jammuCorrection).toContain("~ '^tds on (contractor|professional fees|rent|salary)( |$)'")
    expect(jammuCorrection).toContain("p.status = 'complete'")
  })

  it('accepts only selected ledger IDs and validates recursive TDS membership', () => {
    expect(migration).toContain('selected_ledger_ids uuid[]')
    expect(migration).toContain('with recursive tds_groups as')
    expect(migration).toContain("~ '(^| )tds( |$)'")
    expect(migration).toContain("like '%tax deducted at source%'")
    expect(migration).toContain("raise exception 'No TDS ledger group was found for this company'")
    expect(migration).toContain("raise exception 'Selected ledgers must be payable members of the TDS hierarchy'")
  })

  it('replaces mappings and stores only active payable rows before completing the profile', () => {
    expect(migration).toContain('delete from public.tds_ledger_mappings')
    expect(migration).toContain('join unnest(selected_ledger_ids)')
    expect(migration).toContain("target_org, target_company, 'TDS', 'complete'")
    expect(migration).toContain('is_payable_ledger, updated_at')
  })
})
