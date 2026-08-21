begin;

do $$
begin
  if exists (select 1 from public.tds_due_date_overrides) then
    raise exception 'tds_due_date_overrides must be empty before removal';
  end if;

  if exists (select 1 from public.tds_transaction_overrides) then
    raise exception 'tds_transaction_overrides must be empty before removal';
  end if;

  if (select count(*) from public.tds_due_date_rules) <> 12
    or exists (
      select 1
      from public.tds_due_date_rules
      where rule_code <> 'NON_GOVERNMENT_STANDARD'
        or deduction_month not between 1 and 12
        or due_month_offset <> 1
        or due_day <> case when deduction_month = 3 then 30 else 7 end
        or effective_from <> date '1900-01-01'
        or effective_to is not null
    ) then
    raise exception 'tds_due_date_rules contains unexpected rules; review before removal';
  end if;
end;
$$;

drop function public.tb_tds_source_lines(uuid, date);

alter table public.tds_ledger_mappings
  drop column due_rule_code;

drop table public.tds_due_date_overrides;
drop table public.tds_due_date_rules;
drop table public.tds_transaction_overrides;

create function public.tb_tds_source_lines(target_company uuid, target_as_of date)
returns table(
  mapping_id uuid,
  org_id uuid,
  company_id uuid,
  ledger_id uuid,
  ledger_name text,
  tds_type text,
  section_code text,
  rounding_tolerance numeric,
  journal_treatment text,
  liability_voucher_types text[],
  deposit_voucher_types text[],
  voucher_ledger_entry_id uuid,
  voucher_id uuid,
  voucher_date date,
  voucher_type text,
  voucher_number text,
  party_ledger_name text,
  narration text,
  line_number integer,
  raw_signed_amount numeric
)
language sql stable security invoker set search_path = public, pg_temp
as $$
  select
    m.id,
    m.org_id,
    m.company_id,
    m.ledger_id,
    l.name,
    m.tds_type,
    m.section_code,
    m.rounding_tolerance,
    m.journal_treatment,
    m.liability_voucher_types,
    m.deposit_voucher_types,
    e.id,
    v.id,
    v.voucher_date,
    v.voucher_type,
    v.voucher_number,
    v.party_ledger_name,
    v.narration,
    e.line_number,
    e.amount
  from public.tds_ledger_mappings m
  join public.tb_ledgers l on l.id = m.ledger_id and not l.is_deleted
  join public.tb_voucher_ledger_entries e
    on e.company_id = m.company_id and e.ledger_id = m.ledger_id
  join public.tb_vouchers v
    on v.id = e.voucher_id and v.company_id = m.company_id
  where m.company_id = target_company
    and m.is_payable_ledger
    and v.voucher_date <= target_as_of
    and v.voucher_date >= m.active_from
    and (m.active_to is null or v.voucher_date <= m.active_to)
    and public.tb_voucher_affects_books(v)
  order by m.ledger_id, v.voucher_date, v.id, e.line_number;
$$;

revoke all on function public.tb_tds_source_lines(uuid, date) from public, anon;
grant execute on function public.tb_tds_source_lines(uuid, date) to authenticated;

commit;
