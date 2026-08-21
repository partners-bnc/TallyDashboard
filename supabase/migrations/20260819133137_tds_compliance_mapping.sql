begin;

create table public.compliance_mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.tb_organizations(id) on delete cascade,
  company_id uuid not null references public.tb_companies(id) on delete cascade,
  compliance_type text not null check (compliance_type ~ '^[A-Z][A-Z0-9_]*$'),
  status text not null default 'draft' check (status in ('draft', 'complete')),
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, compliance_type),
  unique (id, org_id, company_id, compliance_type),
  check ((status = 'complete' and confirmed_by is not null and confirmed_at is not null) or status = 'draft')
);

create table public.compliance_group_decisions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  org_id uuid not null,
  company_id uuid not null,
  compliance_type text not null,
  group_name text not null check (length(btrim(group_name)) > 0),
  selected boolean not null,
  suggested boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (profile_id, org_id, company_id, compliance_type)
    references public.compliance_mapping_profiles(id, org_id, company_id, compliance_type)
    on delete cascade,
  unique (company_id, compliance_type, group_name)
);

create table public.compliance_ledger_decisions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  org_id uuid not null,
  company_id uuid not null,
  compliance_type text not null,
  ledger_id uuid not null references public.tb_ledgers(id) on delete cascade,
  selected boolean not null,
  category text check (category in ('PAYABLE', 'RECEIVABLE', 'INTEREST', 'PENALTY_FEE', 'OTHER')),
  suggested boolean not null default false,
  suggestion_reason text,
  confirmed_by uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (profile_id, org_id, company_id, compliance_type)
    references public.compliance_mapping_profiles(id, org_id, company_id, compliance_type)
    on delete cascade,
  unique (company_id, compliance_type, ledger_id),
  check ((selected and category is not null) or (not selected))
);

create index compliance_mapping_profiles_org_type_idx
  on public.compliance_mapping_profiles (org_id, compliance_type, status);
create index compliance_group_decisions_company_type_idx
  on public.compliance_group_decisions (company_id, compliance_type, selected);
create index compliance_ledger_decisions_company_type_idx
  on public.compliance_ledger_decisions (company_id, compliance_type, selected, category);

alter table public.compliance_mapping_profiles enable row level security;
alter table public.compliance_group_decisions enable row level security;
alter table public.compliance_ledger_decisions enable row level security;

create policy "compliance_profiles_read_member"
  on public.compliance_mapping_profiles for select to authenticated
  using ((select public.tb_is_member(org_id)));
create policy "compliance_profiles_insert_member"
  on public.compliance_mapping_profiles for insert to authenticated
  with check (
    (select public.tb_is_member(org_id))
    and exists (
      select 1 from public.tb_companies c
      where c.id = company_id and c.org_id = org_id
    )
  );
create policy "compliance_profiles_update_member"
  on public.compliance_mapping_profiles for update to authenticated
  using ((select public.tb_is_member(org_id)))
  with check (
    (select public.tb_is_member(org_id))
    and exists (
      select 1 from public.tb_companies c
      where c.id = company_id and c.org_id = org_id
    )
  );
create policy "compliance_profiles_delete_member"
  on public.compliance_mapping_profiles for delete to authenticated
  using ((select public.tb_is_member(org_id)));

create policy "compliance_groups_read_member"
  on public.compliance_group_decisions for select to authenticated
  using ((select public.tb_is_member(org_id)));
create policy "compliance_groups_insert_member"
  on public.compliance_group_decisions for insert to authenticated
  with check ((select public.tb_is_member(org_id)));
create policy "compliance_groups_update_member"
  on public.compliance_group_decisions for update to authenticated
  using ((select public.tb_is_member(org_id)))
  with check ((select public.tb_is_member(org_id)));
create policy "compliance_groups_delete_member"
  on public.compliance_group_decisions for delete to authenticated
  using ((select public.tb_is_member(org_id)));

