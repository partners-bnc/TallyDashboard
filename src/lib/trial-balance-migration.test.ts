import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve('supabase/migrations/20260814000000_include_ledgers_missing_baselines.sql'), 'utf8')

describe('missing Trial Balance baseline repair', () => {
  it('backfills reconciled ledgers without overwriting existing snapshots', () => {
    expect(migration).toContain('insert into public.tb_ledger_balance_snapshots')
    expect(migration).toContain('on conflict (ledger_id, as_of_date) do nothing')
  })

  it('uses a left snapshot lookup and a company-baseline fallback', () => {
    expect(migration).toContain('left join lateral')
    expect(migration).toContain('coalesce(snapshot.as_of_date, coverage.history_baseline_date)')
    expect(migration).toContain('coalesce(snapshot.opening_balance, l.opening_balance, 0)')
  })
})
