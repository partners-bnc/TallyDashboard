begin;

-- is_deemed_positive describes ledger balance nature; the signed amount is
-- what determines whether an imported Tally entry is debit or credit.
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
       coalesce(l.opening_balance, 0::numeric)
         + sum(e.amount) over (
             partition by l.id
             order by v.voucher_date, coalesce(v.voucher_number, ''), e.line_number, v.id
             rows between unbounded preceding and current row
           ) as running_balance
from public.tb_voucher_ledger_entries e
join public.tb_vouchers v on v.id = e.voucher_id
join public.tb_ledgers l on l.id = e.ledger_id
left join lateral (
  select string_agg(other_entry.ledger_name, ', ' order by other_entry.line_number) as particulars
  from public.tb_voucher_ledger_entries other_entry
  where other_entry.voucher_id = e.voucher_id
    and other_entry.id <> e.id
) other_entries on true
where not v.is_cancelled
  and not v.is_deleted
  and not l.is_deleted;

commit;
