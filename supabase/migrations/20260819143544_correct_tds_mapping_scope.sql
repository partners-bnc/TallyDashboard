begin;

alter table public.compliance_group_decisions
  add column ledger_group_id uuid references public.tb_ledger_groups(id) on delete cascade;

update public.compliance_group_decisions d
set ledger_group_id = g.id
from public.tb_ledger_groups g
where g.company_id = d.company_id
  and g.org_id = d.org_id
  and not g.is_deleted
  and lower(btrim(g.name)) = lower(btrim(d.group_name));

alter table public.compliance_group_decisions
  alter column ledger_group_id set not null;

alter table public.compliance_group_decisions
  drop constraint compliance_group_decisions_company_id_compliance_type_group_key;

alter table public.compliance_group_decisions
  add constraint compliance_group_decisions_company_type_group_id_key
  unique (company_id, compliance_type, ledger_group_id);

drop index if exists public.compliance_ledger_decisions_company_type_idx;

alter table public.compliance_ledger_decisions
  drop constraint compliance_ledger_decisions_check,
  drop constraint compliance_ledger_decisions_category_check,
  drop column category;

create index compliance_ledger_decisions_company_type_idx
  on public.compliance_ledger_decisions (company_id, compliance_type, selected);

drop function public.tb_save_tds_compliance_mapping(uuid, jsonb);

create function public.tb_save_tds_compliance_mapping(
  target_org uuid,
  target_company uuid,
  mapping_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := (select auth.uid());
  group_items jsonb := mapping_payload -> 'groups';
  ledger_items jsonb := mapping_payload -> 'ledgers';
  saved_profile uuid;
  now_utc timestamptz := timezone('utc', now());
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not (select public.tb_is_member(target_org)) then
    raise exception 'Organization membership required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.tb_companies c
    where c.id = target_company and c.org_id = target_org and c.is_active
  ) then
    raise exception 'Invalid active company' using errcode = '22023';
  end if;
  if jsonb_typeof(group_items) <> 'array' or jsonb_typeof(ledger_items) <> 'array' then
    raise exception 'groups and ledgers must be arrays' using errcode = '22023';
  end if;
  if jsonb_array_length(group_items) <> (
    select count(*) from public.tb_ledger_groups g
    where g.company_id = target_company and g.org_id = target_org and not g.is_deleted
  ) then
    raise exception 'Payload must include every active ledger group for the company' using errcode = '22023';
  end if;
  if (
    select count(distinct (item ->> 'groupId')::uuid)
    from jsonb_array_elements(group_items) item
  ) <> jsonb_array_length(group_items) then
    raise exception 'Ledger group entries must be unique' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(group_items) item
    left join public.tb_ledger_groups g
      on g.id = (item ->> 'groupId')::uuid
     and g.company_id = target_company
     and g.org_id = target_org
     and not g.is_deleted
    where g.id is null
  ) then
    raise exception 'Invalid ledger group in mapping payload' using errcode = '22023';
  end if;
  if jsonb_array_length(ledger_items) <> (
    select count(*) from public.tb_ledgers l
    where l.company_id = target_company and l.org_id = target_org and not l.is_deleted
  ) then
    raise exception 'Payload must include every active ledger for the company' using errcode = '22023';
  end if;
  if (
    select count(distinct (item ->> 'ledgerId')::uuid)
    from jsonb_array_elements(ledger_items) item
  ) <> jsonb_array_length(ledger_items) then
    raise exception 'Ledger entries must be unique' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(ledger_items) item
    left join public.tb_ledgers l
      on l.id = (item ->> 'ledgerId')::uuid
     and l.company_id = target_company
     and l.org_id = target_org
     and not l.is_deleted
    where l.id is null
  ) then
    raise exception 'Invalid ledger in mapping payload' using errcode = '22023';
  end if;

  insert into public.compliance_mapping_profiles (
    org_id, company_id, compliance_type, status, confirmed_by, confirmed_at, updated_at
  ) values (
    target_org, target_company, 'TDS', 'complete', actor_id, now_utc, now_utc
  )
  on conflict (company_id, compliance_type) do update set
    status = excluded.status,
    confirmed_by = excluded.confirmed_by,
    confirmed_at = excluded.confirmed_at,
    updated_at = excluded.updated_at
  returning id into saved_profile;

  delete from public.compliance_group_decisions where profile_id = saved_profile;
  insert into public.compliance_group_decisions (
    profile_id, org_id, company_id, compliance_type, ledger_group_id,
    group_name, selected, suggested, updated_at
  )
  select
    saved_profile, target_org, target_company, 'TDS', g.id,
    g.name,
    coalesce((item ->> 'selected')::boolean, false),
    coalesce((item ->> 'suggested')::boolean, false),
    now_utc
  from jsonb_array_elements(group_items) item
  join public.tb_ledger_groups g on g.id = (item ->> 'groupId')::uuid;

  delete from public.compliance_ledger_decisions where profile_id = saved_profile;
  insert into public.compliance_ledger_decisions (
    profile_id, org_id, company_id, compliance_type, ledger_id,
    selected, suggested, suggestion_reason, confirmed_by, updated_at
  )
  select
    saved_profile, target_org, target_company, 'TDS',
    (item ->> 'ledgerId')::uuid,
    coalesce((item ->> 'selected')::boolean, false),
    coalesce((item ->> 'suggested')::boolean, false),
    nullif(btrim(item ->> 'suggestionReason'), ''),
    actor_id,
    now_utc
  from jsonb_array_elements(ledger_items) item;

  update public.tds_ledger_mappings
  set is_payable_ledger = false, updated_at = now_utc
  where company_id = target_company and is_payable_ledger;

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
  from public.compliance_ledger_decisions d
  join public.tb_ledgers l on l.id = d.ledger_id
  where d.profile_id = saved_profile and d.selected
  on conflict (company_id, ledger_id, active_from) do update set
    tds_type = excluded.tds_type,
    section_code = excluded.section_code,
    is_payable_ledger = true,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'companyId', target_company,
    'confirmedAt', now_utc
  );
end;
$$;

revoke all on function public.tb_save_tds_compliance_mapping(uuid, uuid, jsonb) from public, anon;
grant execute on function public.tb_save_tds_compliance_mapping(uuid, uuid, jsonb) to authenticated;

commit;
