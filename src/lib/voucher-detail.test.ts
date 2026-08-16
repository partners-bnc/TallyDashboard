import { describe, expect, it } from 'vitest'
import { buildVoucherDetailEntries, type VoucherEntryRecord } from './voucher-detail'

const entry = (overrides: Partial<VoucherEntryRecord>): VoucherEntryRecord => ({
  id: 'entry', voucher_id: 'voucher', company_id: 'company', line_number: 0,
  ledger_name: 'Office Furniture', amount: 53389.82, is_deemed_positive: true,
  is_party_ledger: false, is_billwise: false, ...overrides,
})

describe('buildVoucherDetailEntries', () => {
  it('matches Tally purchase presentation when the synced party flag is missing', () => {
    const result = buildVoucherDetailEntries([
      entry({ id: 'party', ledger_name: 'New Look Furniture Industry', amount: 63000, is_party_ledger: false }),
      entry({ id: 'furniture', amount: -53389.82 }),
      entry({ id: 'cgst', ledger_name: 'CGST INPUT 9%', amount: -4805.08 }),
      entry({ id: 'sgst', ledger_name: 'SGST INPUT 9 %', amount: -4805.08 }),
      entry({ id: 'round', ledger_name: 'Round Off', amount: -0.02 }),
    ], '  New Look   Furniture Industry ')

    expect(result.entries.map((item) => item.ledger_name)).toEqual([
      'Office Furniture', 'CGST INPUT 9%', 'SGST INPUT 9 %', 'Round Off',
    ])
    expect(result.totalAmount).toBeCloseTo(63000, 2)
    expect(result.entries[0].display_amount).toBeCloseTo(53389.82, 2)
  })

  it('keeps every line but counts only one accounting side when there is no party ledger', () => {
    const result = buildVoucherDetailEntries([entry({ amount: -10 }), entry({ id: 'second', ledger_name: 'Bank', amount: 10 })])
    expect(result.entries).toHaveLength(2)
    expect(result.totalAmount).toBe(10)
  })

  it('prefers Tally explicit party flags over the name fallback', () => {
    const result = buildVoucherDetailEntries([
      entry({ id: 'party', ledger_name: 'Supplier', amount: 50, is_party_ledger: true }),
      entry({ id: 'expense', ledger_name: 'Expense', amount: -50 }),
    ], 'Different header name')
    expect(result.entries.map((item) => item.id)).toEqual(['expense'])
    expect(result.totalAmount).toBe(50)
  })
})
