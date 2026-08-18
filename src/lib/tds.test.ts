import { describe, expect, it } from 'vitest'
import { buildTdsReport, type TdsReportInput, type TdsSourceLine } from '@/lib/tds'

const baseLine = (overrides: Partial<TdsSourceLine>): TdsSourceLine => ({ mappingId: 'mapping-1', ledgerId: 'ledger-1', ledgerName: 'TDS on Contract', tdsType: 'Contractor', sectionCode: '194C', roundingTolerance: 1, journalTreatment: 'MAPPED_BY_SIGN', liabilityVoucherTypes: ['Purchase', 'Journal'], depositVoucherTypes: ['Payment'], voucherLedgerEntryId: 'line-1', voucherDate: '2026-04-10', voucherType: 'Purchase', voucherNumber: '1', party: 'Vendor', narration: null, rawSignedAmount: 1000, overrideClassification: null, relatedVoucherLedgerEntryId: null, overrideNote: null, ...overrides })

const report = (lines: TdsSourceLine[], asOfDate = '2026-05-10') => buildTdsReport({ companyId: 'company-1', asOfDate, from: '2026-04-01', to: '2027-03-31', lines, ledgerBalances: [{ ledgerId: 'ledger-1', openingBalance: 0, closingBalance: lines.reduce((sum, line) => sum + line.rawSignedAmount, 0) }], dueRules: [{ ruleCode: 'NON_GOVERNMENT_STANDARD', deductionMonth: 4, dueMonthOffset: 1, dueDay: 7, effectiveFrom: '1900-01-01', effectiveTo: null }], dueOverrides: [] } satisfies TdsReportInput)

describe('buildTdsReport', () => {
  it('allocates a payment to the oldest liability and marks an on-time clearance', () => {
    const data = report([baseLine({}), baseLine({ voucherLedgerEntryId: 'line-2', voucherDate: '2026-05-06', voucherType: 'Payment', voucherNumber: 'P-1', rawSignedAmount: -1000 })])
    expect(data.rows[0]).toMatchObject({ deposited: 1000, remaining: 0, status: 'CLEARED_ON_TIME' })
    expect(data.rows[0].allocations[0]).toMatchObject({ allocatedAmount: 1000, delayDays: 0 })
  })

  it('marks a late payment and records the delay', () => {
    const data = report([baseLine({}), baseLine({ voucherLedgerEntryId: 'line-2', voucherDate: '2026-05-10', voucherType: 'Payment', rawSignedAmount: -1000 })])
    expect(data.rows[0]).toMatchObject({ status: 'CLEARED_LATE', remaining: 0, delayDays: 3 })
  })

  it('keeps a partial unpaid amount overdue', () => {
    const data = report([baseLine({}), baseLine({ voucherLedgerEntryId: 'line-2', voucherDate: '2026-05-06', voucherType: 'Payment', rawSignedAmount: -400 })])
    expect(data.rows[0]).toMatchObject({ deposited: 400, remaining: 600, status: 'PARTIALLY_CLEARED_OVERDUE' })
  })

  it('uses FIFO when a payment clears multiple deduction months', () => {
    const data = report([baseLine({ voucherLedgerEntryId: 'april', rawSignedAmount: 500 }), baseLine({ voucherLedgerEntryId: 'may', voucherDate: '2026-05-10', rawSignedAmount: 700 }), baseLine({ voucherLedgerEntryId: 'payment', voucherDate: '2026-05-11', voucherType: 'Payment', rawSignedAmount: -800 })], '2026-06-10')
    const april = data.rows.find((row) => row.deductionMonth === '2026-04-01')!
    const may = data.rows.find((row) => row.deductionMonth === '2026-05-01')!
    expect(april.remaining).toBe(0)
    expect(may.remaining).toBe(400)
  })

  it('makes an unlinked reversal reviewable rather than silently classifying it as a deposit', () => {
    const data = report([baseLine({}), baseLine({ voucherLedgerEntryId: 'reversal', voucherDate: '2026-04-12', voucherType: 'Purchase', rawSignedAmount: -300 })])
    expect(data.rows[0]).toMatchObject({ remaining: 700, status: 'REVIEW_REQUIRED', reversed: 300 })
  })
})
