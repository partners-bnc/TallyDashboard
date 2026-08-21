create index if not exists compliance_group_decisions_profile_scope_idx
  on public.compliance_group_decisions (profile_id, org_id, company_id, compliance_type);

create index if not exists compliance_ledger_decisions_profile_scope_idx
  on public.compliance_ledger_decisions (profile_id, org_id, company_id, compliance_type);

create index if not exists compliance_ledger_decisions_ledger_idx
  on public.compliance_ledger_decisions (ledger_id);

create index if not exists tds_ledger_mappings_ledger_idx
  on public.tds_ledger_mappings (ledger_id);

create index if not exists tds_ledger_mappings_org_idx
  on public.tds_ledger_mappings (org_id);
