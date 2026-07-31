begin;

create or replace function public.tb_trial_balance(target_company uuid, from_date date default null, to_date date default null)
returns table(ledger_id uuid, ledger_name text, parent_name text, closing_balance numeric, debit_balance numeric, credit_balance numeric)
language sql stable security invoker set search_path = public, pg_temp
as $$
  select l.id, l.name, l.parent_name,
    coalesce(l.opening_balance, 0) + coalesce(sum(case when v.id is not null and (to_date is null or v.voucher_date <= to_date) then e.amount else 0 end), 0),
    greatest(-(coalesce(l.opening_balance, 0) + coalesce(sum(case when v.id is not null and (to_date is null or v.voucher_date <= to_date) then e.amount else 0 end), 0)), 0),
    greatest(coalesce(l.opening_balance, 0) + coalesce(sum(case when v.id is not null and (to_date is null or v.voucher_date <= to_date) then e.amount else 0 end), 0), 0)
  from public.tb_ledgers l
  left join public.tb_voucher_ledger_entries e on e.ledger_id = l.id and e.company_id = target_company
  left join public.tb_vouchers v on v.id = e.voucher_id and v.company_id = target_company and not v.is_cancelled and not v.is_deleted
  where l.company_id = target_company and not l.is_deleted
  group by l.id, l.name, l.parent_name, l.opening_balance
  order by l.parent_name nulls last, l.name;
$$;

create or replace function public.tb_ledger_monthly_summary(target_company uuid, target_ledger uuid, from_date date default null, to_date date default null)
returns table(ledger_id uuid, ledger_name text, parent_name text, period date, debit_total numeric, credit_total numeric, closing_balance numeric)
language sql stable security invoker set search_path = public, pg_temp
as $$
  with ledger_scope as (
    select l.id, l.name, l.parent_name, coalesce(l.opening_balance, 0)::numeric as opening_balance
    from public.tb_ledgers l
    where l.id = target_ledger and l.company_id = target_company and not l.is_deleted
  ), bounds as (
    select s.*, date_trunc('month', coalesce(from_date, min(v.voucher_date)))::date as first_month,
      date_trunc('month', coalesce(to_date, max(v.voucher_date)))::date as last_month
    from ledger_scope s
    left join public.tb_voucher_ledger_entries e on e.ledger_id = s.id and e.company_id = target_company
    left join public.tb_vouchers v on v.id = e.voucher_id and v.company_id = target_company and not v.is_cancelled and not v.is_deleted
    group by s.id, s.name, s.parent_name, s.opening_balance
  ), months as (
    select b.*, generate_series(b.first_month, b.last_month, interval '1 month')::date as month_start
    from bounds b where b.first_month is not null and b.last_month is not null and b.first_month <= b.last_month
  ), movement as (
    select m.*, coalesce(sum(case when v.voucher_date >= m.month_start and v.voucher_date < m.month_start + interval '1 month' and (from_date is null or v.voucher_date >= from_date) and (to_date is null or v.voucher_date <= to_date) then greatest(-e.amount, 0) else 0 end), 0) as debit_total,
      coalesce(sum(case when v.voucher_date >= m.month_start and v.voucher_date < m.month_start + interval '1 month' and (from_date is null or v.voucher_date >= from_date) and (to_date is null or v.voucher_date <= to_date) then greatest(e.amount, 0) else 0 end), 0) as credit_total,
      coalesce(sum(case when v.voucher_date < m.month_start + interval '1 month' then e.amount else 0 end), 0) as movement_to_month
    from months m
    left join public.tb_voucher_ledger_entries e on e.ledger_id = m.id and e.company_id = target_company
    left join public.tb_vouchers v on v.id = e.voucher_id and v.company_id = target_company and not v.is_cancelled and not v.is_deleted
    group by m.id, m.name, m.parent_name, m.opening_balance, m.first_month, m.last_month, m.month_start
  )
  select id, name, parent_name, month_start, debit_total, credit_total, opening_balance + movement_to_month
  from movement order by month_start;
$$;

revoke all on function public.tb_trial_balance(uuid,date,date) from public, anon;
revoke all on function public.tb_ledger_monthly_summary(uuid,uuid,date,date) from public, anon;
grant execute on function public.tb_trial_balance(uuid,date,date) to authenticated;
grant execute on function public.tb_ledger_monthly_summary(uuid,uuid,date,date) to authenticated;

commit;
