import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rpc = readFileSync(resolve('database/neon/021_sync_accounting_rpc.sql'), 'utf8').replace(/\r\n/g, '\n')
const security = readFileSync(resolve('database/neon/020_security_and_roles.sql'), 'utf8').replace(/\r\n/g, '\n')
const restore = readFileSync(resolve('scripts/neon-migration/restore.ps1'), 'utf8')

describe('direct Neon accounting sync migration', () => {
  it('exposes only an authenticated wrapper around private privileged logic', () => {
    expect(rpc).toContain('CREATE SCHEMA IF NOT EXISTS tallybridge_private')
    expect(rpc).toContain('SECURITY DEFINER')
    expect(rpc).toContain('REVOKE ALL ON FUNCTION public.tb_sync_accounting_data(jsonb) FROM PUBLIC, anonymous')
    expect(rpc).toContain('GRANT EXECUTE ON FUNCTION public.tb_sync_accounting_data(jsonb) TO authenticated')
    expect(rpc).toContain('REVOKE ALL ON SCHEMA tallybridge_private FROM PUBLIC, anonymous, authenticated')
  })

  it('derives tenancy and protects each atomic company batch', () => {
    expect(rpc).toContain('v_user_id uuid := auth.uid()')
    expect(rpc).toContain('WHERE user_id = v_user_id')
    expect(rpc).toContain('v_memberships <> 1')
    expect(rpc).toContain('pg_advisory_xact_lock')
    expect(rpc).not.toMatch(/payload\s*->\s*['"]orgId/)
    expect(rpc).not.toMatch(/payload\s*->\s*['"]companyId/)
  })

  it('enforces size, record-count, company, entry, and allocation limits before writes', () => {
    expect(rpc).toContain('8 * 1024 * 1024')
    expect(rpc).toContain("('voucherLedgerEntries', 20000)")
    expect(rpc).toContain("('billAllocations', 50000)")
    expect(rpc).toContain("item->>'tallyCompanyGuid' <> v_company_guid")
    expect(rpc).toContain('Allocation is invalid or does not reference an entry in this payload')
  })

  it('removes the ingestion role and installs the RPC during restore', () => {
    expect(security).toContain('DROP ROLE tally_ingest')
    expect(security).not.toContain('CREATE ROLE tally_ingest')
    expect(security).not.toContain('TO tally_ingest USING')
    expect(security).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE')
    expect(restore).toContain('database/neon/021_sync_accounting_rpc.sql')
    expect(restore).toContain('database/neon/050_refresh_data_api.sql')
  })
})
