begin;

-- Aggregate dashboard KPIs in Postgres so the server does not depend on a
-- client-side row limit when calculating all-time movement.
create or replace function public.tb_dashboard_movement_totals(
  target_company uuid,
  from_date date default null,
  to_date date default null
)
returns table(voucher_count bigint, debit_total numeric, credit_total numeric)
language sql stable security invoker set search_path = public, pg_temp
as $$
  select
    (
      select count(*)
      from public.tb_vouchers v
      where v.company_id = target_company
        and not v.is_cancelled
        and not v.is_deleted
        and (from_date is null or v.voucher_date >= from_date)
        and (to_date is null or v.voucher_date <= to_date)
    ),
    coalesce(sum(l.debit_amount), 0),
    coalesce(sum(l.credit_amount), 0)
  from public.tb_ledger_voucher_lines l
  where l.company_id = target_company
    and (from_date is null or l.voucher_date >= from_date)
    and (to_date is null or l.voucher_date <= to_date);
$$;

revoke all on function public.tb_dashboard_movement_totals(uuid,date,date) from public, anon;
grant execute on function public.tb_dashboard_movement_totals(uuid,date,date) to authenticated;

commit;
