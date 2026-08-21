begin;

-- Draft profiles were never confirmed and must not retain report mappings.
delete from public.tds_ledger_mappings m
where not exists (
  select 1
  from public.compliance_mapping_profiles p
  where p.company_id = m.company_id
    and p.compliance_type = 'TDS'
    and p.status = 'complete'
);

delete from public.compliance_mapping_profiles
where status <> 'complete';

-- Jammu's confirmed scope contains only the four payable ledgers under Tds.
delete from public.tds_ledger_mappings m
using public.tb_companies c, public.tb_ledgers l
where c.id = m.company_id
  and l.id = m.ledger_id
  and c.name ilike '%Jammu%'
  and l.name not in (
    'TDS on Contractor',
    'TDS on Professional Fees',
    'TDS on Rent',
    'TDS on Salary'
  );

drop table public.compliance_group_decisions;
drop table public.compliance_ledger_decisions;

alter table public.compliance_mapping_profiles
  alter column status set default 'complete';

alter table public.compliance_mapping_profiles
  drop constraint compliance_mapping_profiles_status_check;

alter table public.compliance_mapping_profiles
  add constraint compliance_mapping_profiles_status_check
  check (status = 'complete');

drop function if exists public.tb_save_tds_compliance_mapping(uuid, uuid, jsonb);

create function public.tb_save_tds_compliance_mapping(
  target_org uuid,
  target_company uuid,
  selected_ledger_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
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
$$;

drop policy if exists "tds_ledger_mappings_delete_member" on public.tds_ledger_mappings;
create policy "tds_ledger_mappings_delete_member"
  on public.tds_ledger_mappings for delete to authenticated
  using ((select public.tb_is_member(org_id)));

grant delete on table public.tds_ledger_mappings to authenticated;
revoke all on function public.tb_save_tds_compliance_mapping(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.tb_save_tds_compliance_mapping(uuid, uuid, uuid[]) to authenticated;

commit;
