import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('generic compliance mapping Neon migration', () => {
  const migration = readFileSync(resolve('database/neon/013_generic_compliance_mapping.sql'), 'utf8')

  it('extends the retained profile without recreating obsolete decision tables or functions', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS selected_groups text[]')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS ledger_decisions jsonb')
    expect(migration).not.toMatch(/CREATE\s+TABLE/i)
    expect(migration).not.toMatch(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i)
  })
})
