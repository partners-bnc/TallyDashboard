import { describe, expect, it } from 'vitest'
import { groupTrialBalanceRows } from './data'

describe('groupTrialBalanceRows', () => {
  it('groups ledgers, carries opening balances, and reconciles period movement', () => {
    const groups = groupTrialBalanceRows([
      { ledger_id: '2', ledger_name: 'Bank', parent_name: 'Current Assets', opening_balance: -100, debit_total: 75, credit_total: 25, closing_balance: -150 },
      { ledger_id: '1', ledger_name: 'Cash', parent_name: null, opening_balance: 0, debit_total: 0, credit_total: 0, closing_balance: 0 },
      { ledger_id: '3', ledger_name: 'Sales', parent_name: 'Income', opening_balance: 200, debit_total: 0, credit_total: '100', closing_balance: 300 },
    ])
    expect(groups.map((group) => group.name)).toEqual(['Current Assets', 'Income'])
    expect(groups[0]).toMatchObject({ openingBalance: -100, debitTotal: 75, creditTotal: 25, closingBalance: -150 })
    expect(groups[1]).toMatchObject({ openingBalance: 200, debitTotal: 0, creditTotal: 100, closingBalance: 300 })
    expect(groups.every((group) => group.ledgers.every((ledger) => ledger.openingBalance !== 0 || ledger.debitTotal !== 0 || ledger.creditTotal !== 0 || ledger.closingBalance !== 0))).toBe(true)
  })
})
