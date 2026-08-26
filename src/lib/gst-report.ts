import {
  isTdsGroupName,
  resolveLedgerGroupParents,
  tdsHierarchyGroupIds,
} from '@/lib/tds-mapping'

export interface GstLedgerBalance {
  ledgerId: string
  ledgerName: string
  parentName: string
  debitBalance: number
  creditBalance: number
}

export interface GstReportData {
  companyId: string
  totalDebitBalance: number
  totalCreditBalance: number
  netBalance: number
  netNature: 'Dr' | 'Cr'
  ledgers: GstLedgerBalance[]
}

export interface GstLedgerSource {
  id: string
  name: string
  parent_name: string | null
  parent_group_id: string | null
}

export interface GstGroupSource {
  id: string
  name: string
  parent_name: string | null
  parent_group_id: string | null
}

export interface GstTrialBalanceSource {
  ledger_id: string
  ledger_name: string
  parent_name: string | null
  closing_balance?: number | string | null
  debit_balance?: number | string | null
  credit_balance?: number | string | null
}

const amount = (value: number | string | null | undefined) => Number(value ?? 0)
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function buildGstClosingBalanceReport(
  companyId: string,
  mappedLedgerIds: ReadonlySet<string>,
  ledgerSources: GstLedgerSource[],
  groupSources: GstGroupSource[],
  trialBalanceRows: GstTrialBalanceSource[],
): GstReportData {
  const groups = resolveLedgerGroupParents(groupSources.map((group) => ({
    groupId: group.id,
    name: group.name,
    parentName: group.parent_name,
    parentGroupId: group.parent_group_id,
  })))
  const tdsGroupIds = tdsHierarchyGroupIds(groups)
  const groupIdByName = new Map(groups.map((group) => [group.name.toLowerCase().trim(), group.groupId]))
  const balanceByLedgerId = new Map(trialBalanceRows.map((row) => [row.ledger_id, row]))

  const ledgers = ledgerSources
    .filter((ledger) => mappedLedgerIds.has(ledger.id))
    .filter((ledger) => {
      const parentGroupId = ledger.parent_group_id
        ?? groupIdByName.get((ledger.parent_name ?? '').toLowerCase().trim())
        ?? null
      return !isTdsGroupName(ledger.parent_name ?? '')
        && (!parentGroupId || !tdsGroupIds.has(parentGroupId))
    })
    .map((ledger): GstLedgerBalance => {
      const row = balanceByLedgerId.get(ledger.id)
      const closingBalance = amount(row?.closing_balance)
      return {
        ledgerId: ledger.id,
        ledgerName: row?.ledger_name ?? ledger.name,
        parentName: row?.parent_name ?? ledger.parent_name ?? 'Unassigned',
        debitBalance: roundMoney(row?.debit_balance == null ? Math.max(-closingBalance, 0) : amount(row.debit_balance)),
        creditBalance: roundMoney(row?.credit_balance == null ? Math.max(closingBalance, 0) : amount(row.credit_balance)),
      }
    })
    .sort((a, b) => a.parentName.localeCompare(b.parentName) || a.ledgerName.localeCompare(b.ledgerName))

  const totalDebitBalance = roundMoney(ledgers.reduce((sum, ledger) => sum + ledger.debitBalance, 0))
  const totalCreditBalance = roundMoney(ledgers.reduce((sum, ledger) => sum + ledger.creditBalance, 0))
  const difference = roundMoney(totalDebitBalance - totalCreditBalance)

  return {
    companyId,
    totalDebitBalance,
    totalCreditBalance,
    netBalance: Math.abs(difference),
    netNature: difference >= 0 ? 'Dr' : 'Cr',
    ledgers,
  }
}
