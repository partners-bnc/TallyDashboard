begin;

-- Dashboard read contracts. These are security-invoker functions: callers still
-- receive only rows permitted by the existing authenticated RLS policies.
create or replace function public.tb_dashboard_voucher_type_counts(target_company uuid, from_date date default null, to_date date default null)
returns table(voucher_type text, voucher_count bigint)
language sql stable security invoker set search_path = public, pg_temp
as $$
  select v.voucher_type, count(*)
  from public.tb_vouchers v
  where v.company_id = target_company
    and not v.is_cancelled and not v.is_deleted
    and (from_date is null or v.voucher_date >= from_date)
    and (to_date is null or v.voucher_date <= to_date)
  group by v.voucher_type order by count(*) desc;
$$;

create or replace function public.tb_dashboard_monthly_movement(target_company uuid, from_date date default null, to_date date default null)
returns table(period date, debit_total numeric, credit_total numeric)
language sql stable security invoker set search_path = public, pg_temp
as $$
  select date_trunc('month', l.voucher_date)::date,
    sum(l.debit_amount), sum(l.credit_amount)
  from public.tb_ledger_voucher_lines l
  where l.company_id = target_company
    and (from_date is null or l.voucher_date >= from_date)
    and (to_date is null or l.voucher_date <= to_date)
  group by 1 order by 1;
$$;

revoke all on function public.tb_dashboard_voucher_type_counts(uuid,date,date) from public, anon;
revoke all on function public.tb_dashboard_monthly_movement(uuid,date,date) from public, anon;
grant execute on function public.tb_dashboard_voucher_type_counts(uuid,date,date) to authenticated;
grant execute on function public.tb_dashboard_monthly_movement(uuid,date,date) to authenticated;

commit;
