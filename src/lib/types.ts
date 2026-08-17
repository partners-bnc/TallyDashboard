export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] }
type View<Row> = { Row: Row; Relationships: [] }

export interface Database {
  public: {
    Tables: {
      tb_organizations: Table<{ id: string; name: string; created_at: string }>
      tb_org_members: Table<{ user_id: string; org_id: string; role: string; created_at: string }>
      tb_companies: Table<{ id: string; org_id: string; name: string; tally_company_guid: string; last_successful_sync_at: string | null; last_sync_status: string | null; last_sync_error: string | null; is_active: boolean; updated_at: string }>
      tb_ledgers: Table<{ id: string; org_id: string; company_id: string; name: string; parent_name: string | null; opening_balance: number | null; closing_balance: number | null; is_deleted: boolean }>
      tb_vouchers: Table<{ id: string; company_id: string; voucher_date: string; effective_date: string | null; voucher_type: string; voucher_number: string | null; party_ledger_name: string | null; reference: string | null; narration: string | null; is_cancelled: boolean; is_optional: boolean; is_deleted: boolean }>
      tb_voucher_ledger_entries: Table<{ id: string; voucher_id: string; company_id: string; line_number: number; ledger_id: string | null; ledger_name: string; amount: number; is_deemed_positive: boolean | null; is_party_ledger: boolean | null; is_billwise: boolean | null }>
      tb_company_sync_state: Table<{ company_id: string; last_catalog_seen_at: string | null; last_ledger_sync_at: string | null; last_voucher_sync_at: string | null; last_error: string | null; history_baseline_date: string | null; history_earliest_voucher_date: string | null; history_latest_voucher_date: string | null; history_reconciliation_status: string | null; history_reconciled_at: string | null; verification_as_of_date: string | null; verification_status: string | null; verification_completed_at: string | null; updated_at: string }>
      tb_tally_verification_snapshots: Table<{ id: string; org_id: string; company_id: string; ledger_id: string; as_of_date: string; closing_balance: number; synced_at: string }>
      tb_tally_trial_balance_snapshots: Table<{ id: string; org_id: string; company_id: string; as_of_date: string; debit_total: number; credit_total: number; rows: Json; synced_at: string }>
      tds_ledger_mappings: Table<{ id: string; org_id: string; company_id: string; ledger_id: string; tds_type: string; section_code: string | null; is_payable_ledger: boolean; rounding_tolerance: number; active_from: string; active_to: string | null; due_rule_code: string; liability_voucher_types: string[]; deposit_voucher_types: string[]; journal_treatment: string; created_at: string; updated_at: string }>
      tds_due_date_rules: Table<{ rule_code: string; deduction_month: number; due_month_offset: number; due_day: number; effective_from: string; effective_to: string | null; created_at: string }>
      tds_due_date_overrides: Table<{ id: string; org_id: string; company_id: string; ledger_id: string | null; deduction_month: string; due_date: string; reason: string; created_at: string }>
      tds_transaction_overrides: Table<{ voucher_ledger_entry_id: string; org_id: string; company_id: string; ledger_id: string; classification: string; related_voucher_ledger_entry_id: string | null; note: string; created_at: string; updated_at: string }>
    }
    Views: {
      tb_ledger_voucher_lines: View<{ company_id: string | null; ledger_id: string | null; ledger_name: string | null; voucher_ledger_entry_id: string | null; line_number: number | null; voucher_id: string | null; voucher_date: string | null; voucher_type: string | null; voucher_number: string | null; particulars: string | null; debit_amount: number | null; credit_amount: number | null; running_balance: number | null }>
    }
    Functions: {
      tb_is_member: { Args: { target_org: string }; Returns: boolean }
      tb_dashboard_movement_totals: {
        Args: { target_company: string; from_date?: string | null; to_date?: string | null }
        Returns: { voucher_count: number; debit_total: number; credit_total: number }[]
      }
      tb_dashboard_monthly_movement: {
        Args: { target_company: string; from_date?: string | null; to_date?: string | null }
        Returns: { period: string; debit_total: number; credit_total: number }[]
      }
      tb_dashboard_voucher_type_counts: {
        Args: { target_company: string; from_date?: string | null; to_date?: string | null }
        Returns: { voucher_type: string; voucher_count: number }[]
      }
      tb_trial_balance: {
        Args: { target_company: string; from_date?: string | null; to_date?: string | null }
        Returns: { ledger_id: string; ledger_name: string; parent_name: string | null; closing_balance: number; debit_balance: number; credit_balance: number }[]
      }
      tb_ledger_monthly_summary: {
        Args: { target_company: string; target_ledger: string; from_date?: string | null; to_date?: string | null }
        Returns: { ledger_id: string; ledger_name: string; parent_name: string | null; period: string; debit_total: number; credit_total: number; closing_balance: number }[]
      }
      tb_trial_balance_verification: { Args: { target_company: string; target_date: string }; Returns: { ledger_id: string | null; ledger_name: string | null; calculated_balance: number | null; tally_balance: number | null; difference: number | null }[] }
      tb_history_coverage: {
        Args: { target_company: string }
        Returns: { baseline_date: string | null; earliest_voucher_date: string | null; latest_voucher_date: string | null; reconciliation_status: string | null; reconciled_at: string | null }[]
      }
      tb_tds_source_lines: {
        Args: { target_company: string; target_as_of: string }
        Returns: { mapping_id: string; org_id: string; company_id: string; ledger_id: string; ledger_name: string; tds_type: string; section_code: string | null; rounding_tolerance: number; journal_treatment: string; liability_voucher_types: string[]; deposit_voucher_types: string[]; voucher_ledger_entry_id: string; voucher_id: string; voucher_date: string; voucher_type: string; voucher_number: string | null; party_ledger_name: string | null; narration: string | null; line_number: number; raw_signed_amount: number; override_classification: string | null; related_voucher_ledger_entry_id: string | null; override_note: string | null }[]
      }
    }
  }
}

