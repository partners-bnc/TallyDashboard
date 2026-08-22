-- Apply after the selective archive, functions, and view have been restored.
-- The original Supabase policy text is retained in source-schema-evidence.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
    CREATE ROLE anonymous NOLOGIN;
  END IF;
END
$$;

-- The source user UUID is intentionally allowed to remain invalid until the
-- replacement user signs up. 040_remap_member.sql updates it and validates.
ALTER TABLE public.tb_org_members
  DROP CONSTRAINT IF EXISTS tb_org_members_user_id_fkey;
ALTER TABLE public.tb_org_members
  ADD CONSTRAINT tb_org_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) NOT VALID;

GRANT USAGE ON SCHEMA public TO authenticated;
REVOKE ALL ON SCHEMA public FROM anonymous;

GRANT SELECT ON TABLE
  public.tb_organizations,
  public.tb_org_members,
  public.tb_companies,
  public.tb_company_sync_state,
  public.tb_ledger_groups,
  public.tb_ledgers,
  public.tb_ledger_balance_snapshots,
  public.tb_sync_runs,
  public.tb_tally_trial_balance_snapshots,
  public.tb_tally_verification_snapshots,
  public.tb_vouchers,
  public.tb_voucher_ledger_entries,
  public.tb_voucher_bill_allocations,
  public.tb_voucher_cost_centre_allocations,
  public.tds_ledger_mappings,
  public.compliance_mapping_profiles,
  public.tb_ledger_voucher_lines
TO authenticated;

-- Neon Data API may install broad default table privileges for authenticated.
-- Remove every direct accounting mutation capability; the RPC below is the
-- sole write authority for this closure.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.tb_organizations,
  public.tb_org_members,
  public.tb_companies,
  public.tb_company_sync_state,
  public.tb_ledger_groups,
  public.tb_ledgers,
  public.tb_ledger_balance_snapshots,
  public.tb_sync_runs,
  public.tb_tally_trial_balance_snapshots,
  public.tb_tally_verification_snapshots,
  public.tb_vouchers,
  public.tb_voucher_ledger_entries,
  public.tb_voucher_bill_allocations,
  public.tb_voucher_cost_centre_allocations
FROM authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE
  public.tds_ledger_mappings,
  public.compliance_mapping_profiles
TO authenticated;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anonymous;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anonymous;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.tb_is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tb_voucher_affects_books(public.tb_vouchers) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tb_dashboard_monthly_movement(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tb_dashboard_movement_totals(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tb_dashboard_voucher_type_counts(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tb_history_coverage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tb_ledger_monthly_summary(uuid,uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tb_save_tds_compliance_mapping(uuid,uuid,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tb_tds_source_lines(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tb_trial_balance(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tb_trial_balance_verification(uuid,date) TO authenticated;

-- Replace all source policies rather than relying on archive order.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'tb_organizations','tb_org_members','tb_companies','tb_company_sync_state',
        'tb_ledger_groups','tb_ledgers','tb_ledger_balance_snapshots','tb_sync_runs',
        'tb_tally_trial_balance_snapshots','tb_tally_verification_snapshots','tb_vouchers',
        'tb_voucher_ledger_entries','tb_voucher_bill_allocations',
        'tb_voucher_cost_centre_allocations','tds_ledger_mappings','compliance_mapping_profiles'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END
$$;

ALTER TABLE public.tb_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_company_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_ledger_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_ledger_balance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_tally_trial_balance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_tally_verification_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_voucher_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_voucher_bill_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_voucher_cost_centre_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tds_ledger_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_mapping_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY tb_organizations_select ON public.tb_organizations
  FOR SELECT TO authenticated USING (public.tb_is_member(tb_organizations.id));
CREATE POLICY tb_org_members_select ON public.tb_org_members
  FOR SELECT TO authenticated USING ((SELECT public.tb_is_member(org_id)));
CREATE POLICY tb_companies_select ON public.tb_companies
  FOR SELECT TO authenticated USING ((SELECT public.tb_is_member(org_id)));
CREATE POLICY tb_company_sync_state_select ON public.tb_company_sync_state
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tb_companies c
    WHERE c.id = tb_company_sync_state.company_id AND (SELECT public.tb_is_member(c.org_id))
  ));
CREATE POLICY tb_ledger_groups_select ON public.tb_ledger_groups
  FOR SELECT TO authenticated USING ((SELECT public.tb_is_member(org_id)));
CREATE POLICY tb_ledgers_select ON public.tb_ledgers
  FOR SELECT TO authenticated USING ((SELECT public.tb_is_member(org_id)));
CREATE POLICY tb_ledger_balance_snapshots_select ON public.tb_ledger_balance_snapshots
  FOR SELECT TO authenticated USING ((SELECT public.tb_is_member(org_id)));
CREATE POLICY tb_sync_runs_select ON public.tb_sync_runs
  FOR SELECT TO authenticated USING ((SELECT public.tb_is_member(org_id)));
CREATE POLICY tb_tally_trial_balance_snapshots_read_member ON public.tb_tally_trial_balance_snapshots
  FOR SELECT TO authenticated USING ((SELECT public.tb_is_member(org_id)));
CREATE POLICY tb_tally_verification_snapshots_read_member ON public.tb_tally_verification_snapshots
  FOR SELECT TO authenticated USING ((SELECT public.tb_is_member(org_id)));
CREATE POLICY tb_vouchers_select ON public.tb_vouchers
  FOR SELECT TO authenticated USING ((SELECT public.tb_is_member(org_id)));
CREATE POLICY tb_voucher_ledger_entries_select ON public.tb_voucher_ledger_entries
  FOR SELECT TO authenticated USING ((SELECT public.tb_is_member(org_id)));
CREATE POLICY tb_voucher_bill_allocations_select ON public.tb_voucher_bill_allocations
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tb_voucher_ledger_entries e
    WHERE e.id = tb_voucher_bill_allocations.voucher_ledger_entry_id
      AND (SELECT public.tb_is_member(e.org_id))
  ));
CREATE POLICY tb_voucher_cost_centre_allocations_select ON public.tb_voucher_cost_centre_allocations
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tb_voucher_ledger_entries e
    WHERE e.id = tb_voucher_cost_centre_allocations.voucher_ledger_entry_id
      AND (SELECT public.tb_is_member(e.org_id))
  ));

CREATE POLICY tds_ledger_mappings_read_member ON public.tds_ledger_mappings
  FOR SELECT TO authenticated USING ((SELECT public.tb_is_member(org_id)));
CREATE POLICY tds_ledger_mappings_insert_member ON public.tds_ledger_mappings
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT public.tb_is_member(org_id)) AND EXISTS (
      SELECT 1 FROM public.tb_ledgers l
      WHERE l.id = tds_ledger_mappings.ledger_id
        AND l.company_id = tds_ledger_mappings.company_id
        AND l.org_id = tds_ledger_mappings.org_id
    )
  );