create policy "compliance_ledgers_read_member"
  on public.compliance_ledger_decisions for select to authenticated
  using ((select public.tb_is_member(org_id)));
create policy "compliance_ledgers_insert_member"
  on public.compliance_ledger_decisions for insert to authenticated
  with check (
    (select public.tb_is_member(org_id))
    and exists (
      select 1 from public.tb_ledgers l
      where l.id = ledger_id and l.company_id = company_id and l.org_id = org_id
    )
  );
create policy "compliance_ledgers_update_member"
  on public.compliance_ledger_decisions for update to authenticated
  using ((select public.tb_is_member(org_id)))
  with check (
    (select public.tb_is_member(org_id))
    and exists (
      select 1 from public.tb_ledgers l
      where l.id = ledger_id and l.company_id = company_id and l.org_id = org_id
    )
  );
create policy "compliance_ledgers_delete_member"
  on public.compliance_ledger_decisions for delete to authenticated
  using ((select public.tb_is_member(org_id)));

grant select, insert, update, delete on table
  public.compliance_mapping_profiles,
  public.compliance_group_decisions,
  public.compliance_ledger_decisions
to authenticated;

create policy "tds_ledger_mappings_insert_member"
  on public.tds_ledger_mappings for insert to authenticated
  with check (
    (select public.tb_is_member(org_id))
    and exists (
      select 1 from public.tb_ledgers l
      where l.id = ledger_id and l.company_id = company_id and l.org_id = org_id
    )
  );
create policy "tds_ledger_mappings_update_member"
  on public.tds_ledger_mappings for update to authenticated
  using ((select public.tb_is_member(org_id)))
  with check (
    (select public.tb_is_member(org_id))
    and exists (
      select 1 from public.tb_ledgers l
      where l.id = ledger_id and l.company_id = company_id and l.org_id = org_id
    )
  );
grant insert, update on table public.tds_ledger_mappings to authenticated;

insert into public.compliance_mapping_profiles (
  org_id, company_id, compliance_type, status
)
select distinct m.org_id, m.company_id, 'TDS', 'draft'
from public.tds_ledger_mappings m
on conflict (company_id, compliance_type) do nothing;

insert into public.compliance_group_decisions (
  profile_id, org_id, company_id, compliance_type, group_name, selected, suggested
)
select distinct p.id, m.org_id, m.company_id, 'TDS', coalesce(nullif(btrim(l.parent_name), ''), 'Unassigned'), true, false
from public.tds_ledger_mappings m
join public.tb_ledgers l on l.id = m.ledger_id
join public.compliance_mapping_profiles p
  on p.company_id = m.company_id and p.compliance_type = 'TDS'
on conflict (company_id, compliance_type, group_name) do nothing;

insert into public.compliance_ledger_decisions (
  profile_id, org_id, company_id, compliance_type, ledger_id,
  selected, category, suggested, suggestion_reason, confirmed_by
)
select p.id, m.org_id, m.company_id, 'TDS', m.ledger_id,
  true, 'PAYABLE', false, 'Migrated from existing TDS mapping',
  coalesce((select om.user_id from public.tb_org_members om where om.org_id = m.org_id order by om.created_at limit 1), gen_random_uuid())
from public.tds_ledger_mappings m
join public.compliance_mapping_profiles p
  on p.company_id = m.company_id and p.compliance_type = 'TDS'
on conflict (company_id, compliance_type, ledger_id) do nothing;

