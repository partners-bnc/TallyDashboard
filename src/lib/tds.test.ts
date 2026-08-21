import { describe, expect, it } from 'vitest'
import { buildTdsReport, type TdsReportInput, type TdsSourceLine } from '@/lib/tds'

const baseLine = (overrides: Partial<TdsSourceLine> = {}): TdsSourceLine => ({ companyId: 'company-1', mappingId: 'mapping-1', ledgerId: 'ledger-1', ledgerName: 'TDS on Contract', tdsType: 'Contractor', sectionCode: '194C', roundingTolerance: 1, journalTreatment: 'MAPPED_BY_SIGN', liabilityVoucherTypes: ['Purchase', 'Journal'], depositVoucherTypes: ['Payment'], voucherLedgerEntryId: 'line-1', voucherDate: '2026-04-10', voucherType: 'Purchase', voucherNumber: '1', party: 'Vendor', narration: null, rawSignedAmount: 1000, ...overrides })

const report = (lines: TdsSourceLine[], asOfDate = '2026-05-10', companyId = 'company-1') => {
  const scoped = lines.filter((line) => !line.companyId || line.companyId === companyId)
  const ledgerIds = [...new Set(scoped.map((line) => line.ledgerId))]
  return buildTdsReport({ companyId, asOfDate, from: '2025-04-01', to: '2027-03-31', lines, ledgerBalances: ledgerIds.map((ledgerId) => ({ ledgerId, openingBalance: 0, closingBalance: scoped.filter((line) => line.ledgerId === ledgerId).reduce((sum, line) => sum + line.rawSignedAmount, 0) })) } satisfies TdsReportInput)
}

