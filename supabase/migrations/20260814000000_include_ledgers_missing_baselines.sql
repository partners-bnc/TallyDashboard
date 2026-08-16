begin;

-- Ledgers created after a company's one-time history reconciliation did not
-- receive a baseline snapshot. Backfill them at the established company
-- baseline so the Trial Balance includes them immediately.
insert into public.tb_ledger_balance_snapshots (
  ledger_id, company_id, org_id, as_of_date,
  opening_balance, debit_total, credit_total, closing_balance
)
select
  l.id, l.company_id, l.org_id, state.history_baseline_date,
  coalesce(l.opening_balance, 0), 0, 0, coalesce(l.opening_balance, 0)
from public.tb_ledgers l
join public.tb_company_sync_state state
  on state.company_id = l.company_id
 and state.history_reconciliation_status = 'complete'
 and state.history_baseline_date is not null
where not l.is_deleted
  and not exists (
    select 1
    from public.tb_ledger_balance_snapshots snapshot
    where snapshot.ledger_id = l.id
      and snapshot.company_id = l.company_id
      and snapshot.as_of_date = state.history_baseline_date
  )
on conflict (ledger_id, as_of_date) do nothing;

-- Never silently omit an active ledger merely because ingestion and snapshot
-- creation briefly raced. Prefer the latest dated snapshot, and fall back to
-- the reconciled company baseline plus the ledger's books-start opening value.
create or replace function public.tb_trial_balance(target_company uuid, from_date date default null, to_date date default null)
returns table(ledger_id uuid, ledger_name text, parent_name text, closing_balance numeric, debit_balance numeric, credit_balance numeric)
language sql stable security invoker set search_path = public, pg_temp
as $$
  with target as (
    select coalesce(to_date, current_date) as as_of_date
  ),
  coverage as (
    select history_baseline_date
    from public.tb_company_sync_state
    where company_id = target_company
      and history_reconciliation_status = 'complete'
  ),
  balances as (
    select
      l.id as ledger_id,
      l.name as ledger_name,
      l.parent_name,
      coalesce(snapshot.opening_balance, l.opening_balance, 0)
        + coalesce(sum(case
            when v.voucher_date >= coalesce(snapshot.as_of_date, coverage.history_baseline_date)
             and v.voucher_date <= target.as_of_date
            then e.amount else 0
          end), 0) as closing_balance
    from public.tb_ledgers l
    cross join target
    join coverage on target.as_of_date >= coverage.history_baseline_date
    left join lateral (
      select s.as_of_date, s.opening_balance
      from public.tb_ledger_balance_snapshots s
      where s.ledger_id = l.id
        and s.company_id = target_company
        and s.as_of_date <= target.as_of_date
      order by s.as_of_date desc
      limit 1
    ) snapshot on true
    left join public.tb_voucher_ledger_entries e
      on e.ledger_id = l.id and e.company_id = target_company
    left join public.tb_vouchers v
      on v.id = e.voucher_id
     and v.company_id = target_company
     and public.tb_voucher_affects_books(v)
    where l.company_id = target_company
      and not l.is_deleted
    group by l.id, l.name, l.parent_name, l.opening_balance,
      coverage.history_baseline_date, snapshot.as_of_date,
      snapshot.opening_balance
  )
  select
    ledger_id,
    ledger_name,
    parent_name,
    closing_balance,
    greatest(-closing_balance, 0),
    greatest(closing_balance, 0)
  from balances
  order by parent_name nulls last, ledger_name
$$;

revoke all on function public.tb_trial_balance(uuid,date,date) from public, anon;
grant execute on function public.tb_trial_balance(uuid,date,date) to authenticated;

commit;
