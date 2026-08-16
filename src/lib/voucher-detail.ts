export type VoucherEntryRecord = {
  id: string
  voucher_id: string
  company_id: string
  line_number: number
  ledger_name: string
  amount: number | string | null
  is_deemed_positive: boolean | null
  is_party_ledger: boolean | null
  is_billwise: boolean | null
}

const normalizeLedgerName = (value: string | null | undefined) => value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN') ?? ''

export function buildVoucherDetailEntries(entries: VoucherEntryRecord[], partyLedgerName?: string | null) {
  const normalized = entries.map((entry) => {
    const amount = Number(entry.amount ?? 0)
    return { ...entry, amount, display_amount: Math.abs(amount) }
  })
  const hasExplicitPartyEntry = normalized.some((entry) => entry.is_party_ledger)
  const normalizedPartyName = normalizeLedgerName(partyLedgerName)
  const visibleEntries = normalized.filter((entry) => {
    if (hasExplicitPartyEntry) return !entry.is_party_ledger
    return !normalizedPartyName || normalizeLedgerName(entry.ledger_name) !== normalizedPartyName
  })
  const debitTotal = normalized.reduce((total, entry) => entry.amount < 0 ? total + Math.abs(entry.amount) : total, 0)
  const creditTotal = normalized.reduce((total, entry) => entry.amount > 0 ? total + entry.amount : total, 0)
  return {
    entries: visibleEntries,
    // A balanced voucher stores the same value once on each accounting side.
    // Taking the larger side avoids double-counting debit + credit as turnover.
    totalAmount: Math.max(debitTotal, creditTotal),
  }
}
