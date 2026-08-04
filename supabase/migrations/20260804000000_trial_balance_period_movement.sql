begin;

drop function if exists public.tb_trial_balance(uuid, date, date);

create function public.tb_trial_balance(target_company uuid, from_date date default null, to_date date default null)
returns table(ledger_id uuid, ledger_name text, parent_name text, opening_balance numeric, debit_total numeric, credit_total numeric, closing_balance numeric)
language sql stable security invoker set search_path = public, pg_temp
as $$
  with ledger_activity as (
    select
      l.id as ledger_id,
      l.name as ledger_name,
      l.parent_name,
      coalesce(l.opening_balance, 0)::numeric as ledger_opening_balance,
      coalesce(sum(case when from_date is not null and v.voucher_date < from_date then e.amount else 0 end), 0) as pre_period_movement,
      coalesce(sum(case when (from_date is null or v.voucher_date >= from_date) and (to_date is null or v.voucher_date <= to_date) then greatest(-e.amount, 0) else 0 end), 0) as debit_total,
      coalesce(sum(case when (from_date is null or v.voucher_date >= from_date) and (to_date is null or v.voucher_date <= to_date) then greatest(e.amount, 0) else 0 end), 0) as credit_total
    from public.tb_ledgers l
    left join public.tb_voucher_ledger_entries e on e.ledger_id = l.id and e.company_id = target_company
    left join public.tb_vouchers v on v.id = e.voucher_id and v.company_id = target_company and not v.is_cancelled and not v.is_deleted
    where l.company_id = target_company and not l.is_deleted
    group by l.id, l.name, l.parent_name, l.opening_balance
  )
  select
    ledger_id,
    ledger_name,
    parent_name,
    ledger_opening_balance + pre_period_movement as opening_balance,
    debit_total,
    credit_total,
    ledger_opening_balance + pre_period_movement + credit_total - debit_total as closing_balance
  from ledger_activity
  order by parent_name nulls last, ledger_name;
$$;

revoke all on function public.tb_trial_balance(uuid, date, date) from public, anon;
grant execute on function public.tb_trial_balance(uuid, date, date) to authenticated;

commit;
