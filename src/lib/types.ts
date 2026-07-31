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
      tb_vouchers: Table<{ id: string; company_id: string; voucher_date: string; voucher_type: string; voucher_number: string | null; party_ledger_name: string | null; narration: string | null; is_cancelled: boolean; is_deleted: boolean }>
      tb_voucher_ledger_entries: Table<{ id: string; voucher_id: string; company_id: string; ledger_id: string | null; ledger_name: string; amount: number; is_deemed_positive: boolean | null }>
      tb_company_sync_state: Table<{ company_id: string; last_catalog_seen_at: string | null; last_ledger_sync_at: string | null; last_voucher_sync_at: string | null; last_error: string | null; updated_at: string }>
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
}