export type Organization = Database['public']['Tables']['tb_organizations']['Row']
export type Company = Database['public']['Tables']['tb_companies']['Row']
export type Ledger = Database['public']['Tables']['tb_ledgers']['Row']
export type VoucherLine = Database['public']['Views']['tb_ledger_voucher_lines']['Row']
export type DashboardData = {
  kpis: { totalVouchers: number; debit: number; credit: number; netMovement: number }
  activity: { label: string; debit: number; credit: number }[]
  voucherTypes: { type: string; count: number }[]
  recentVouchers: { id: string; date: string; type: string; number: string | null; party: string | null; amount: number }[]
  ledgers: Ledger[]
  sync: { status: string | null; lastSyncedAt: string | null; error: string | null }
  history: HistoryCoverage
}

export type HistoryCoverage = {
  baselineDate: string | null
  earliestVoucherDate: string | null
  latestVoucherDate: string | null
  reconciliationStatus: string | null
  reconciledAt: string | null
  isAvailable: boolean
  message: string | null
}

export type TrialBalanceLedgerRow = {
  ledgerId: string
  ledgerName: string
  parentName: string
  closingBalance: number
  debitBalance: number
  creditBalance: number
}

export type TrialBalanceGroupRow = {
  name: string
  debitBalance: number
  creditBalance: number
  ledgers: TrialBalanceLedgerRow[]
}

export type TrialBalanceData = {
  groups: TrialBalanceGroupRow[]
  totalDebit: number
  totalCredit: number
  sync: { status: string | null; error: string | null }
  history: HistoryCoverage
  verification: TrialBalanceVerification | null
  authoritativeTotals: { asOfDate: string; debit: number; credit: number } | null
}

export type TrialBalanceVerification = {
  asOfDate: string
  tallyTotal: number
  calculatedTotal: number
  differenceTotal: number
  unmatchedCount: number
  largestDifferences: { ledgerName: string; calculatedBalance: number; tallyBalance: number; difference: number }[]
}
export type LedgerMonthlyMovement = {
  period: string
  debit: number
  credit: number
  closingBalance: number
}

