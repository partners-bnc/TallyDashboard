begin;

insert into public.tds_ledger_mappings (
  org_id, company_id, ledger_id, tds_type, section_code,
  is_payable_ledger, updated_at
)
select
  l.org_id,
  l.company_id,
  l.id,
  case
    when lower(l.name) like '%salary%' then 'Salary'
    when lower(l.name) like '%contract%' then 'Contractor'
    when lower(l.name) like '%rent%' then 'Rent'
    when lower(l.name) like '%professional%' then 'Professional Fees'
  end,
  case
    when lower(l.name) like '%salary%' then '192'
    when lower(l.name) like '%contract%' then '194C'
    when lower(l.name) like '%rent%' then '194I'
    when lower(l.name) like '%professional%' then '194J'
  end,
  true,
  timezone('utc', now())
from public.tb_ledgers l
join public.tb_companies c on c.id = l.company_id and c.org_id = l.org_id
join public.compliance_mapping_profiles p
  on p.company_id = l.company_id
 and p.org_id = l.org_id
 and p.compliance_type = 'TDS'
 and p.status = 'complete'
where c.name ilike '%Jammu%'
  and not l.is_deleted
  and btrim(regexp_replace(lower(l.parent_name), '[^a-z0-9]+', ' ', 'g')) = 'tds'
  and btrim(regexp_replace(lower(l.name), '[^a-z0-9]+', ' ', 'g'))
    ~ '^tds on (contractor|professional fees|rent|salary)( |$)'
on conflict (company_id, ledger_id, active_from) do update set
  tds_type = excluded.tds_type,
  section_code = excluded.section_code,
  is_payable_ledger = true,
  active_to = null,
  updated_at = excluded.updated_at;

commit;
