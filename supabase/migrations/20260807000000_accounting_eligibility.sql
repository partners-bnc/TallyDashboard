begin;

-- One authoritative definition of a voucher that affects the books. Tally
-- exports optional and order vouchers for operational reporting, but its Trial
-- Balance does not post them.
create or replace function public.tb_voucher_affects_books(voucher public.tb_vouchers)
returns boolean
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select not coalesce(voucher.is_cancelled, false)
     and not coalesce(voucher.is_deleted, false)
     and not coalesce(voucher.is_optional, false)
     and lower(trim(coalesce(voucher.voucher_type, ''))) not in ('purchase order', 'sales order')
$$;

create or replace function public.tb_trial_balance(target_company uuid, from_date date default null, to_date date default null)
returns table(ledger_id uuid, ledger_name text, parent_name text, closing_balance numeric, debit_balance numeric, credit_balance numeric)
language sql stable security invoker set search_path = public, pg_temp
as $$
  with target as (select coalesce(to_date, current_date) as as_of_date),
  coverage as (select history_baseline_date from public.tb_company_sync_state where company_id = target_company and history_reconciliation_status = 'complete'),
  balances as (
    select l.id ledger_id, l.name ledger_name, l.parent_name,
      s.opening_balance + coalesce(sum(case when v.voucher_date >= s.as_of_date and v.voucher_date <= t.as_of_date then e.amount else 0 end), 0) closing_balance
    from public.tb_ledgers l cross join target t join coverage c on t.as_of_date >= c.history_baseline_date
    join lateral (select s.as_of_date, s.opening_balance from public.tb_ledger_balance_snapshots s where s.ledger_id = l.id and s.company_id = target_company and s.as_of_date <= t.as_of_date order by s.as_of_date desc limit 1) s on true
    left join public.tb_voucher_ledger_entries e on e.ledger_id = l.id and e.company_id = target_company
    left join public.tb_vouchers v on v.id = e.voucher_id and v.company_id = target_company and public.tb_voucher_affects_books(v)
    where l.company_id = target_company and not l.is_deleted
    group by l.id, l.name, l.parent_name, s.as_of_date, s.opening_balance
  )
  select ledger_id, ledger_name, parent_name, closing_balance, greatest(-closing_balance, 0), greatest(closing_balance, 0)
  from balances order by parent_name nulls last, ledger_name
$$;

create or replace function public.tb_ledger_monthly_summary(target_company uuid, target_ledger uuid, from_date date default null, to_date date default null)
returns table(ledger_id uuid, ledger_name text, parent_name text, period date, debit_total numeric, credit_total numeric, closing_balance numeric)
language sql stable security invoker set search_path = public, pg_temp
as $$
  with coverage as (select history_baseline_date from public.tb_company_sync_state where company_id = target_company and history_reconciliation_status = 'complete'),
  bounds as (select greatest(coalesce(from_date, c.history_baseline_date), c.history_baseline_date) start_date, coalesce(to_date, current_date) end_date from coverage c),
  snapshot as (select s.as_of_date, s.opening_balance from public.tb_ledger_balance_snapshots s cross join bounds b where s.ledger_id = target_ledger and s.company_id = target_company and s.as_of_date <= b.start_date order by s.as_of_date desc limit 1),
  months as (select generate_series(date_trunc('month', b.start_date), date_trunc('month', b.end_date), interval '1 month')::date period from bounds b where b.start_date <= b.end_date)
  select l.id, l.name, l.parent_name, m.period,
    coalesce(sum(case when v.voucher_date >= greatest(m.period, b.start_date) and v.voucher_date < m.period + interval '1 month' then greatest(-e.amount, 0) else 0 end), 0),
    coalesce(sum(case when v.voucher_date >= greatest(m.period, b.start_date) and v.voucher_date < m.period + interval '1 month' then greatest(e.amount, 0) else 0 end), 0),
    s.opening_balance + coalesce(sum(case when v.voucher_date >= s.as_of_date and v.voucher_date < m.period + interval '1 month' then e.amount else 0 end), 0)
  from public.tb_ledgers l cross join bounds b cross join snapshot s join months m on true
  left join public.tb_voucher_ledger_entries e on e.ledger_id = l.id and e.company_id = target_company
  left join public.tb_vouchers v on v.id = e.voucher_id and v.company_id = target_company and public.tb_voucher_affects_books(v)
  where l.id = target_ledger and l.company_id = target_company and not l.is_deleted
  group by l.id, l.name, l.parent_name, m.period, b.start_date, s.as_of_date, s.opening_balance
  order by m.period
$$;