describe('buildTdsReport', () => {
  it('allocates a payment FIFO and records an on-time source', () => {
    const data = report([baseLine(), baseLine({ voucherLedgerEntryId: 'payment', voucherDate: '2026-05-06', voucherType: 'Payment', voucherNumber: 'P-1', rawSignedAmount: -1000 })])
    expect(data.rows[0]).toMatchObject({ deposited: 1000, remaining: 0, status: 'CLEARED_ON_TIME' })
    expect(data.rows[0].allocations[0]).toMatchObject({ sourceType: 'DEPOSIT', sourceId: 'payment', sourceDate: '2026-05-06', allocatedAmount: 1000, delayDays: 0 })
  })

  it('marks a late payment and records the delay', () => {
    const data = report([baseLine(), baseLine({ voucherLedgerEntryId: 'payment', voucherDate: '2026-05-10', voucherType: 'Payment', rawSignedAmount: -1000 })])
    expect(data.rows[0]).toMatchObject({ status: 'CLEARED_LATE', remaining: 0, delayDays: 3 })
  })

  it('applies liability reversals to the newest compatible liability first', () => {
    const data = report([
      baseLine({ voucherLedgerEntryId: 'april', rawSignedAmount: 500 }),
      baseLine({ voucherLedgerEntryId: 'may', voucherDate: '2026-05-10', rawSignedAmount: 700 }),
      baseLine({ voucherLedgerEntryId: 'reversal', voucherDate: '2026-05-12', rawSignedAmount: -900 }),
    ], '2026-06-10')
    expect(data.rows.find((row) => row.deductionMonth === '2026-04-01')).toMatchObject({ reversed: 200, remaining: 300 })
    expect(data.rows.find((row) => row.deductionMonth === '2026-05-01')).toMatchObject({ reversed: 700, remaining: 0 })
  })

  it('uses an unlinked liability reversal against the newest liability without review', () => {
    const data = report([
      baseLine({ voucherLedgerEntryId: 'april', rawSignedAmount: 500 }),
      baseLine({ voucherLedgerEntryId: 'may', voucherDate: '2026-05-10', rawSignedAmount: 700 }),
      baseLine({ voucherLedgerEntryId: 'reversal', voucherDate: '2026-05-12', rawSignedAmount: -300 }),
    ], '2026-06-10')
    expect(data.rows.find((row) => row.deductionMonth === '2026-05-01')).toMatchObject({ reversed: 300, remaining: 400, status: 'UNPAID_OVERDUE' })
  })

  it('carries reversal excess forward as ledger credit', () => {
    const data = report([baseLine({ rawSignedAmount: 100 }), baseLine({ voucherLedgerEntryId: 'reversal', voucherDate: '2026-04-12', rawSignedAmount: -130 })])
    expect(data.rows.find((row) => row.deductionMonth === '2026-04-01')).toMatchObject({ reversed: 100, remaining: 0, status: 'REVERSED' })
    expect(data.rows.find((row) => row.status === 'EXCESS_UNALLOCATED')).toMatchObject({ excess: 30, deposited: 0 })
  })

  it('uses deposit excess to clear a later liability using the original deposit date', () => {
    const data = report([
      baseLine({ voucherLedgerEntryId: 'deposit', voucherDate: '2026-04-01', voucherType: 'Payment', rawSignedAmount: -1000 }),
      baseLine({ voucherLedgerEntryId: 'may', voucherDate: '2026-05-10', rawSignedAmount: 700 }),
    ], '2026-06-10')
    const may = data.rows.find((row) => row.deductionMonth === '2026-05-01')!
    expect(may).toMatchObject({ deposited: 700, remaining: 0, status: 'CLEARED_ON_TIME', depositDates: ['2026-04-01'] })
    expect(data.kpis.excess).toBe(300)
  })

  it('releases a payment credit when an already-paid liability is reversed', () => {
    const data = report([
      baseLine({ voucherLedgerEntryId: 'liability' }),
      baseLine({ voucherLedgerEntryId: 'payment', voucherDate: '2026-05-06', voucherType: 'Payment', rawSignedAmount: -1000 }),
      baseLine({ voucherLedgerEntryId: 'reversal', voucherDate: '2026-05-08', rawSignedAmount: -400 }),
    ])
    expect(data.rows.find((row) => row.deductionMonth === '2026-04-01')).toMatchObject({ totalDue: 600, deposited: 600, remaining: 0 })
    expect(data.kpis.excess).toBe(400)
  })

  it('undoes automatic payment allocations from the newest deposit first', () => {
    const data = report([
      baseLine({ voucherLedgerEntryId: 'liability' }),
      baseLine({ voucherLedgerEntryId: 'payment-1', voucherDate: '2026-05-05', voucherType: 'Payment', rawSignedAmount: -600 }),
      baseLine({ voucherLedgerEntryId: 'payment-2', voucherDate: '2026-05-06', voucherType: 'Payment', rawSignedAmount: -400 }),
      baseLine({ voucherLedgerEntryId: 'payment-reversal', voucherDate: '2026-05-08', voucherType: 'Payment', rawSignedAmount: 300 }),
    ])
    expect(data.rows[0]).toMatchObject({ deposited: 700, remaining: 300, status: 'REVIEW_REQUIRED' })
    expect(data.rows[0].depositTransactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'payment-1', amount: 600 }),
      expect.objectContaining({ id: 'payment-2', amount: 100 }),
    ]))
  })

  it('marks only restored allocations from an unlinked payment reversal for review', () => {
    const data = report([
      baseLine({ voucherLedgerEntryId: 'liability' }),
      baseLine({ voucherLedgerEntryId: 'payment', voucherDate: '2026-05-06', voucherType: 'Payment', rawSignedAmount: -1000 }),
      baseLine({ voucherLedgerEntryId: 'payment-reversal', voucherDate: '2026-05-08', voucherType: 'Payment', rawSignedAmount: 300 }),
    ])
    expect(data.rows[0]).toMatchObject({ remaining: 300, status: 'REVIEW_REQUIRED' })
  })

  it('creates a positive review liability for an unexplained payment reversal remainder', () => {
    const data = report([baseLine({ voucherLedgerEntryId: 'payment-reversal', voucherType: 'Payment', rawSignedAmount: 250 })])
    expect(data.rows[0]).toMatchObject({ deducted: 250, remaining: 250, status: 'REVIEW_REQUIRED' })
  })

  it('uses the seventh of the following month for April through February deductions', () => {
    const onDueDate = report([baseLine({ voucherDate: '2026-04-10' })], '2026-05-07')
    const afterDueDate = report([baseLine({ voucherDate: '2026-04-10' })], '2026-05-08')
    expect(onDueDate.rows[0]).toMatchObject({ dueDate: '2026-05-07', status: 'PENDING_NOT_DUE' })
    expect(afterDueDate.rows[0]).toMatchObject({ dueDate: '2026-05-07', status: 'UNPAID_OVERDUE' })
  })

  it('uses 30 April as the due date for March deductions', () => {
    const data = report([baseLine({ voucherDate: '2026-03-15' })], '2026-04-30')
    expect(data.rows[0]).toMatchObject({ dueDate: '2026-04-30', status: 'PENDING_NOT_DUE' })
  })

  it('rolls December deductions into a 7 January due date', () => {
    const data = report([baseLine({ voucherDate: '2026-12-20' })], '2027-01-08')
    expect(data.rows[0]).toMatchObject({ dueDate: '2027-01-07', status: 'UNPAID_OVERDUE' })
  })

  it('uses REVERSED only when the full liability is eliminated without payment', () => {
    const data = report([baseLine(), baseLine({ voucherLedgerEntryId: 'reversal', voucherDate: '2026-04-12', rawSignedAmount: -1000 })])
    expect(data.rows[0]).toMatchObject({ totalDue: 0, deposited: 0, remaining: 0, reversed: 1000, status: 'REVERSED' })
  })

  it('classifies a partial reversal followed by mixed on-time and late payments as late', () => {
    const data = report([
      baseLine(),
      baseLine({ voucherLedgerEntryId: 'reversal', voucherDate: '2026-04-12', rawSignedAmount: -200 }),
      baseLine({ voucherLedgerEntryId: 'on-time', voucherDate: '2026-05-06', voucherType: 'Payment', rawSignedAmount: -500 }),
      baseLine({ voucherLedgerEntryId: 'late', voucherDate: '2026-05-10', voucherType: 'Payment', rawSignedAmount: -300 }),
    ])
    const row = data.rows[0]
    expect(row).toMatchObject({ deducted: 1000, reversed: 200, totalDue: 800, deposited: 800, remaining: 0, status: 'CLEARED_LATE' })
    expect(row.allocations.filter((item) => item.sourceType === 'REVERSAL')[0].delayDays).toBeNull()
    expect(row.allocations.filter((item) => item.sourceType === 'DEPOSIT').map((item) => [item.onTimeAmount, item.lateAmount])).toEqual([[500, 0], [0, 300]])
  })

  it('does not move credits across companies or ledgers', () => {
    const data = report([
      baseLine({ voucherLedgerEntryId: 'company-credit', companyId: 'company-2', voucherType: 'Payment', rawSignedAmount: -1000 }),
      baseLine({ voucherLedgerEntryId: 'ledger-credit', ledgerId: 'ledger-1', voucherType: 'Payment', rawSignedAmount: -500 }),
      baseLine({ voucherLedgerEntryId: 'ledger-liability', ledgerId: 'ledger-2', ledgerName: 'TDS on Professional Fees', tdsType: 'Professional Fees', sectionCode: '194J', rawSignedAmount: 700 }),
    ])
    expect(data.ledgerPositions.find((item) => item.ledgerId === 'ledger-1')).toMatchObject({ outstanding: 0, excess: 500 })
    expect(data.ledgerPositions.find((item) => item.ledgerId === 'ledger-2')).toMatchObject({ outstanding: 700, excess: 0 })
    expect(data.kpis.remaining).toBe(700)
  })

  it('keeps report, monthly, and per-ledger outstanding totals reconciled', () => {
    const data = report([
      baseLine({ voucherLedgerEntryId: 'l1', rawSignedAmount: 900 }),
      baseLine({ voucherLedgerEntryId: 'p1', voucherType: 'Payment', voucherDate: '2026-05-01', rawSignedAmount: -200 }),
      baseLine({ voucherLedgerEntryId: 'l2', ledgerId: 'ledger-2', ledgerName: 'TDS on Professional Fees', tdsType: 'Professional Fees', sectionCode: '194J', rawSignedAmount: 450 }),
    ])
    expect(data.kpis.remaining).toBe(data.rows.reduce((sum, row) => sum + row.remaining, 0))
    expect(data.kpis.remaining).toBe(data.ledgerPositions.reduce((sum, ledger) => sum + ledger.outstanding, 0))
  })
})

