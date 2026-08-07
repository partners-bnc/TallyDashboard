begin;

-- A balance here is the balance immediately before balance_date.  It is an
-- accounting baseline, not the mutable master-data opening balance.
create table if not exists public.tb_ledger_balance_snapshots (
  ledger_id uuid not null references public.tb_ledgers(id) on delete cascade,
  company_id uuid not null references public.tb_companies(id) on delete cascade,
  org_id uuid not null references public.tb_organizations(id) on delete cascade,
  balance_date date not null,
  opening_balance numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ledger_id, balance_date)
);

create index if not exists tb_ledger_balance_snapshots_company_date_idx
  on public.tb_ledger_balance_snapshots (company_id, balance_date desc);

alter table public.tb_ledger_balance_snapshots enable row level security;

drop policy if exists tb_ledger_balance_snapshots_read_member on public.tb_ledger_balance_snapshots;
create policy tb_ledger_balance_snapshots_read_member
  on public.tb_ledger_balance_snapshots for select
  using (public.tb_is_member(org_id));

alter table public.tb_company_sync_state
  add column if not exists history_baseline_date date,
  add column if not exists history_earliest_voucher_date date,
  add column if not exists history_latest_voucher_date date,
  add column if not exists history_reconciliation_status text,
  add column if not exists history_reconciled_at timestamptz;

-- This is deliberately a small, separately callable diagnostic contract so
-- all report entry points can refuse dates that have not been reconciled.
create or replace function public.tb_history_coverage(target_company uuid)
returns table(
  baseline_date date,
  earliest_voucher_date date,
  latest_voucher_date date,
  reconciliation_status text,
  reconciled_at timestamptz
)
language sql stable security invoker set search_path = public, pg_temp
as $$
  select
    s.history_baseline_date,
    s.history_earliest_voucher_date,
    s.history_latest_voucher_date,
    s.history_reconciliation_status,
    s.history_reconciled_at
  from public.tb_company_sync_state s
  where s.company_id = target_company;
$$;

drop function if exists public.tb_trial_balance(uuid, date, date);
create function public.tb_trial_balance(target_company uuid, from_date date default null, to_date date default null)
returns table(ledger_id uuid, ledger_name text, parent_name text, closing_balance numeric, debit_balance numeric, credit_balance numeric)
language sql stable security invoker set search_path = public, pg_temp
as $$
  with coverage as (
    select history_baseline_date
    from public.tb_company_sync_state
    where company_id = target_company
      and history_reconciliation_status = 'complete'
  ), target as (
    select coalesce(to_date, current_date) as as_of_date
  ), balances as (
    select
      l.id as ledger_id,
      l.name as ledger_name,
      l.parent_name,
      snapshot.opening_balance
        + coalesce(sum(case when v.voucher_date >= snapshot.balance_date and v.voucher_date <= target.as_of_date then e.amount else 0 end), 0) as closing_balance
    from public.tb_ledgers l
    cross join target
    join coverage on target.as_of_date >= coverage.history_baseline_date
    join lateral (
      select s.balance_date, s.opening_balance
      from public.tb_ledger_balance_snapshots s
      where s.ledger_id = l.id
        and s.company_id = target_company
        and s.balance_date <= target.as_of_date
      order by s.balance_date desc
      limit 1
    ) snapshot on true
    left join public.tb_voucher_ledger_entries e on e.ledger_id = l.id and e.company_id = target_company
    left join public.tb_vouchers v on v.id = e.voucher_id and v.company_id = target_company and not v.is_cancelled and not v.is_deleted
    where l.company_id = target_company and not l.is_deleted
    group by l.id, l.name, l.parent_name, snapshot.balance_date, snapshot.opening_balance
  )
  select
    ledger_id,
    ledger_name,
    parent_name,
    closing_balance,
    greatest(-closing_balance, 0) as debit_balance,
    greatest(closing_balance, 0) as credit_balance
  from balances
  order by parent_name nulls last, ledger_name;
$$;

