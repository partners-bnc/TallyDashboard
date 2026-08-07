create table if not exists public.tb_tally_verification_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.tb_organizations(id) on delete cascade,
  company_id uuid not null references public.tb_companies(id) on delete cascade,
  ledger_id uuid not null references public.tb_ledgers(id) on delete cascade,
  as_of_date date not null,
  closing_balance numeric not null,
  synced_at timestamptz not null default now(),
  unique (ledger_id, as_of_date)
);

create index if not exists tb_tally_verification_company_date_idx
  on public.tb_tally_verification_snapshots (company_id, as_of_date desc);

alter table public.tb_tally_verification_snapshots enable row level security;
create policy tb_tally_verification_snapshots_read_member
  on public.tb_tally_verification_snapshots for select
  using (exists (select 1 from public.tb_org_members m where m.org_id = tb_tally_verification_snapshots.org_id and m.user_id = auth.uid()));

alter table public.tb_company_sync_state
  add column if not exists verification_as_of_date date,
  add column if not exists verification_status text,
  add column if not exists verification_completed_at timestamptz;

create or replace function public.tb_trial_balance_verification(target_company uuid, target_date date)
returns table (ledger_id uuid, ledger_name text, calculated_balance numeric, tally_balance numeric, difference numeric)
language sql stable security invoker set search_path = public as $$
  select calculated.ledger_id, calculated.ledger_name, calculated.closing_balance,
         verification.closing_balance, calculated.closing_balance - verification.closing_balance
  from public.tb_trial_balance(target_company, null, target_date) calculated
  full join public.tb_tally_verification_snapshots verification
    on verification.company_id = target_company
   and verification.as_of_date = target_date
   and verification.ledger_id = calculated.ledger_id
  where verification.company_id is null or verification.company_id = target_company
$$;

grant select on public.tb_tally_verification_snapshots to authenticated;
grant execute on function public.tb_trial_balance_verification(uuid, date) to authenticated;
