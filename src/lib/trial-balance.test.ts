import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/neon/data-api', () => ({ createNeonDataApiClient: vi.fn() }))

import { groupTrialBalanceRows } from './data'

describe('groupTrialBalanceRows', () => {
  it('uses closing balance sides, omits zero rows, and keeps income and expense ledgers raw', () => {
    const groups = groupTrialBalanceRows([
      { ledger_id: '2', ledger_name: 'Bank', parent_name: 'Current Assets', closing_balance: -150 },
      { ledger_id: '1', ledger_name: 'Cash', parent_name: null, closing_balance: 0 },
      { ledger_id: '3', ledger_name: 'Consultancy services', parent_name: 'Sales Accounts', closing_balance: 300 },
      { ledger_id: '4', ledger_name: 'Profit & Loss A/c', parent_name: 'Primary', closing_balance: 0 },
    ])
    expect(groups.map((group) => group.name)).toEqual(['Current Assets', 'Sales Accounts'])
    expect(groups[0]).toMatchObject({ debitBalance: 150, creditBalance: 0 })
    expect(groups[1]).toMatchObject({ debitBalance: 0, creditBalance: 300 })
    expect(groups[1].ledgers[0]).toMatchObject({ ledgerName: 'Consultancy services', creditBalance: 300 })
  })
})