create or replace function public.tb_save_tds_compliance_mapping(
  target_org uuid,
  mapping_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := (select auth.uid());
  companies jsonb := mapping_payload -> 'companies';
  company_item jsonb;
  group_item jsonb;
  ledger_item jsonb;
  target_company uuid;
  saved_profile uuid;
  saved_count integer := 0;
  now_utc timestamptz := timezone('utc', now());
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not (select public.tb_is_member(target_org)) then
    raise exception 'Organization membership required' using errcode = '42501';
  end if;
  if jsonb_typeof(companies) <> 'array' then
    raise exception 'companies must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(companies) <> (
    select count(*) from public.tb_companies c
    where c.org_id = target_org and c.is_active
  ) then
    raise exception 'Payload must include every active company' using errcode = '22023';
  end if;
  if (
    select count(distinct (item ->> 'companyId')::uuid)
    from jsonb_array_elements(companies) item
  ) <> jsonb_array_length(companies) then
    raise exception 'Company entries must be unique' using errcode = '22023';
  end if;

  for company_item in select value from jsonb_array_elements(companies)
  loop
    target_company := (company_item ->> 'companyId')::uuid;
    if not exists (
      select 1 from public.tb_companies c
      where c.id = target_company and c.org_id = target_org and c.is_active
    ) then
      raise exception 'Invalid company in mapping payload' using errcode = '22023';
    end if;
    if jsonb_typeof(company_item -> 'groups') <> 'array'
       or jsonb_typeof(company_item -> 'ledgers') <> 'array' then
      raise exception 'Each company requires groups and ledgers arrays' using errcode = '22023';
    end if;
    if jsonb_array_length(company_item -> 'ledgers') <> (
      select count(*) from public.tb_ledgers l
      where l.company_id = target_company and not l.is_deleted
    ) then
      raise exception 'Payload must include every active ledger for each company' using errcode = '22023';
    end if;
    if (
      select count(distinct (item ->> 'ledgerId')::uuid)
      from jsonb_array_elements(company_item -> 'ledgers') item
    ) <> jsonb_array_length(company_item -> 'ledgers') then
      raise exception 'Ledger entries must be unique' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(company_item -> 'ledgers') item
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

    delete from public.compliance_group_decisions
    where profile_id = saved_profile;
    for group_item in select value from jsonb_array_elements(company_item -> 'groups')
    loop
      insert into public.compliance_group_decisions (
        profile_id, org_id, company_id, compliance_type,
        group_name, selected, suggested, updated_at
      ) values (
        saved_profile, target_org, target_company, 'TDS',
        btrim(group_item ->> 'name'),
        coalesce((group_item ->> 'selected')::boolean, false),
        coalesce((group_item ->> 'suggested')::boolean, false),
        now_utc
      );
    end loop;

    delete from public.compliance_ledger_decisions
    where profile_id = saved_profile;
    for ledger_item in select value from jsonb_array_elements(company_item -> 'ledgers')
    loop
      insert into public.compliance_ledger_decisions (
        profile_id, org_id, company_id, compliance_type, ledger_id,
        selected, category, suggested, suggestion_reason, confirmed_by, updated_at
      ) values (
        saved_profile, target_org, target_company, 'TDS',
        (ledger_item ->> 'ledgerId')::uuid,
        coalesce((ledger_item ->> 'selected')::boolean, false),
        nullif(ledger_item ->> 'category', ''),
        coalesce((ledger_item ->> 'suggested')::boolean, false),
        nullif(btrim(ledger_item ->> 'suggestionReason'), ''),
        actor_id,
        now_utc
      );
    end loop;

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
    where d.profile_id = saved_profile
      and d.selected
      and d.category = 'PAYABLE'
    on conflict (company_id, ledger_id, active_from) do update set
      tds_type = excluded.tds_type,
      section_code = excluded.section_code,
      is_payable_ledger = true,
      updated_at = excluded.updated_at;

    saved_count := saved_count + 1;
  end loop;

  return jsonb_build_object(
    'companiesSaved', saved_count,
    'confirmedAt', now_utc
  );
end;
$$;

revoke all on function public.tb_save_tds_compliance_mapping(uuid, jsonb) from public, anon;
grant execute on function public.tb_save_tds_compliance_mapping(uuid, jsonb) to authenticated;

commit;