describe('Medivation Jammu regression fixture', () => {
  it('matches the required ledger positions as of 31 March 2027', () => {
    const professional = { ledgerId: 'professional-194j', ledgerName: 'TDS on Professional Fees 194 J', tdsType: 'Professional Fees', sectionCode: '194J' }
    const contractor = { ledgerId: 'contractor-194c', ledgerName: 'TDS on Contractor (194 C)', tdsType: 'Contractor', sectionCode: '194C' }
    const salary = { ledgerId: 'salary', ledgerName: 'TDS on Salary', tdsType: 'Salary', sectionCode: '192' }
    const rent = { ledgerId: 'rent', ledgerName: 'TDS on Rent', tdsType: 'Rent', sectionCode: '194I' }
    const data = report([
      baseLine({ ...professional, voucherLedgerEntryId: 'professional-mar-2025', voucherDate: '2025-03-20', rawSignedAmount: 1000 }),
      baseLine({ ...professional, voucherLedgerEntryId: 'professional-mar-2025-payment', voucherDate: '2025-05-08', voucherType: 'Payment', rawSignedAmount: -1000 }),
      baseLine({ ...professional, voucherLedgerEntryId: 'professional-current', voucherDate: '2027-03-15', rawSignedAmount: 3406.2 }),
      baseLine({ ...contractor, voucherLedgerEntryId: 'contractor-current', voucherDate: '2027-03-16', rawSignedAmount: 1748.26 }),
      baseLine({ ...salary, voucherLedgerEntryId: 'salary-current', voucherDate: '2027-02-28', rawSignedAmount: 900 }),
      baseLine({ ...salary, voucherLedgerEntryId: 'salary-payment', voucherDate: '2027-03-05', voucherType: 'Payment', rawSignedAmount: -900 }),
      baseLine({ ...rent, voucherLedgerEntryId: 'rent-current', voucherDate: '2027-01-31', rawSignedAmount: 750 }),
      baseLine({ ...rent, voucherLedgerEntryId: 'rent-reversal', voucherDate: '2027-02-02', rawSignedAmount: -750 }),
    ], '2027-03-31')

    expect(data.ledgerPositions.find((item) => item.ledgerId === professional.ledgerId)?.outstanding).toBe(3406.2)
    expect(data.ledgerPositions.find((item) => item.ledgerId === contractor.ledgerId)?.outstanding).toBe(1748.26)
    expect(data.ledgerPositions.find((item) => item.ledgerId === salary.ledgerId)?.outstanding).toBe(0)
    expect(data.ledgerPositions.find((item) => item.ledgerId === rent.ledgerId)?.outstanding).toBe(0)
    expect(data.kpis.remaining).toBe(5154.46)
    expect(data.rows.find((row) => row.ledgerId === professional.ledgerId && row.deductionMonth === '2025-03-01')?.status).toBe('CLEARED_LATE')
    expect(data.kpis.remaining).toBe(data.rows.reduce((sum, row) => sum + row.remaining, 0))
    expect(data.kpis.remaining).toBe(data.ledgerPositions.reduce((sum, ledger) => sum + ledger.outstanding, 0))
  })
})