export type LedgerMonthlyData = {
  ledgerId: string
  ledgerName: string
  parentName: string
  months: LedgerMonthlyMovement[]
  totalDebit: number
  totalCredit: number
}



export interface FundsFlowLedger {
  ledgerName: string
  closingBalance: number
  ledgerId?: string
}

export interface FundsFlowEntry {
  date: string
  particulars: string
  nature: string
  debit: number
  credit: number
  amount: number
}

export interface FundsFlowSubgroup {
  subgroupName: string
  debitTotal: number
  creditTotal: number
  netMovement: number
  closingBalance: number
  ledgers: FundsFlowLedger[]
  voucherLines: FundsFlowEntry[]
}

export interface FundsFlowGroup {
  groupName: string
  debitTotal: number
  creditTotal: number
  netMovement: number
  subgroups: FundsFlowSubgroup[]
}

export interface FundsFlowSummary {
  groups: Array<{
    groupName: string
    debitTotal: number
    creditTotal: number
    netMovement: number
  }>
  totalDebits: number
  totalCredits: number
  netMovement: number
}

export interface FundsFlowData {
  groups: FundsFlowGroup[]
  summary: FundsFlowSummary
  sync: {
    error: string | null
  }
  history: HistoryCoverage
}

export type TdsStatus =
  | 'CLEARED_ON_TIME'
  | 'CLEARED_LATE'
  | 'PARTIALLY_CLEARED_OVERDUE'
  | 'PARTIALLY_CLEARED_NOT_DUE'
  | 'UNPAID_OVERDUE'
  | 'PENDING_NOT_DUE'
  | 'EXCESS_UNALLOCATED'
  | 'REVIEW_REQUIRED'

export type TdsBooksStatus = 'CLEARED' | 'PARTIALLY_CLEARED' | 'OUTSTANDING' | 'EXCESS_UNALLOCATED' | 'REVIEW_REQUIRED'
export type TdsClassification = 'DEDUCTION' | 'REVERSAL' | 'ADJUSTMENT' | 'DEPOSIT' | 'PAYMENT_REVERSAL' | 'EXCLUDE'

export type TdsAuditTransaction = {
  id: string
  date: string
  voucherType: string
  voucherNumber: string | null
  party: string | null
  rawSignedAmount: number
  amount: number
  classification: TdsClassification
  note: string | null
}

export type TdsAllocation = {
  id: string
  liabilityId: string
  depositId: string
  depositVoucherNumber: string | null
  depositDate: string
  allocatedAmount: number
  onTimeAmount: number
  lateAmount: number
  dueDate: string | null
  delayDays: number | null
}

export type TdsMonthlyRow = {
  id: string
  ledgerId: string
  ledgerName: string
  tdsType: string
  sectionCode: string | null
  deductionMonth: string | null
  openingOutstanding: number
  deducted: number
  reversed: number
  totalDue: number
  dueDate: string | null
  depositDates: string[]
  deposited: number
  knockedOff: number
  remaining: number
  excess: number
  delayDays: number | null
  status: TdsStatus
  booksStatus: TdsBooksStatus
  challanStatus: 'NOT_AVAILABLE'
  liabilityTransactions: TdsAuditTransaction[]
  depositTransactions: TdsAuditTransaction[]
  allocations: TdsAllocation[]
}

export type TdsReportData = {
  asOfDate: string
  from: string
  to: string
  generatedAt: string
  rows: TdsMonthlyRow[]
  kpis: { liabilityCreated: number; deposited: number; knockedOff: number; remaining: number; overdue: number; clearedLate: number; excess: number }
  ledgerOptions: { id: string; label: string }[]
  reconciliation: { ledgerId: string; ledgerName: string; expected: number; reconstructed: number; difference: number; withinTolerance: boolean }[]
}





