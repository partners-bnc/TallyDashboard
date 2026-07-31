import { describe, expect, it } from 'vitest'
import { groupTrialBalanceRows } from './data'

describe('groupTrialBalanceRows', () => {
  it('groups ledgers, assigns missing parents, and reconciles totals', () => {
    const groups = groupTrialBalanceRows([
      { ledger_id: '2', ledger_name: 'Bank', parent_name: 'Current Assets', closing_balance: -150, debit_balance: 150, credit_balance: 0 },
      { ledger_id: '1', ledger_name: 'Cash', parent_name: null, closing_balance: 0, debit_balance: 0, credit_balance: 0 },
      { ledger_id: '3', ledger_name: 'Sales', parent_name: 'Income', closing_balance: 300, debit_balance: 0, credit_balance: '300' },
    ])
    expect(groups.map((group) => group.name)).toEqual(['Current Assets', 'Income'])
    expect(groups[0].debitBalance).toBe(150)
    expect(groups[1].creditBalance).toBe(300)
    expect(groups.every((group) => group.ledgers.every((ledger) => ledger.debitBalance !== 0 || ledger.creditBalance !== 0))).toBe(true)
  })
})
