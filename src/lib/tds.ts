import type { TdsAllocation, TdsAuditTransaction, TdsBooksStatus, TdsClassification, TdsMonthlyRow, TdsReportData, TdsStatus } from '@/lib/types'
import { normalizePeriodQuery } from '@/lib/period'

export type TdsSourceLine = {
  companyId?: string
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
}

export type TdsLedgerBalance = { ledgerId: string; openingBalance: number; closingBalance: number }
export type TdsReportInput = { companyId: string; asOfDate: string; from: string; to: string; lines: TdsSourceLine[]; ledgerBalances: TdsLedgerBalance[] }

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

type CreditSource = {
  id: string
  type: 'DEPOSIT' | 'REVERSAL'
  date: string
  voucherNumber: string | null
  transaction: TdsAuditTransaction | null
  remaining: number
  allocations: TdsAllocation[]
}

const EPSILON = 0.005
export const TDS_BOOKS_AS_OF_DATE = '2027-03-31'
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

export function financialYearForDate(date: string): { from: string; to: string } {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const startYear = month < 4 ? year - 1 : year
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` }
}

export function resolveTdsReportPeriod(from: unknown, to: unknown, latestActivityDate: string | null, today = new Date()) {
  const period = normalizePeriodQuery(from, to)
  const hasDateParameters = from !== undefined || to !== undefined
  const fallback = !hasDateParameters && latestActivityDate && isIsoDate(latestActivityDate)
    ? financialYearForDate(latestActivityDate)
    : currentFinancialYear(today)
  return { from: period.from || fallback.from, to: period.to || fallback.to, isValid: period.isValid }
}

function classification(line: TdsSourceLine): TdsClassification {
  const voucherType = line.voucherType.toLowerCase()
  const isDepositVoucher = line.depositVoucherTypes.some((type) => type.toLowerCase() === voucherType)
  const isLiabilityVoucher = line.liabilityVoucherTypes.some((type) => type.toLowerCase() === voucherType)
  if (isDepositVoucher) return line.rawSignedAmount < 0 ? 'DEPOSIT' : 'PAYMENT_REVERSAL'
  if (isLiabilityVoucher && voucherType === 'journal' && line.journalTreatment === 'REVIEW_REQUIRED') return 'ADJUSTMENT'
  if (isLiabilityVoucher) return line.rawSignedAmount >= 0 ? 'DEDUCTION' : 'REVERSAL'
  return 'ADJUSTMENT'
}

function transaction(line: TdsSourceLine, kind: TdsClassification, amount = Math.abs(line.rawSignedAmount)): TdsAuditTransaction {
  return { id: line.voucherLedgerEntryId, date: line.voucherDate, voucherType: line.voucherType, voucherNumber: line.voucherNumber, party: line.party, rawSignedAmount: round(line.rawSignedAmount), amount: round(amount), classification: kind, note: line.narration }
}

function transactionAmount(source: TdsAuditTransaction, amount: number): TdsAuditTransaction {
  return { ...source, amount: round(amount) }
}

function dueDate(line: TdsSourceLine): string {
  const deductionMonth = monthOf(line.voucherDate)
  const deductionMonthNumber = Number(deductionMonth.slice(5, 7))
  return dateAtDay(addMonths(deductionMonth, 1), deductionMonthNumber === 3 ? 30 : 7)
}

function addTransaction(target: TdsAuditTransaction[], source: TdsAuditTransaction, amount: number) {
  const existing = target.find((item) => item.id === source.id && item.classification === source.classification)
  if (existing) existing.amount = round(existing.amount + amount)
  else target.push(transactionAmount(source, amount))
}

function removeTransaction(target: TdsAuditTransaction[], sourceId: string, amount: number) {
  const index = target.findIndex((item) => item.id === sourceId && item.classification === 'DEPOSIT')
  if (index < 0) return
  target[index].amount = round(target[index].amount - amount)
  if (target[index].amount <= EPSILON) target.splice(index, 1)
}

function statusFor(batch: LiabilityBatch, asOfDate: string): { status: TdsStatus; booksStatus: TdsBooksStatus; delayDays: number | null } {
  const paymentAllocations = batch.allocations.filter((item) => item.sourceType === 'DEPOSIT' && item.allocatedAmount > EPSILON)
  const paid = round(paymentAllocations.reduce((sum, item) => sum + item.allocatedAmount, 0))
  const netLiability = round(Math.max(batch.originalAmount - batch.reversed, 0))
  const isOpen = batch.remaining > EPSILON
  const delayDays = paymentAllocations.reduce<number | null>((latest, item) => item.delayDays === null ? latest : Math.max(latest ?? 0, item.delayDays), null)
  if (batch.reviewRequired || (batch.opening && isOpen)) return { status: 'REVIEW_REQUIRED', booksStatus: 'REVIEW_REQUIRED', delayDays }
  if (netLiability <= EPSILON && paid <= EPSILON && batch.reversed > EPSILON) return { status: 'REVERSED', booksStatus: 'CLEARED', delayDays: null }
  if (!isOpen) return { status: paymentAllocations.some((item) => item.lateAmount > EPSILON) ? 'CLEARED_LATE' : 'CLEARED_ON_TIME', booksStatus: 'CLEARED', delayDays }
  const overdue = !!batch.dueDate && batch.dueDate < asOfDate
  if (paid > EPSILON && batch.remaining + EPSILON < netLiability) return { status: overdue ? 'PARTIALLY_CLEARED_OVERDUE' : 'PARTIALLY_CLEARED_NOT_DUE', booksStatus: 'PARTIALLY_CLEARED', delayDays }
  return { status: overdue ? 'UNPAID_OVERDUE' : 'PENDING_NOT_DUE', booksStatus: 'OUTSTANDING', delayDays }
}

export function buildTdsReport(input: TdsReportInput): TdsReportData {
  const scopedLines = input.lines.filter((line) => !line.companyId || line.companyId === input.companyId)
  const latestActivityDate = scopedLines
    .filter((line) => line.voucherDate <= input.asOfDate && Math.abs(line.rawSignedAmount) > EPSILON)
    .reduce<string | null>((latest, line) => !latest || line.voucherDate > latest ? line.voucherDate : latest, null)
  const balanceByLedger = new Map(input.ledgerBalances.map((item) => [item.ledgerId, item]))
  const linesByLedger = new Map<string, TdsSourceLine[]>()
  for (const line of scopedLines) linesByLedger.set(line.ledgerId, [...(linesByLedger.get(line.ledgerId) ?? []), line])
  const batches: LiabilityBatch[] = []
  const creditsByLedger = new Map<string, CreditSource[]>()
  const reconciliation: TdsReportData['reconciliation'] = []
  let allocationSequence = 0

  for (const [ledgerId, ledgerLines] of linesByLedger) {
    const first = ledgerLines[0]
    const balance = balanceByLedger.get(ledgerId)
    const opening = round(balance?.openingBalance ?? 0)
    const ledgerBatches: LiabilityBatch[] = []
    const creditSources: CreditSource[] = []
    const sourceById = new Map<string, CreditSource>()

    const registerSource = (source: CreditSource) => {
      creditSources.push(source)
      sourceById.set(source.id, source)
      return source
    }
    const makeBatch = (line: TdsSourceLine, kind: TdsClassification, amount: number, reviewRequired: boolean, countedDeduction: boolean) => {
      const batch: LiabilityBatch = { id: line.voucherLedgerEntryId, ledgerId, ledgerName: line.ledgerName, tdsType: line.tdsType, sectionCode: line.sectionCode, deductionMonth: monthOf(line.voucherDate), date: line.voucherDate, originalAmount: amount, remaining: amount, dueDate: kind === 'PAYMENT_REVERSAL' ? null : dueDate(line), reviewRequired, opening: false, liabilityTransactions: [transaction(line, kind, amount)], depositTransactions: [], allocations: [], deducted: countedDeduction ? amount : 0, reversed: 0 }
      ledgerBatches.push(batch)
      batches.push(batch)
      return batch
    }
    const activeCredits = () => creditSources.filter((source) => source.remaining > EPSILON).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    const openLiabilities = () => ledgerBatches.filter((batch) => batch.remaining > EPSILON).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    const allocatePayment = (source: CreditSource, batch: LiabilityBatch, requested: number) => {
      const allocated = round(Math.min(source.remaining, batch.remaining, requested))
      if (allocated <= EPSILON) return 0
      const delay = batch.dueDate ? Math.max(0, Math.round((dateValue(source.date) - dateValue(batch.dueDate)) / 86400000)) : null
      const allocation: TdsAllocation = { id: `${source.id}:${batch.id}:${allocationSequence++}`, liabilityId: batch.id, sourceType: 'DEPOSIT', sourceId: source.id, sourceVoucherNumber: source.voucherNumber, sourceDate: source.date, allocatedAmount: allocated, onTimeAmount: delay === null || delay > 0 ? 0 : allocated, lateAmount: delay && delay > 0 ? allocated : 0, dueDate: batch.dueDate, delayDays: delay }
      source.remaining = round(source.remaining - allocated)
      batch.remaining = round(batch.remaining - allocated)
      source.allocations.push(allocation)
      batch.allocations.push(allocation)
      if (source.transaction) addTransaction(batch.depositTransactions, source.transaction, allocated)
      return allocated
    }
    const releasePayment = (batch: LiabilityBatch, requested: number) => {
      let left = requested
      const released = new Set<CreditSource>()
      const allocations = [...batch.allocations].filter((allocation) => allocation.sourceType === 'DEPOSIT' && allocation.allocatedAmount > EPSILON).reverse()
      for (const allocation of allocations) {
        if (left <= EPSILON) break
        const restored = round(Math.min(allocation.allocatedAmount, left))
        const source = sourceById.get(allocation.sourceId)
        if (!source) continue
        allocation.allocatedAmount = round(allocation.allocatedAmount - restored)
        allocation.onTimeAmount = round(Math.min(allocation.onTimeAmount, allocation.allocatedAmount))
        allocation.lateAmount = round(Math.min(allocation.lateAmount, allocation.allocatedAmount))
        source.remaining = round(source.remaining + restored)
        if (source.transaction) removeTransaction(batch.depositTransactions, source.id, restored)
        released.add(source)
        left = round(left - restored)
      }
      return released
    }
    const applyReversal = (source: CreditSource, batch: LiabilityBatch, requested: number) => {
      const netLiability = round(Math.max(batch.originalAmount - batch.reversed, 0))
      const reduced = round(Math.min(source.remaining, netLiability, requested))
      if (reduced <= EPSILON) return { reduced: 0, released: new Set<CreditSource>() }
      const unpaidReduction = round(Math.min(batch.remaining, reduced))
      const released = releasePayment(batch, round(reduced - unpaidReduction))
      batch.remaining = round(batch.remaining - unpaidReduction)
      batch.reversed = round(batch.reversed + reduced)
      source.remaining = round(source.remaining - reduced)
      const allocation: TdsAllocation = { id: `${source.id}:${batch.id}:${allocationSequence++}`, liabilityId: batch.id, sourceType: 'REVERSAL', sourceId: source.id, sourceVoucherNumber: source.voucherNumber, sourceDate: source.date, allocatedAmount: reduced, onTimeAmount: 0, lateAmount: 0, dueDate: batch.dueDate, delayDays: null }
      source.allocations.push(allocation)
      batch.allocations.push(allocation)
      if (source.transaction) addTransaction(batch.liabilityTransactions, source.transaction, reduced)
      return { reduced, released }
    }
    const consumeCredits = (batch: LiabilityBatch) => {
      for (const source of activeCredits()) {
        if (batch.remaining <= EPSILON) break
        if (source.type === 'DEPOSIT') allocatePayment(source, batch, batch.remaining)
        else applyReversal(source, batch, batch.remaining)
      }
    }

    if (opening > EPSILON) {
      const batch: LiabilityBatch = { id: `opening:${ledgerId}`, ledgerId, ledgerName: first.ledgerName, tdsType: first.tdsType, sectionCode: first.sectionCode, deductionMonth: null, date: input.from, originalAmount: opening, remaining: opening, dueDate: null, reviewRequired: true, opening: true, liabilityTransactions: [], depositTransactions: [], allocations: [], deducted: 0, reversed: 0 }
      ledgerBatches.push(batch)
      batches.push(batch)
    } else if (opening < -EPSILON) {
      registerSource({ id: `opening-credit:${ledgerId}`, type: 'DEPOSIT', date: input.from, voucherNumber: null, transaction: null, remaining: round(-opening), allocations: [] })
    }

    const sorted = [...ledgerLines].sort((a, b) => a.voucherDate.localeCompare(b.voucherDate) || a.voucherLedgerEntryId.localeCompare(b.voucherLedgerEntryId))
    for (const line of sorted) {
      const kind = classification(line)
      if (Math.abs(line.rawSignedAmount) <= EPSILON) continue
      const amount = round(Math.abs(line.rawSignedAmount))

      if (kind === 'DEDUCTION' || kind === 'ADJUSTMENT') {
        const batch = makeBatch(line, kind, amount, kind === 'ADJUSTMENT', true)
        consumeCredits(batch)
        continue
      }

      if (kind === 'DEPOSIT') {
        const source = registerSource({ id: line.voucherLedgerEntryId, type: 'DEPOSIT', date: line.voucherDate, voucherNumber: line.voucherNumber, transaction: transaction(line, kind, amount), remaining: amount, allocations: [] })
        for (const batch of openLiabilities()) {
          if (source.remaining <= EPSILON) break
          allocatePayment(source, batch, source.remaining)
        }
        continue
      }

      if (kind === 'REVERSAL') {
        const source = registerSource({ id: line.voucherLedgerEntryId, type: 'REVERSAL', date: line.voucherDate, voucherNumber: line.voucherNumber, transaction: transaction(line, kind, amount), remaining: amount, allocations: [] })
        const compatible = ledgerBatches.filter((batch) => batch.originalAmount - batch.reversed > EPSILON)
        const candidates = [...compatible].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
        for (const batch of candidates) {
          if (source.remaining <= EPSILON) break
          applyReversal(source, batch, source.remaining)
        }
        continue
      }

      if (kind === 'PAYMENT_REVERSAL') {
        let left = amount
        const candidates = [...sourceById.values()].filter((source) => source.type === 'DEPOSIT').sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
        for (const source of candidates) {
          if (left <= EPSILON) break
          const unused = round(Math.min(source.remaining, left))
          source.remaining = round(source.remaining - unused)
          left = round(left - unused)
          const allocations = [...source.allocations].filter((allocation) => allocation.allocatedAmount > EPSILON).reverse()
          for (const allocation of allocations) {
            if (left <= EPSILON) break
            const restored = round(Math.min(allocation.allocatedAmount, left))
            const batch = ledgerBatches.find((item) => item.id === allocation.liabilityId)
            if (!batch) continue
            allocation.allocatedAmount = round(allocation.allocatedAmount - restored)
            allocation.onTimeAmount = round(Math.min(allocation.onTimeAmount, allocation.allocatedAmount))
            allocation.lateAmount = round(Math.min(allocation.lateAmount, allocation.allocatedAmount))
            batch.remaining = round(batch.remaining + restored)
            removeTransaction(batch.depositTransactions, source.id, restored)
            addTransaction(batch.liabilityTransactions, transaction(line, kind, restored), restored)
            batch.reviewRequired = true
            left = round(left - restored)
          }
        }
        if (left > EPSILON) {
          const batch = makeBatch(line, kind, left, true, true)
          consumeCredits(batch)
        }
      }
    }

    // Credits released by reversals still net
    // against liabilities in this ledger. They never cross a ledger boundary.
    for (const batch of openLiabilities()) consumeCredits(batch)
    creditsByLedger.set(ledgerId, creditSources)

    const reconstructed = round(opening + sorted.reduce((sum, item) => sum + item.rawSignedAmount, 0))
    const expected = round(balance?.closingBalance ?? reconstructed)
    const tolerance = Math.max(...sorted.map((item) => item.roundingTolerance), 0.01)
    reconciliation.push({ ledgerId, ledgerName: first.ledgerName, expected, reconstructed, difference: round(expected - reconstructed), withinTolerance: Math.abs(expected - reconstructed) <= tolerance })
  }

  const grouped = new Map<string, LiabilityBatch[]>()
  for (const batch of batches) grouped.set(`${batch.ledgerId}:${batch.deductionMonth ?? 'opening'}`, [...(grouped.get(`${batch.ledgerId}:${batch.deductionMonth ?? 'opening'}`) ?? []), batch])
  const rows: TdsMonthlyRow[] = [...grouped.values()].map((items) => {
    const first = items[0]
    const openingOutstanding = round(items.filter((item) => item.opening).reduce((sum, item) => sum + item.originalAmount, 0))
    const deducted = round(items.reduce((sum, item) => sum + item.deducted, 0))
    const reversed = round(items.reduce((sum, item) => sum + item.reversed, 0))
    const totalDue = round(Math.max(openingOutstanding + deducted, 0))
    const allocations = items.flatMap((item) => item.allocations).filter((item) => item.allocatedAmount > EPSILON)
    const paymentAllocations = allocations.filter((item) => item.sourceType === 'DEPOSIT')
    const knockedOff = round(allocations.reduce((sum, item) => sum + item.allocatedAmount, 0))
    const remaining = round(Math.max(totalDue - knockedOff, 0))
    const statuses = items.map((item) => statusFor(item, input.asOfDate))
    const priority: TdsStatus[] = ['REVIEW_REQUIRED', 'UNPAID_OVERDUE', 'PARTIALLY_CLEARED_OVERDUE', 'PARTIALLY_CLEARED_NOT_DUE', 'PENDING_NOT_DUE', 'CLEARED_LATE', 'CLEARED_ON_TIME', 'REVERSED']
    let chosen = statuses.sort((a, b) => priority.indexOf(a.status) - priority.indexOf(b.status))[0]
    if (!statuses.some((item) => item.status === 'REVIEW_REQUIRED') && reversed + EPSILON >= totalDue && paymentAllocations.length === 0) chosen = { status: 'REVERSED', booksStatus: 'CLEARED', delayDays: null }
    return { id: `${first.ledgerId}:${first.deductionMonth ?? 'opening'}`, ledgerId: first.ledgerId, ledgerName: first.ledgerName, tdsType: first.tdsType, sectionCode: first.sectionCode, deductionMonth: first.deductionMonth, openingOutstanding, deducted, reversed, totalDue, dueDate: items.map((item) => item.dueDate).filter((value): value is string => !!value).sort()[0] ?? null, depositDates: [...new Set(allocations.map((item) => item.sourceDate))].sort(), deposited: knockedOff, knockedOff, remaining, excess: 0, delayDays: Math.max(...statuses.map((item) => item.delayDays ?? 0), 0) || null, status: chosen.status, booksStatus: chosen.booksStatus, challanStatus: 'NOT_AVAILABLE', liabilityTransactions: items.flatMap((item) => item.liabilityTransactions), depositTransactions: items.flatMap((item) => item.depositTransactions), allocations }
  })

  for (const [ledgerId, sources] of creditsByLedger) {
    const active = sources.filter((source) => source.remaining > EPSILON)
    if (!active.length) continue
    const sample = rows.find((row) => row.ledgerId === ledgerId)
    const firstLine = linesByLedger.get(ledgerId)?.[0]
    if (!sample && !firstLine) continue
    const excess = round(active.reduce((sum, source) => sum + source.remaining, 0))
    const liabilityTransactions = active.filter((source) => source.type === 'REVERSAL' && source.transaction).map((source) => transactionAmount(source.transaction!, source.remaining))
    const depositTransactions = active.filter((source) => source.type === 'DEPOSIT' && source.transaction).map((source) => transactionAmount(source.transaction!, source.remaining))
    rows.push({ id: `${ledgerId}:excess`, ledgerId, ledgerName: sample?.ledgerName ?? firstLine!.ledgerName, tdsType: sample?.tdsType ?? firstLine!.tdsType, sectionCode: sample?.sectionCode ?? firstLine!.sectionCode, deductionMonth: null, openingOutstanding: 0, deducted: 0, reversed: 0, totalDue: 0, dueDate: null, depositDates: active.filter((source) => source.type === 'DEPOSIT').map((source) => source.date), deposited: 0, knockedOff: 0, remaining: 0, excess, delayDays: null, status: 'EXCESS_UNALLOCATED', booksStatus: 'EXCESS_UNALLOCATED', challanStatus: 'NOT_AVAILABLE', liabilityTransactions, depositTransactions, allocations: [] })
  }

  rows.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName) || (a.deductionMonth ?? '').localeCompare(b.deductionMonth ?? ''))
  const ledgerPositions = [...new Map(rows.map((row) => [row.ledgerId, row.ledgerName])).entries()].map(([ledgerId, ledgerName]) => ({ ledgerId, ledgerName, outstanding: round(rows.filter((row) => row.ledgerId === ledgerId).reduce((sum, row) => sum + row.remaining, 0)), excess: round(rows.filter((row) => row.ledgerId === ledgerId).reduce((sum, row) => sum + row.excess, 0)) }))
  const kpis = { liabilityCreated: round(rows.reduce((sum, item) => sum + item.deducted, 0)), deposited: round(rows.reduce((sum, item) => sum + item.deposited, 0)), knockedOff: round(rows.reduce((sum, item) => sum + item.knockedOff, 0)), remaining: round(ledgerPositions.reduce((sum, item) => sum + item.outstanding, 0)), overdue: round(rows.filter((item) => ['UNPAID_OVERDUE', 'PARTIALLY_CLEARED_OVERDUE'].includes(item.status)).reduce((sum, item) => sum + item.remaining, 0)), clearedLate: round(rows.reduce((sum, item) => sum + item.allocations.reduce((allocationSum, allocation) => allocationSum + allocation.lateAmount, 0), 0)), excess: round(ledgerPositions.reduce((sum, item) => sum + item.excess, 0)) }
  return { asOfDate: input.asOfDate, from: input.from, to: input.to, latestActivityDate, generatedAt: new Date().toISOString(), rows, kpis, ledgerOptions: ledgerPositions.map((item) => ({ id: item.ledgerId, label: item.ledgerName })), ledgerPositions, reconciliation }
}
