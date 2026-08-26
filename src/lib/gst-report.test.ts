import { describe, expect, it } from 'vitest'
import { buildGstClosingBalanceReport } from './gst-report'

const groups = [
  { id: 'duties', name: 'Duties & Taxes', parent_name: null, parent_group_id: null },
  { id: 'gst', name: 'GST', parent_name: 'Duties & Taxes', parent_group_id: 'duties' },
  { id: 'gst-rcm', name: 'GST RCM', parent_name: 'GST', parent_group_id: 'gst' },
  { id: 'tds', name: 'TDS', parent_name: 'Duties & Taxes', parent_group_id: 'duties' },
  { id: 'tds-payable', name: 'TDS Payable', parent_name: 'TDS', parent_group_id: 'tds' },
]

const ledgers = [
  { id: 'gst-payable', name: 'GST Payable', parent_name: 'GST', parent_group_id: 'gst' },
  { id: 'gst-input', name: 'GST Input', parent_name: 'GST', parent_group_id: 'gst' },
  { id: 'gst-rcm-ledger', name: 'GST RCM', parent_name: 'GST RCM', parent_group_id: 'gst-rcm' },
  { id: 'outward-igst', name: 'Outward IGST @5%', parent_name: 'Duties & Taxes', parent_group_id: 'duties' },
  { id: 'tds-credit', name: 'TDS on Rent', parent_name: 'TDS Payable', parent_group_id: 'tds-payable' },
  { id: 'zero', name: 'GST Zero Balance', parent_name: 'GST', parent_group_id: 'gst' },
]

describe('buildGstClosingBalanceReport', () => {
  it('totals closing debit and credit balances and excludes the complete TDS subtree', () => {
    const report = buildGstClosingBalanceReport(
      'jammu',
      new Set(ledgers.map((ledger) => ledger.id)),
      ledgers,
      groups,
      [
        { ledger_id: 'gst-payable', ledger_name: 'GST Payable', parent_name: 'GST', closing_balance: -10149.28, debit_balance: 10149.28, credit_balance: 0 },
        { ledger_id: 'gst-input', ledger_name: 'GST Input', parent_name: 'GST', closing_balance: -59747257.35, debit_balance: 59747257.35, credit_balance: 0 },
        { ledger_id: 'gst-rcm-ledger', ledger_name: 'GST RCM', parent_name: 'GST RCM', closing_balance: 46480.84, debit_balance: 0, credit_balance: 46480.84 },
        { ledger_id: 'outward-igst', ledger_name: 'Outward IGST @5%', parent_name: 'Duties & Taxes', closing_balance: 13906.5, debit_balance: 0, credit_balance: 13906.5 },
        { ledger_id: 'tds-credit', ledger_name: 'TDS on Rent', parent_name: 'TDS Payable', closing_balance: 5154.46, debit_balance: 0, credit_balance: 5154.46 },
        { ledger_id: 'zero', ledger_name: 'GST Zero Balance', parent_name: 'GST', closing_balance: 0, debit_balance: 0, credit_balance: 0 },
      ],
    )

    expect(report.totalDebitBalance).toBe(59757406.63)
    expect(report.totalCreditBalance).toBe(60387.34)
    expect(report.netBalance).toBe(59697019.29)
    expect(report.netNature).toBe('Dr')
    expect(report.ledgers.find((ledger) => ledger.ledgerName === 'GST Payable')?.debitBalance).toBe(10149.28)
    expect(report.ledgers.find((ledger) => ledger.ledgerName === 'Outward IGST @5%')?.creditBalance).toBe(13906.5)
    expect(report.ledgers.some((ledger) => ledger.ledgerName === 'TDS on Rent')).toBe(false)
    expect(report.ledgers.find((ledger) => ledger.ledgerName === 'GST Zero Balance')).toMatchObject({ debitBalance: 0, creditBalance: 0 })
  })

  it('labels a credit net and derives balances from closing balance as a defensive fallback', () => {
    const report = buildGstClosingBalanceReport(
      'company',
      new Set(['gst-payable']),
      ledgers,
      groups,
      [{ ledger_id: 'gst-payable', ledger_name: 'GST Payable', parent_name: 'GST', closing_balance: 125 }],
    )

    expect(report).toMatchObject({ totalDebitBalance: 0, totalCreditBalance: 125, netBalance: 125, netNature: 'Cr' })
  })
})