create or replace view public.tb_ledger_voucher_lines as
select e.company_id, l.id ledger_id, l.name ledger_name, e.id voucher_ledger_entry_id, e.line_number, v.id voucher_id, v.voucher_date, v.voucher_type, v.voucher_number,
       coalesce(other_entries.particulars, v.party_ledger_name, v.narration, '') particulars,
       case when e.amount < 0 then abs(e.amount) else 0::numeric end debit_amount,
       case when e.amount >= 0 then abs(e.amount) else 0::numeric end credit_amount,
       coalesce(snapshot.opening_balance, 0::numeric) + coalesce((
         select sum(previous_entry.amount) from public.tb_voucher_ledger_entries previous_entry join public.tb_vouchers previous_voucher on previous_voucher.id = previous_entry.voucher_id
         where previous_entry.ledger_id = e.ledger_id and previous_entry.company_id = e.company_id and public.tb_voucher_affects_books(previous_voucher)
           and previous_voucher.voucher_date >= snapshot.as_of_date
           and (previous_voucher.voucher_date, coalesce(previous_voucher.voucher_number, ''), previous_entry.line_number, previous_voucher.id) <= (v.voucher_date, coalesce(v.voucher_number, ''), e.line_number, v.id)
       ), 0::numeric) running_balance
from public.tb_voucher_ledger_entries e join public.tb_vouchers v on v.id = e.voucher_id join public.tb_ledgers l on l.id = e.ledger_id
left join lateral (select s.as_of_date, s.opening_balance from public.tb_ledger_balance_snapshots s where s.ledger_id = l.id and s.company_id = e.company_id and s.as_of_date <= v.voucher_date order by s.as_of_date desc limit 1) snapshot on true
left join lateral (select string_agg(other_entry.ledger_name, ', ' order by other_entry.line_number) particulars from public.tb_voucher_ledger_entries other_entry where other_entry.voucher_id = e.voucher_id and other_entry.id <> e.id) other_entries on true
where public.tb_voucher_affects_books(v) and not l.is_deleted;

create or replace function public.tb_dashboard_movement_totals(target_company uuid, from_date date default null, to_date date default null)
returns table(voucher_count bigint, debit_total numeric, credit_total numeric)
language sql stable security invoker set search_path = public, pg_temp
as $$
  select (select count(*) from public.tb_vouchers v where v.company_id = target_company and public.tb_voucher_affects_books(v) and (from_date is null or v.voucher_date >= from_date) and (to_date is null or v.voucher_date <= to_date)), coalesce(sum(l.debit_amount), 0), coalesce(sum(l.credit_amount), 0)
  from public.tb_ledger_voucher_lines l where l.company_id = target_company and (from_date is null or l.voucher_date >= from_date) and (to_date is null or l.voucher_date <= to_date)
$$;

create or replace function public.tb_dashboard_monthly_movement(target_company uuid, from_date date default null, to_date date default null)
returns table(period date, debit_total numeric, credit_total numeric)
language sql stable security invoker set search_path = public, pg_temp
as $$
  select date_trunc('month', l.voucher_date)::date, sum(l.debit_amount), sum(l.credit_amount) from public.tb_ledger_voucher_lines l
  where l.company_id = target_company and (from_date is null or l.voucher_date >= from_date) and (to_date is null or l.voucher_date <= to_date) group by 1 order by 1
$$;

create or replace function public.tb_dashboard_voucher_type_counts(target_company uuid, from_date date default null, to_date date default null)
returns table(voucher_type text, voucher_count bigint)
language sql stable security invoker set search_path = public, pg_temp
as $$
  select v.voucher_type, count(*) from public.tb_vouchers v where v.company_id = target_company and public.tb_voucher_affects_books(v)
    and (from_date is null or v.voucher_date >= from_date) and (to_date is null or v.voucher_date <= to_date) group by v.voucher_type order by count(*) desc
$$;

-- Ledger ClosingBalance is not a Trial Balance row for calculated Closing Stock
-- and carried-forward P&L. The direct Tally Trial Balance snapshot remains the
-- authoritative total-level comparison.
create or replace function public.tb_trial_balance_verification(target_company uuid, target_date date)
returns table (ledger_id uuid, ledger_name text, calculated_balance numeric, tally_balance numeric, difference numeric)
language sql stable security invoker set search_path = public, pg_temp
as $$
  select calculated.ledger_id, calculated.ledger_name, calculated.closing_balance, verification.closing_balance, calculated.closing_balance - verification.closing_balance
  from public.tb_trial_balance(target_company, null, target_date) calculated
  full join public.tb_tally_verification_snapshots verification on verification.company_id = target_company and verification.as_of_date = target_date and verification.ledger_id = calculated.ledger_id
  where (verification.company_id is null or verification.company_id = target_company)
    and lower(coalesce(calculated.ledger_name, verification.ledger_id::text)) not in ('closing stock', 'profit & loss a/c')
$$;

revoke all on function public.tb_voucher_affects_books(public.tb_vouchers) from public, anon;
grant execute on function public.tb_trial_balance(uuid,date,date) to authenticated;
grant execute on function public.tb_ledger_monthly_summary(uuid,uuid,date,date) to authenticated;
grant execute on function public.tb_dashboard_movement_totals(uuid,date,date) to authenticated;
grant execute on function public.tb_dashboard_monthly_movement(uuid,date,date) to authenticated;
grant execute on function public.tb_dashboard_voucher_type_counts(uuid,date,date) to authenticated;
grant execute on function public.tb_trial_balance_verification(uuid,date) to authenticated;

commit;