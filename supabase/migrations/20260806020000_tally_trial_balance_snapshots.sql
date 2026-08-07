create table if not exists public.tb_tally_trial_balance_snapshots (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.tb_organizations(id) on delete cascade,
  company_id uuid not null references public.tb_companies(id) on delete cascade, as_of_date date not null,
  debit_total numeric not null, credit_total numeric not null, rows jsonb not null, synced_at timestamptz not null default now(), unique(company_id, as_of_date)
);
alter table public.tb_tally_trial_balance_snapshots enable row level security;
drop policy if exists tb_tally_trial_balance_snapshots_read_member on public.tb_tally_trial_balance_snapshots;
create policy tb_tally_trial_balance_snapshots_read_member on public.tb_tally_trial_balance_snapshots for select using (exists(select 1 from public.tb_org_members m where m.org_id=tb_tally_trial_balance_snapshots.org_id and m.user_id=auth.uid()));
grant select on public.tb_tally_trial_balance_snapshots to authenticated;
