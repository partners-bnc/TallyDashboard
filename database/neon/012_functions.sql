-- Generated from the live Supabase function definitions on 2026-08-21.
-- Apply after 010_functions.sql and 011_view.sql.

CREATE OR REPLACE FUNCTION public.tb_dashboard_monthly_movement(target_company uuid, from_date date DEFAULT NULL::date, to_date date DEFAULT NULL::date)
 RETURNS TABLE(period date, debit_total numeric, credit_total numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select date_trunc('month', l.voucher_date)::date, sum(l.debit_amount), sum(l.credit_amount) from public.tb_ledger_voucher_lines l
  where l.company_id = target_company and (from_date is null or l.voucher_date >= from_date) and (to_date is null or l.voucher_date <= to_date) group by 1 order by 1
$function$;

CREATE OR REPLACE FUNCTION public.tb_dashboard_movement_totals(target_company uuid, from_date date DEFAULT NULL::date, to_date date DEFAULT NULL::date)
 RETURNS TABLE(voucher_count bigint, debit_total numeric, credit_total numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select (select count(*) from public.tb_vouchers v where v.company_id = target_company and public.tb_voucher_affects_books(v) and (from_date is null or v.voucher_date >= from_date) and (to_date is null or v.voucher_date <= to_date)), coalesce(sum(l.debit_amount), 0), coalesce(sum(l.credit_amount), 0)
  from public.tb_ledger_voucher_lines l where l.company_id = target_company and (from_date is null or l.voucher_date >= from_date) and (to_date is null or l.voucher_date <= to_date)
$function$;

CREATE OR REPLACE FUNCTION public.tb_dashboard_voucher_type_counts(target_company uuid, from_date date DEFAULT NULL::date, to_date date DEFAULT NULL::date)
 RETURNS TABLE(voucher_type text, voucher_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select v.voucher_type, count(*) from public.tb_vouchers v where v.company_id = target_company and public.tb_voucher_affects_books(v)
    and (from_date is null or v.voucher_date >= from_date) and (to_date is null or v.voucher_date <= to_date) group by v.voucher_type order by count(*) desc
$function$;

CREATE OR REPLACE FUNCTION public.tb_history_coverage(target_company uuid)
 RETURNS TABLE(baseline_date date, earliest_voucher_date date, latest_voucher_date date, reconciliation_status text, reconciled_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$ select s.history_baseline_date, s.history_earliest_voucher_date, s.history_latest_voucher_date, s.history_reconciliation_status, s.history_reconciled_at from public.tb_company_sync_state s where s.company_id = target_company; $function$;

CREATE OR REPLACE FUNCTION public.tb_ledger_monthly_summary(target_company uuid, target_ledger uuid, from_date date DEFAULT NULL::date, to_date date DEFAULT NULL::date)
 RETURNS TABLE(ledger_id uuid, ledger_name text, parent_name text, period date, debit_total numeric, credit_total numeric, closing_balance numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.tb_save_tds_compliance_mapping(target_org uuid, target_company uuid, selected_ledger_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  actor_id uuid := (select auth.uid());
  selected_count integer;
  distinct_selected_count integer;
  invalid_selected_count integer;
  now_utc timestamptz := timezone('utc', now());
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not (select public.tb_is_member(target_org)) then
    raise exception 'Organization membership required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.tb_companies c
    where c.id = target_company
      and c.org_id = target_org
      and c.is_active
  ) then
    raise exception 'Invalid active company' using errcode = '22023';
  end if;
  if selected_ledger_ids is null then
    raise exception 'selectedLedgerIds must be an array' using errcode = '22023';
  end if;

  select count(*), count(distinct ledger_id)
  into selected_count, distinct_selected_count
  from unnest(selected_ledger_ids) as selected(ledger_id);

  if selected_count <> distinct_selected_count then
    raise exception 'Selected ledger IDs must be unique and non-null' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.tb_ledger_groups g
    where g.org_id = target_org
      and g.company_id = target_company
      and not g.is_deleted
      and (
        regexp_replace(lower(g.name), '[^a-z0-9]+', ' ', 'g') ~ '(^| )tds( |$)'
        or regexp_replace(lower(g.name), '[^a-z0-9]+', ' ', 'g') like '%tax deducted at source%'
      )
  ) then
    raise exception 'No TDS ledger group was found for this company' using errcode = '22023';
  end if;

  with recursive tds_groups as (
    select g.id, g.name, array[g.id] as path
    from public.tb_ledger_groups g
    where g.org_id = target_org
      and g.company_id = target_company
      and not g.is_deleted
      and (
        regexp_replace(lower(g.name), '[^a-z0-9]+', ' ', 'g') ~ '(^| )tds( |$)'
        or regexp_replace(lower(g.name), '[^a-z0-9]+', ' ', 'g') like '%tax deducted at source%'
      )

    union all

    select child.id, child.name, parent.path || child.id
    from public.tb_ledger_groups child
    join tds_groups parent on (
      child.parent_group_id = parent.id
      or (
        child.parent_group_id is null
        and btrim(regexp_replace(lower(child.parent_name), '[^a-z0-9]+', ' ', 'g'))
          = btrim(regexp_replace(lower(parent.name), '[^a-z0-9]+', ' ', 'g'))
      )
    )
    where child.org_id = target_org
      and child.company_id = target_company
      and not child.is_deleted
      and not child.id = any(parent.path)
  )
  select count(*)
  into invalid_selected_count
  from unnest(selected_ledger_ids) as selected(ledger_id)
  left join public.tb_ledgers l
    on l.id = selected.ledger_id
   and l.org_id = target_org
   and l.company_id = target_company
   and not l.is_deleted
  where l.id is null
     or regexp_replace(lower(l.name), '[^a-z0-9]+', ' ', 'g')
          ~ '(receiv|recover|interest|penalt|late fee|late filing|filing fee|234e)'
     or not exists (
       select 1
       from tds_groups g
       where g.id = l.parent_group_id
          or (
            l.parent_group_id is null
            and btrim(regexp_replace(lower(l.parent_name), '[^a-z0-9]+', ' ', 'g'))
              = btrim(regexp_replace(lower(g.name), '[^a-z0-9]+', ' ', 'g'))
          )
     );

  if invalid_selected_count > 0 then
    raise exception 'Selected ledgers must be payable members of the TDS hierarchy' using errcode = '22023';
  end if;

  delete from public.tds_ledger_mappings
  where org_id = target_org and company_id = target_company;

  insert into public.tds_ledger_mappings (
    org_id, company_id, ledger_id, tds_type, section_code,
    is_payable_ledger, updated_at
  )
  select
    target_org,
    target_company,
    l.id,
    case
      when upper(l.name) ~ '(^|[^0-9])192([^0-9A-Z]|$)' or lower(l.name) like '%salary%' then 'Salary'
      when upper(l.name) ~ '194[[:space:]]*C' or lower(l.name) ~ 'contract' then 'Contractor'
      when upper(l.name) ~ '194[[:space:]]*I' or lower(l.name) ~ 'rent' then 'Rent'
      when upper(l.name) ~ '194[[:space:]]*J' or lower(l.name) ~ 'professional|technical' then 'Professional Fees'
      else l.name
    end,
    case
      when upper(l.name) ~ '(^|[^0-9])192([^0-9A-Z]|$)' or lower(l.name) like '%salary%' then '192'
      when upper(l.name) ~ '194[[:space:]]*C' or lower(l.name) ~ 'contract' then '194C'
      when upper(l.name) ~ '194[[:space:]]*I' or lower(l.name) ~ 'rent' then '194I'
      when upper(l.name) ~ '194[[:space:]]*J' or lower(l.name) ~ 'professional|technical' then '194J'
      else null
    end,
    true,
    now_utc
  from public.tb_ledgers l
  join unnest(selected_ledger_ids) as selected(ledger_id) on selected.ledger_id = l.id;

  insert into public.compliance_mapping_profiles (
    org_id, company_id, compliance_type, status, confirmed_by, confirmed_at, updated_at
  ) values (
    target_org, target_company, 'TDS', 'complete', actor_id, now_utc, now_utc
  )
  on conflict (company_id, compliance_type) do update set
    org_id = excluded.org_id,
    status = excluded.status,
    confirmed_by = excluded.confirmed_by,
    confirmed_at = excluded.confirmed_at,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'companyId', target_company,
    'selectedLedgerCount', selected_count,
    'confirmedAt', now_utc
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.tb_tds_source_lines(target_company uuid, target_as_of date)
 RETURNS TABLE(mapping_id uuid, org_id uuid, company_id uuid, ledger_id uuid, ledger_name text, tds_type text, section_code text, rounding_tolerance numeric, journal_treatment text, liability_voucher_types text[], deposit_voucher_types text[], voucher_ledger_entry_id uuid, voucher_id uuid, voucher_date date, voucher_type text, voucher_number text, party_ledger_name text, narration text, line_number integer, raw_signed_amount numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.tb_trial_balance(target_company uuid, from_date date DEFAULT NULL::date, to_date date DEFAULT NULL::date)
 RETURNS TABLE(ledger_id uuid, ledger_name text, parent_name text, closing_balance numeric, debit_balance numeric, credit_balance numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.tb_trial_balance_verification(target_company uuid, target_date date)
 RETURNS TABLE(ledger_id uuid, ledger_name text, calculated_balance numeric, tally_balance numeric, difference numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select calculated.ledger_id, calculated.ledger_name, calculated.closing_balance, verification.closing_balance, calculated.closing_balance - verification.closing_balance
  from public.tb_trial_balance(target_company, null, target_date) calculated
  full join public.tb_tally_verification_snapshots verification on verification.company_id = target_company and verification.as_of_date = target_date and verification.ledger_id = calculated.ledger_id
  where (verification.company_id is null or verification.company_id = target_company)
    and lower(coalesce(calculated.ledger_name, verification.ledger_id::text)) not in ('closing stock', 'profit & loss a/c')
$function$;