create or replace function public.tb_ledger_monthly_summary(
  target_company uuid,
  target_ledger uuid,
  from_date date default null,
  to_date date default null
)
returns table(ledger_id uuid, ledger_name text, parent_name text, period date, debit_total numeric, credit_total numeric, closing_balance numeric)
language sql stable security invoker set search_path = public, pg_temp
as $$
  with coverage as (
    select history_baseline_date
    from public.tb_company_sync_state
    where company_id = target_company
      and history_reconciliation_status = 'complete'
  ), bounds as (
    select greatest(coalesce(from_date, c.history_baseline_date), c.history_baseline_date) as start_date,
           coalesce(to_date, current_date) as end_date
    from coverage c
  ), snapshot as (
    select s.balance_date, s.opening_balance
    from public.tb_ledger_balance_snapshots s
    cross join bounds b
    where s.ledger_id = target_ledger
      and s.company_id = target_company
      and s.balance_date <= b.start_date
    order by s.balance_date desc
    limit 1
  ), months as (
    select generate_series(date_trunc('month', b.start_date), date_trunc('month', b.end_date), interval '1 month')::date as period
    from bounds b
    where b.start_date <= b.end_date
  )
  select
    l.id,
    l.name,
    l.parent_name,
    m.period,
    coalesce(sum(case when v.voucher_date >= greatest(m.period, b.start_date) and v.voucher_date < m.period + interval '1 month' then greatest(-e.amount, 0) else 0 end), 0) as debit_total,
    coalesce(sum(case when v.voucher_date >= greatest(m.period, b.start_date) and v.voucher_date < m.period + interval '1 month' then greatest(e.amount, 0) else 0 end), 0) as credit_total,
    s.opening_balance + coalesce(sum(case when v.voucher_date >= s.balance_date and v.voucher_date < m.period + interval '1 month' then e.amount else 0 end), 0) as closing_balance
  from public.tb_ledgers l
  cross join bounds b
  cross join snapshot s
  join months m on true
  left join public.tb_voucher_ledger_entries e on e.ledger_id = l.id and e.company_id = target_company
  left join public.tb_vouchers v on v.id = e.voucher_id and v.company_id = target_company and not v.is_cancelled and not v.is_deleted
  where l.id = target_ledger and l.company_id = target_company and not l.is_deleted
  group by l.id, l.name, l.parent_name, m.period, b.start_date, s.balance_date, s.opening_balance
  order by m.period;
$$;

-- Running balances in the detail ledger use the dated snapshot too.  The
-- correlated sum is intentional: a ledger can receive a newer baseline later.
create or replace view public.tb_ledger_voucher_lines as
select e.company_id,
       l.id as ledger_id,
       l.name as ledger_name,
       e.id as voucher_ledger_entry_id,
       e.line_number,
       v.id as voucher_id,
       v.voucher_date,
       v.voucher_type,
       v.voucher_number,
       coalesce(other_entries.particulars, v.party_ledger_name, v.narration, '') as particulars,
       case when e.amount < 0 then abs(e.amount) else 0::numeric end as debit_amount,
       case when e.amount >= 0 then abs(e.amount) else 0::numeric end as credit_amount,
       coalesce(snapshot.opening_balance, 0::numeric) + coalesce((
         select sum(previous_entry.amount)
         from public.tb_voucher_ledger_entries previous_entry
         join public.tb_vouchers previous_voucher on previous_voucher.id = previous_entry.voucher_id
         where previous_entry.ledger_id = e.ledger_id
           and previous_entry.company_id = e.company_id
           and not previous_voucher.is_cancelled
           and not previous_voucher.is_deleted
           and previous_voucher.voucher_date >= snapshot.balance_date
           and (previous_voucher.voucher_date, coalesce(previous_voucher.voucher_number, ''), previous_entry.line_number, previous_voucher.id)
             <= (v.voucher_date, coalesce(v.voucher_number, ''), e.line_number, v.id)
       ), 0::numeric) as running_balance
from public.tb_voucher_ledger_entries e
join public.tb_vouchers v on v.id = e.voucher_id
join public.tb_ledgers l on l.id = e.ledger_id
left join lateral (
  select s.balance_date, s.opening_balance
  from public.tb_ledger_balance_snapshots s
  where s.ledger_id = l.id
    and s.company_id = e.company_id
    and s.balance_date <= v.voucher_date
  order by s.balance_date desc
  limit 1
) snapshot on true
left join lateral (
  select string_agg(other_entry.ledger_name, ', ' order by other_entry.line_number) as particulars
  from public.tb_voucher_ledger_entries other_entry
  where other_entry.voucher_id = e.voucher_id and other_entry.id <> e.id
) other_entries on true
where not v.is_cancelled and not v.is_deleted and not l.is_deleted;
revoke all on function public.tb_history_coverage(uuid) from public, anon;
revoke all on function public.tb_trial_balance(uuid,date,date) from public, anon;
revoke all on function public.tb_ledger_monthly_summary(uuid,uuid,date,date) from public, anon;
grant execute on function public.tb_history_coverage(uuid) to authenticated;
grant execute on function public.tb_trial_balance(uuid,date,date) to authenticated;
grant execute on function public.tb_ledger_monthly_summary(uuid,uuid,date,date) to authenticated;

commit;
