import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.hoisted(() => vi.fn())
const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())
const revalidateComplianceViews = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/server', () => ({ auth: { getSession } }))
vi.mock('@/lib/neon/data-api', () => ({
  createNeonDataApiClient: () => ({ from, rpc }),
}))
vi.mock('@/lib/compliance-revalidation', () => ({ revalidateComplianceViews }))

import { saveComplianceMapping } from './actions'

describe('saveComplianceMapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ data: { session: {}, user: { id: 'user-1' } }, error: null })
    rpc.mockResolvedValue({ data: { selectedLedgerCount: 1 }, error: null })
  })

  it('saves TDS selections through the atomic Neon RPC without obsolete decision tables', async () => {
    const result = await saveComplianceMapping({
      orgId: '11111111-1111-4111-8111-111111111111',
      companyId: '22222222-2222-4222-8222-222222222222',
      complianceType: 'TDS',
      selectedGroups: ['TDS'],
      ledgerDecisions: [
        { ledgerId: '33333333-3333-4333-8333-333333333333', selected: true, category: 'PAYABLE' },
        { ledgerId: '44444444-4444-4444-8444-444444444444', selected: false, category: null },
      ],
    })

    expect(result).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('tb_save_tds_compliance_mapping', {
      target_org: '11111111-1111-4111-8111-111111111111',
      target_company: '22222222-2222-4222-8222-222222222222',
      selected_ledger_ids: ['33333333-3333-4333-8333-333333333333'],
    })
    expect(from).not.toHaveBeenCalled()
    expect(revalidateComplianceViews).toHaveBeenCalledWith('TDS')
  })

  it('stores GST group and ledger decisions on the retained mapping profile', async () => {
    const membershipQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { org_id: '11111111-1111-4111-8111-111111111111' }, error: null }),
    }
    const profileQuery = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }
    from.mockImplementation((table) => {
      if (table === 'tb_org_members') return membershipQuery
      if (table === 'compliance_mapping_profiles') return profileQuery
      throw new Error(`Unexpected table: ${table}`)
    })

    const result = await saveComplianceMapping({
      orgId: '11111111-1111-4111-8111-111111111111',
      companyId: '22222222-2222-4222-8222-222222222222',
      complianceType: 'GST',
      selectedGroups: ['Duties & Taxes', 'GST', 'GST'],
      ledgerDecisions: [
        { ledgerId: '33333333-3333-4333-8333-333333333333', selected: true, category: 'INPUT' },
        { ledgerId: '44444444-4444-4444-8444-444444444444', selected: false },
      ],
    })

    expect(result).toEqual({ ok: true })
    expect(from).toHaveBeenCalledTimes(2)
    expect(profileQuery.upsert).toHaveBeenCalledWith(expect.objectContaining({
      compliance_type: 'GST',
      selected_groups: ['Duties & Taxes', 'GST'],
      ledger_decisions: [
        { ledger_id: '33333333-3333-4333-8333-333333333333', selected: true, category: 'INPUT' },
        { ledger_id: '44444444-4444-4444-8444-444444444444', selected: false, category: null },
      ],
    }), { onConflict: 'company_id,compliance_type' })
    expect(rpc).not.toHaveBeenCalled()
    expect(revalidateComplianceViews).toHaveBeenCalledWith('GST')
  })
})
