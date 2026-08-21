import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve('supabase/migrations/20260821125525_move_tds_rules_to_code.sql'),
  'utf8',
).replace(/\r\n/g, '\n')

describe('TDS code-rule migration', () => {
  it('guards against deleting unexpected override or rule data', () => {
    expect(migration).toContain("if exists (select 1 from public.tds_due_date_overrides)")
    expect(migration).toContain("if exists (select 1 from public.tds_transaction_overrides)")
    expect(migration).toContain("rule_code <> 'NON_GOVERNMENT_STANDARD'")
    expect(migration).toContain("due_day <> case when deduction_month = 3 then 30 else 7 end")
  })

  it('drops the three rule and override tables but preserves ledger mappings', () => {
    expect(migration).toContain('drop table public.tds_due_date_rules')
    expect(migration).toContain('drop table public.tds_due_date_overrides')
    expect(migration).toContain('drop table public.tds_transaction_overrides')
    expect(migration).toContain('alter table public.tds_ledger_mappings\n  drop column due_rule_code')
    expect(migration).not.toContain('drop table public.tds_ledger_mappings')
  })

  it('recreates the source RPC without override columns or joins', () => {
    expect(migration).toContain('create function public.tb_tds_source_lines')
    expect(migration).toContain('language sql stable security invoker')
    expect(migration).not.toContain('override_classification')
    expect(migration).not.toContain('related_voucher_ledger_entry_id')
    expect(migration).not.toContain('override_note')
    expect(migration).not.toContain('left join public.tds_transaction_overrides')
  })
})
