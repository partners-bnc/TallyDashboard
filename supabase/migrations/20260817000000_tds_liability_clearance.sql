begin;

create table public.tds_ledger_mappings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.tb_organizations(id) on delete cascade,
  company_id uuid not null references public.tb_companies(id) on delete cascade,
  ledger_id uuid not null references public.tb_ledgers(id) on delete cascade,
  tds_type text not null,
  section_code text,
  is_payable_ledger boolean not null default true,
  rounding_tolerance numeric(18,2) not null default 1 check (rounding_tolerance >= 0),
  active_from date not null default date '1900-01-01',
  active_to date,
  due_rule_code text not null default 'NON_GOVERNMENT_STANDARD',
  liability_voucher_types text[] not null default array['Purchase', 'Journal']::text[],
  deposit_voucher_types text[] not null default array['Payment']::text[],
  journal_treatment text not null default 'MAPPED_BY_SIGN'
    check (journal_treatment in ('MAPPED_BY_SIGN', 'REVIEW_REQUIRED')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (active_to is null or active_to >= active_from),
  unique (company_id, ledger_id, active_from)
);

create index tds_ledger_mappings_company_active_idx
  on public.tds_ledger_mappings (company_id, active_from, active_to)
  where is_payable_ledger;

create table public.tds_due_date_rules (
  rule_code text not null,
  deduction_month smallint not null check (deduction_month between 1 and 12),
  due_month_offset smallint not null check (due_month_offset between 0 and 2),
  due_day smallint not null check (due_day between 1 and 31),
  effective_from date not null default date '1900-01-01',
  effective_to date,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (rule_code, deduction_month, effective_from),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.tds_due_date_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.tb_organizations(id) on delete cascade,
  company_id uuid not null references public.tb_companies(id) on delete cascade,
  ledger_id uuid references public.tb_ledgers(id) on delete cascade,
  deduction_month date not null check (deduction_month = date_trunc('month', deduction_month)::date),
  due_date date not null,
  reason text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (company_id, ledger_id, deduction_month)
);

create index tds_due_date_overrides_company_month_idx
  on public.tds_due_date_overrides (company_id, deduction_month);

create table public.tds_transaction_overrides (
  voucher_ledger_entry_id uuid primary key references public.tb_voucher_ledger_entries(id) on delete cascade,
  org_id uuid not null references public.tb_organizations(id) on delete cascade,
  company_id uuid not null references public.tb_companies(id) on delete cascade,
  ledger_id uuid not null references public.tb_ledgers(id) on delete cascade,
  classification text not null check (classification in (
    'DEDUCTION', 'REVERSAL', 'ADJUSTMENT', 'DEPOSIT', 'PAYMENT_REVERSAL', 'EXCLUDE'
  )),
  related_voucher_ledger_entry_id uuid references public.tb_voucher_ledger_entries(id) on delete set null,
  note text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index tds_transaction_overrides_company_ledger_idx
  on public.tds_transaction_overrides (company_id, ledger_id);

alter table public.tds_ledger_mappings enable row level security;
alter table public.tds_due_date_rules enable row level security;
alter table public.tds_due_date_overrides enable row level security;
alter table public.tds_transaction_overrides enable row level security;

create policy "tds_ledger_mappings_read_member"
  on public.tds_ledger_mappings for select to authenticated
  using ((select public.tb_is_member(org_id)));

create policy "tds_due_date_rules_read_authenticated"
  on public.tds_due_date_rules for select to authenticated
  using (true);

create policy "tds_due_date_overrides_read_member"
  on public.tds_due_date_overrides for select to authenticated
  using ((select public.tb_is_member(org_id)));

create policy "tds_transaction_overrides_read_member"
  on public.tds_transaction_overrides for select to authenticated
  using ((select public.tb_is_member(org_id)));

revoke all on table public.tds_ledger_mappings, public.tds_due_date_rules,
  public.tds_due_date_overrides, public.tds_transaction_overrides from public, anon;
grant select on table public.tds_ledger_mappings, public.tds_due_date_rules,
  public.tds_due_date_overrides, public.tds_transaction_overrides to authenticated;

insert into public.tds_due_date_rules (rule_code, deduction_month, due_month_offset, due_day)
select 'NON_GOVERNMENT_STANDARD', month_number, 1,
  case when month_number = 3 then 30 else 7 end
from generate_series(1, 12) as month_number
on conflict do nothing;

insert into public.tds_ledger_mappings (
  org_id, company_id, ledger_id, tds_type, section_code,
  liability_voucher_types, deposit_voucher_types, journal_treatment
)
select
  l.org_id,
  l.company_id,
  l.id,
  case
    when lower(l.name) like '%contract%' then 'Contractor'
    when lower(l.name) like '%professional%' or lower(l.name) like '%94j%' then 'Professional Fees'
    when lower(l.name) like '%rent%' then 'Rent'
    when lower(l.name) like '%salary%' then 'Salary'
    else l.name
  end,
  case
    when lower(l.name) like '%contract%' then '194C'
    when lower(l.name) like '%professional%' or lower(l.name) like '%94j%' then '194J'
    when lower(l.name) like '%rent%' then '194I'
    when lower(l.name) like '%salary%' then '192'
    else null
  end,
  array['Purchase', 'Journal']::text[],
  array['Payment']::text[],
  'MAPPED_BY_SIGN'
from public.tb_ledgers l
join public.tb_companies c on c.id = l.company_id
where c.is_active
  and not l.is_deleted
  and lower(trim(coalesce(l.parent_name, ''))) = 'tds'
on conflict (company_id, ledger_id, active_from) do nothing;

create or replace function public.tb_tds_source_lines(target_company uuid, target_as_of date)
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
  raw_signed_amount numeric,
  override_classification text,
  related_voucher_ledger_entry_id uuid,
  override_note text
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
    e.amount,
    o.classification,
    o.related_voucher_ledger_entry_id,
    o.note
  from public.tds_ledger_mappings m
  join public.tb_ledgers l on l.id = m.ledger_id and not l.is_deleted
  join public.tb_voucher_ledger_entries e
    on e.company_id = m.company_id and e.ledger_id = m.ledger_id
  join public.tb_vouchers v
    on v.id = e.voucher_id and v.company_id = m.company_id
  left join public.tds_transaction_overrides o
    on o.voucher_ledger_entry_id = e.id
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
