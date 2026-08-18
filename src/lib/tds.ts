import type { TdsAllocation, TdsAuditTransaction, TdsBooksStatus, TdsClassification, TdsMonthlyRow, TdsReportData, TdsStatus } from '@/lib/types'

export type TdsSourceLine = {
  mappingId: string
  ledgerId: string
  ledgerName: string
  tdsType: string
  sectionCode: string | null
  roundingTolerance: number
  journalTreatment: string
  liabilityVoucherTypes: string[]
  depositVoucherTypes: string[]
  voucherLedgerEntryId: string
  voucherDate: string
  voucherType: string
  voucherNumber: string | null
  party: string | null
  narration: string | null
  rawSignedAmount: number
  overrideClassification: string | null
  relatedVoucherLedgerEntryId: string | null
  overrideNote: string | null
}

export type TdsLedgerBalance = { ledgerId: string; openingBalance: number; closingBalance: number }
export type TdsDueRule = { ruleCode: string; deductionMonth: number; dueMonthOffset: number; dueDay: number; effectiveFrom: string; effectiveTo: string | null }
export type TdsDueOverride = { ledgerId: string | null; deductionMonth: string; dueDate: string }
export type TdsReportInput = { companyId: string; asOfDate: string; from: string; to: string; lines: TdsSourceLine[]; ledgerBalances: TdsLedgerBalance[]; dueRules: TdsDueRule[]; dueOverrides: TdsDueOverride[] }

type LiabilityBatch = {
  id: string
  ledgerId: string
  ledgerName: string
  tdsType: string
  sectionCode: string | null
  deductionMonth: string | null
  date: string
  originalAmount: number
  remaining: number
  dueDate: string | null
  reviewRequired: boolean
  opening: boolean
  liabilityTransactions: TdsAuditTransaction[]
  depositTransactions: TdsAuditTransaction[]
  allocations: TdsAllocation[]
  deducted: number
  reversed: number
}

const EPSILON = 0.005
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const monthOf = (date: string) => `${date.slice(0, 7)}-01`
const dateValue = (date: string) => Date.parse(`${date}T00:00:00Z`)
const addMonths = (date: string, months: number) => {
  const parsed = new Date(`${date.slice(0, 7)}-01T00:00:00Z`)
  parsed.setUTCMonth(parsed.getUTCMonth() + months)
  return parsed.toISOString().slice(0, 10)
}
const dateAtDay = (monthStart: string, day: number) => {
  const date = new Date(`${monthStart}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1, 0)
  date.setUTCDate(Math.min(day, date.getUTCDate()))
  return date.toISOString().slice(0, 10)
}

export const isIsoDate = (value: string | undefined | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(dateValue(value))

export function currentFinancialYear(today = new Date()): { from: string; to: string } {
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth() + 1
  const startYear = month < 4 ? year - 1 : year
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` }
}

function classification(line: TdsSourceLine): TdsClassification {
  if (line.overrideClassification) return line.overrideClassification as TdsClassification
  const voucherType = line.voucherType.toLowerCase()
  const isDepositVoucher = line.depositVoucherTypes.some((type) => type.toLowerCase() === voucherType)
  const isLiabilityVoucher = line.liabilityVoucherTypes.some((type) => type.toLowerCase() === voucherType)
  if (isDepositVoucher) return line.rawSignedAmount < 0 ? 'DEPOSIT' : 'PAYMENT_REVERSAL'
  if (isLiabilityVoucher && voucherType === 'journal' && line.journalTreatment === 'REVIEW_REQUIRED') return 'ADJUSTMENT'
  if (isLiabilityVoucher) return line.rawSignedAmount >= 0 ? 'DEDUCTION' : 'REVERSAL'
  return 'ADJUSTMENT'
}

function transaction(line: TdsSourceLine, kind: TdsClassification, amount = Math.abs(line.rawSignedAmount)): TdsAuditTransaction {
  return { id: line.voucherLedgerEntryId, date: line.voucherDate, voucherType: line.voucherType, voucherNumber: line.voucherNumber, party: line.party, rawSignedAmount: round(line.rawSignedAmount), amount: round(amount), classification: kind, note: line.overrideNote ?? line.narration }
}

