import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve('supabase/migrations/20260819133137_tds_compliance_mapping.sql'),
  'utf8',
)
const correctiveMigration = readFileSync(
  resolve('supabase/migrations/20260819143544_correct_tds_mapping_scope.sql'),
  'utf8',
)

describe('TDS compliance mapping migration', () => {
  it('creates generic mapping profiles and decisions with RLS', () => {
    expect(migration).toContain('create table public.compliance_mapping_profiles')
    expect(migration).toContain('create table public.compliance_group_decisions')
    expect(migration).toContain('create table public.compliance_ledger_decisions')
    expect(migration).toContain('alter table public.compliance_mapping_profiles enable row level security')
    expect(migration).toContain('with check ((select public.tb_is_member(org_id)))')
  })

  it('uses an authenticated security-invoker RPC and explicit grants', () => {
    expect(migration).toContain('create or replace function public.tb_save_tds_compliance_mapping')
    expect(migration).toContain('security invoker')
    expect(migration).toContain("actor_id uuid := (select auth.uid())")
    expect(migration).toContain('grant execute on function public.tb_save_tds_compliance_mapping')
    expect(migration).toContain('grant select, insert, update, delete on table')
  })

  it('corrects the RPC to one company and uses real group IDs without categories', () => {
    expect(correctiveMigration).toContain('target_company uuid')
    expect(correctiveMigration).toContain('ledger_group_id uuid references public.tb_ledger_groups')
    expect(correctiveMigration).toContain("raise exception 'Payload must include every active ledger for the company'")
    expect(correctiveMigration).toContain('drop column category')
    expect(correctiveMigration).toContain('where d.profile_id = saved_profile and d.selected')
  })
})