CREATE POLICY tds_ledger_mappings_update_member ON public.tds_ledger_mappings
  FOR UPDATE TO authenticated
  USING ((SELECT public.tb_is_member(org_id)))
  WITH CHECK (
    (SELECT public.tb_is_member(org_id)) AND EXISTS (
      SELECT 1 FROM public.tb_ledgers l
      WHERE l.id = tds_ledger_mappings.ledger_id
        AND l.company_id = tds_ledger_mappings.company_id
        AND l.org_id = tds_ledger_mappings.org_id
    )
  );
CREATE POLICY tds_ledger_mappings_delete_member ON public.tds_ledger_mappings
  FOR DELETE TO authenticated USING ((SELECT public.tb_is_member(org_id)));

CREATE POLICY compliance_profiles_read_member ON public.compliance_mapping_profiles
  FOR SELECT TO authenticated USING ((SELECT public.tb_is_member(org_id)));
CREATE POLICY compliance_profiles_insert_member ON public.compliance_mapping_profiles
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT public.tb_is_member(org_id)) AND EXISTS (
      SELECT 1 FROM public.tb_companies c
      WHERE c.id = compliance_mapping_profiles.company_id
        AND c.org_id = compliance_mapping_profiles.org_id
    )
  );
CREATE POLICY compliance_profiles_update_member ON public.compliance_mapping_profiles
  FOR UPDATE TO authenticated
  USING ((SELECT public.tb_is_member(org_id)))
  WITH CHECK (
    (SELECT public.tb_is_member(org_id)) AND EXISTS (
      SELECT 1 FROM public.tb_companies c
      WHERE c.id = compliance_mapping_profiles.company_id
        AND c.org_id = compliance_mapping_profiles.org_id
    )
  );
CREATE POLICY compliance_profiles_delete_member ON public.compliance_mapping_profiles
  FOR DELETE TO authenticated USING ((SELECT public.tb_is_member(org_id)));

-- A previous migration iteration created a database-login ingestion role.
-- Remove every remaining dependency so no runtime database credential survives.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tally_ingest') THEN
    REVOKE ALL PRIVILEGES ON SCHEMA public FROM tally_ingest;
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM tally_ingest;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM tally_ingest;
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM tally_ingest;
    DROP ROLE tally_ingest;
  END IF;
END
$$;