function dueDate(line: TdsSourceLine, overrides: TdsDueOverride[], rules: TdsDueRule[]): string | null {
  const deductionMonth = monthOf(line.voucherDate)
  const override = overrides.find((item) => item.deductionMonth === deductionMonth && item.ledgerId === line.ledgerId)
    ?? overrides.find((item) => item.deductionMonth === deductionMonth && item.ledgerId === null)
  if (override) return override.dueDate
  const deductionMonthNumber = Number(deductionMonth.slice(5, 7))
  const rule = rules.find((item) => item.deductionMonth === deductionMonthNumber && item.effectiveFrom <= line.voucherDate && (!item.effectiveTo || item.effectiveTo >= line.voucherDate))
  return rule ? dateAtDay(addMonths(deductionMonth, rule.dueMonthOffset), rule.dueDay) : null
}

function statusFor(batch: LiabilityBatch, asOfDate: string): { status: TdsStatus; booksStatus: TdsBooksStatus; delayDays: number | null } {
  const isOpen = batch.remaining > EPSILON
  const latestDeposit = batch.allocations.reduce<string | null>((latest, item) => !latest || item.depositDate > latest ? item.depositDate : latest, null)
  const delayDays = batch.dueDate && latestDeposit ? Math.max(0, Math.round((dateValue(latestDeposit) - dateValue(batch.dueDate)) / 86400000)) : null
  if (batch.reviewRequired || (batch.opening && isOpen)) return { status: 'REVIEW_REQUIRED', booksStatus: 'REVIEW_REQUIRED', delayDays }
  if (!isOpen) return { status: (delayDays ?? 0) > 0 ? 'CLEARED_LATE' : 'CLEARED_ON_TIME', booksStatus: 'CLEARED', delayDays }
  const overdue = !!batch.dueDate && batch.dueDate < asOfDate
  if (batch.remaining + EPSILON < batch.originalAmount) return { status: overdue ? 'PARTIALLY_CLEARED_OVERDUE' : 'PARTIALLY_CLEARED_NOT_DUE', booksStatus: 'PARTIALLY_CLEARED', delayDays }
  return { status: overdue ? 'UNPAID_OVERDUE' : 'PENDING_NOT_DUE', booksStatus: 'OUTSTANDING', delayDays }
}

export function buildTdsReport(input: TdsReportInput): TdsReportData {
  const balanceByLedger = new Map(input.ledgerBalances.map((item) => [item.ledgerId, item]))
  const linesByLedger = new Map<string, TdsSourceLine[]>()
  for (const line of input.lines) linesByLedger.set(line.ledgerId, [...(linesByLedger.get(line.ledgerId) ?? []), line])
  const batches: LiabilityBatch[] = []
  const excessByLedger = new Map<string, { amount: number; transactions: TdsAuditTransaction[]; ledgerName: string; tdsType: string; sectionCode: string | null }>()
  const reconciliation: TdsReportData['reconciliation'] = []

  for (const [ledgerId, ledgerLines] of linesByLedger) {
    const first = ledgerLines[0]
    const balance = balanceByLedger.get(ledgerId)
    const opening = balance?.openingBalance ?? 0
    if (opening > EPSILON) {
      batches.push({ id: `opening:${ledgerId}`, ledgerId, ledgerName: first.ledgerName, tdsType: first.tdsType, sectionCode: first.sectionCode, deductionMonth: null, date: input.from, originalAmount: round(opening), remaining: round(opening), dueDate: null, reviewRequired: true, opening: true, liabilityTransactions: [], depositTransactions: [], allocations: [], deducted: 0, reversed: 0 })
    } else if (opening < -EPSILON) {
      excessByLedger.set(ledgerId, { amount: round(-opening), transactions: [], ledgerName: first.ledgerName, tdsType: first.tdsType, sectionCode: first.sectionCode })
    }

    const sorted = [...ledgerLines].sort((a, b) => a.voucherDate.localeCompare(b.voucherDate) || a.voucherLedgerEntryId.localeCompare(b.voucherLedgerEntryId))
    for (const line of sorted) {
      const kind = classification(line)
      if (kind === 'EXCLUDE' || Math.abs(line.rawSignedAmount) <= EPSILON) continue
      const amount = round(Math.abs(line.rawSignedAmount))
      const makeBatch = (reviewRequired: boolean, classificationKind: TdsClassification, countedDeduction: boolean) => {
        batches.push({ id: line.voucherLedgerEntryId, ledgerId, ledgerName: line.ledgerName, tdsType: line.tdsType, sectionCode: line.sectionCode, deductionMonth: monthOf(line.voucherDate), date: line.voucherDate, originalAmount: amount, remaining: amount, dueDate: dueDate(line, input.dueOverrides, input.dueRules), reviewRequired, opening: false, liabilityTransactions: [transaction(line, classificationKind)], depositTransactions: [], allocations: [], deducted: countedDeduction ? amount : 0, reversed: 0 })
      }
      if (kind === 'DEDUCTION') { makeBatch(false, kind, true); continue }
      if (kind === 'ADJUSTMENT' || kind === 'PAYMENT_REVERSAL') { makeBatch(true, kind, false); continue }

      const openBatches = batches.filter((item) => item.ledgerId === ledgerId && item.remaining > EPSILON)
      if (kind === 'REVERSAL') {
        const linked = line.relatedVoucherLedgerEntryId ? openBatches.filter((item) => item.id === line.relatedVoucherLedgerEntryId) : []
        const candidates = linked.length ? linked : [...openBatches].sort((a, b) => b.date.localeCompare(a.date))
        let left = amount
        for (const batch of candidates) {
          if (left <= EPSILON) break
          const reduced = Math.min(batch.remaining, left)
          batch.remaining = round(batch.remaining - reduced)
          batch.reversed = round(batch.reversed + reduced)
          batch.liabilityTransactions.push(transaction(line, kind, reduced))
          if (!linked.length) batch.reviewRequired = true
          left = round(left - reduced)
        }
        if (left > EPSILON) makeBatch(true, kind, false)
        continue
      }

      if (kind === 'DEPOSIT') {
        let left = amount
        for (const batch of openBatches.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
          if (left <= EPSILON) break
          const allocated = Math.min(batch.remaining, left)
          batch.remaining = round(batch.remaining - allocated)
          const deposit = transaction(line, kind, allocated)
          const delay = batch.dueDate ? Math.max(0, Math.round((dateValue(line.voucherDate) - dateValue(batch.dueDate)) / 86400000)) : null
          const allocation: TdsAllocation = { id: `${line.voucherLedgerEntryId}:${batch.id}`, liabilityId: batch.id, depositId: line.voucherLedgerEntryId, depositVoucherNumber: line.voucherNumber, depositDate: line.voucherDate, allocatedAmount: allocated, onTimeAmount: delay === 0 ? allocated : 0, lateAmount: delay && delay > 0 ? allocated : 0, dueDate: batch.dueDate, delayDays: delay }
          batch.depositTransactions.push(deposit)
          batch.allocations.push(allocation)
          left = round(left - allocated)
        }
        if (left > EPSILON) {
          const excess = excessByLedger.get(ledgerId) ?? { amount: 0, transactions: [], ledgerName: line.ledgerName, tdsType: line.tdsType, sectionCode: line.sectionCode }
          excess.amount = round(excess.amount + left)
          excess.transactions.push(transaction(line, kind, left))
          excessByLedger.set(ledgerId, excess)
        }
      }
    }
    const reconstructed = round(opening + sorted.reduce((sum, item) => sum + item.rawSignedAmount, 0))
    const expected = round(balance?.closingBalance ?? reconstructed)
    const tolerance = Math.max(...sorted.map((item) => item.roundingTolerance), 0.01)
    reconciliation.push({ ledgerId, ledgerName: first.ledgerName, expected, reconstructed, difference: round(expected - reconstructed), withinTolerance: Math.abs(expected - reconstructed) <= tolerance })
  }

  const grouped = new Map<string, LiabilityBatch[]>()
  for (const batch of batches) grouped.set(`${batch.ledgerId}:${batch.deductionMonth ?? 'opening'}`, [...(grouped.get(`${batch.ledgerId}:${batch.deductionMonth ?? 'opening'}`) ?? []), batch])
  const rows: TdsMonthlyRow[] = [...grouped.values()].map((items) => {
    const first = items[0]
    const totalDue = round(items.reduce((sum, item) => sum + item.originalAmount, 0))
    const remaining = round(items.reduce((sum, item) => sum + item.remaining, 0))
    const allocations = items.flatMap((item) => item.allocations)
    const statuses = items.map((item) => statusFor(item, input.asOfDate))
    const priority: TdsStatus[] = ['REVIEW_REQUIRED', 'UNPAID_OVERDUE', 'PARTIALLY_CLEARED_OVERDUE', 'PARTIALLY_CLEARED_NOT_DUE', 'PENDING_NOT_DUE', 'CLEARED_LATE', 'CLEARED_ON_TIME']
    const chosen = statuses.sort((a, b) => priority.indexOf(a.status) - priority.indexOf(b.status))[0]
    return { id: `${first.ledgerId}:${first.deductionMonth ?? 'opening'}`, ledgerId: first.ledgerId, ledgerName: first.ledgerName, tdsType: first.tdsType, sectionCode: first.sectionCode, deductionMonth: first.deductionMonth, openingOutstanding: round(items.filter((item) => item.opening).reduce((sum, item) => sum + item.originalAmount, 0)), deducted: round(items.reduce((sum, item) => sum + item.deducted, 0)), reversed: round(items.reduce((sum, item) => sum + item.reversed, 0)), totalDue, dueDate: items.map((item) => item.dueDate).filter(Boolean).sort()[0] ?? null, depositDates: [...new Set(allocations.map((item) => item.depositDate))].sort(), deposited: round(allocations.reduce((sum, item) => sum + item.allocatedAmount, 0)), knockedOff: round(allocations.reduce((sum, item) => sum + item.allocatedAmount, 0)), remaining, excess: 0, delayDays: Math.max(...statuses.map((item) => item.delayDays ?? 0), 0) || null, status: chosen.status, booksStatus: chosen.booksStatus, challanStatus: 'NOT_AVAILABLE', liabilityTransactions: items.flatMap((item) => item.liabilityTransactions), depositTransactions: items.flatMap((item) => item.depositTransactions), allocations }
  })
  for (const [ledgerId, excess] of excessByLedger) rows.push({ id: `${ledgerId}:excess`, ledgerId, ledgerName: excess.ledgerName, tdsType: excess.tdsType, sectionCode: excess.sectionCode, deductionMonth: null, openingOutstanding: 0, deducted: 0, reversed: 0, totalDue: 0, dueDate: null, depositDates: excess.transactions.map((item) => item.date), deposited: 0, knockedOff: 0, remaining: 0, excess: excess.amount, delayDays: null, status: 'EXCESS_UNALLOCATED', booksStatus: 'EXCESS_UNALLOCATED', challanStatus: 'NOT_AVAILABLE', liabilityTransactions: [], depositTransactions: excess.transactions, allocations: [] })
  rows.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName) || (a.deductionMonth ?? '').localeCompare(b.deductionMonth ?? ''))
  const kpis = { liabilityCreated: round(rows.reduce((sum, item) => sum + item.deducted, 0)), deposited: round(rows.reduce((sum, item) => sum + item.deposited, 0)), knockedOff: round(rows.reduce((sum, item) => sum + item.knockedOff, 0)), remaining: round(rows.reduce((sum, item) => sum + item.remaining, 0)), overdue: round(rows.filter((item) => ['UNPAID_OVERDUE', 'PARTIALLY_CLEARED_OVERDUE'].includes(item.status)).reduce((sum, item) => sum + item.remaining, 0)), clearedLate: round(rows.filter((item) => item.status === 'CLEARED_LATE').reduce((sum, item) => sum + item.knockedOff, 0)), excess: round(rows.reduce((sum, item) => sum + item.excess, 0)) }
  return { asOfDate: input.asOfDate, from: input.from, to: input.to, generatedAt: new Date().toISOString(), rows, kpis, ledgerOptions: [...new Map(rows.map((item) => [item.ledgerId, { id: item.ledgerId, label: item.ledgerName }])).values()], reconciliation }
}
