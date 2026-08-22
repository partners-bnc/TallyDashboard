param(
  [string]$SourceConnectionString = $env:SUPABASE_SESSION_POOLER_URL,
  [string]$TargetConnectionString = $env:NEON_UNPOOLED_CONNECTION_STRING,
  [string]$NeonUserId = $env:NEON_OWNER_USER_ID,
  [string]$MemberEmail = $env:TALLYBRIDGE_OWNER_EMAIL
)

$ErrorActionPreference = 'Stop'
if (-not $SourceConnectionString -or -not $TargetConnectionString -or -not $NeonUserId -or -not $MemberEmail) {
  throw 'Set SUPABASE_SESSION_POOLER_URL, NEON_UNPOOLED_CONNECTION_STRING, NEON_OWNER_USER_ID, and TALLYBRIDGE_OWNER_EMAIL.'
}
$parsedUserId = [guid]::Empty
if (-not [guid]::TryParse($NeonUserId, [ref]$parsedUserId)) { throw 'NEON_OWNER_USER_ID must be a UUID.' }
$quotedMemberEmail = $MemberEmail.Replace("'", "''")

$tables = @(
  'tb_organizations', 'tb_org_members', 'tb_companies', 'tb_company_sync_state',
  'tb_ledger_groups', 'tb_ledgers', 'tb_ledger_balance_snapshots', 'tb_sync_runs',
  'tb_tally_trial_balance_snapshots', 'tb_tally_verification_snapshots', 'tb_vouchers',
  'tb_voucher_ledger_entries', 'tb_voucher_bill_allocations',
  'tb_voucher_cost_centre_allocations', 'tds_ledger_mappings', 'compliance_mapping_profiles'
)
$accountingWriteTables = $tables | Where-Object { $_ -notin @('tds_ledger_mappings', 'compliance_mapping_profiles') }

function Query([string]$ConnectionString, [string]$Sql) {
  $result = & psql $ConnectionString -X -q -A -t -v ON_ERROR_STOP=1 -c $Sql
  if ($LASTEXITCODE -ne 0) { throw 'Verification query failed.' }
  return ($result -join "`n").Trim()
}

$failures = @()
foreach ($table in $tables) {
  $countSql = "select count(*) from public.$table"
  $sourceCount = Query $SourceConnectionString $countSql
  $targetCount = Query $TargetConnectionString $countSql

  $hashSql = if ($table -eq 'tb_org_members') { @"
select md5(coalesce(string_agg(row_hash, '' order by row_hash), ''))
from (
  select md5((to_jsonb(t) - 'user_id')::text) as row_hash from public.$table t
) rows
"@ } else { @"
select md5(coalesce(string_agg(row_hash, '' order by row_hash), ''))
from (
  select md5(to_jsonb(t)::text) as row_hash from public.$table t
) rows
"@ }
  $sourceHash = Query $SourceConnectionString $hashSql
  $targetHash = Query $TargetConnectionString $hashSql
  $ok = $sourceCount -eq $targetCount -and $sourceHash -eq $targetHash
  if (-not $ok) { $failures += $table }
  [pscustomobject]@{
    Table = $table
    SourceRows = $sourceCount
    TargetRows = $targetCount
    ContentHashMatch = $sourceHash -eq $targetHash
  }
}

if ($failures.Count) {
  throw "Database verification failed for: $($failures -join ', ')"
}

$tableList = ($tables | ForEach-Object { "'$_'" }) -join ','
$accountingWriteTableList = ($accountingWriteTables | ForEach-Object { "'$_'" }) -join ','
$constraintSql = @"
select md5(coalesce(string_agg(definition, '' order by definition), ''))
from (
  select c.relname || '|' || x.contype::text || '|' || pg_get_constraintdef(x.oid, true) definition
  from pg_constraint x
  join pg_class c on c.oid=x.conrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ($tableList)
    and x.contype <> 'n'
    and not (c.relname='tb_org_members' and x.contype='f')
) definitions
"@
$sourceConstraintHash = Query $SourceConnectionString $constraintSql
$targetConstraintHash = Query $TargetConnectionString $constraintSql
if ($sourceConstraintHash -ne $targetConstraintHash) {
  throw 'PK, unique, check, or internal FK definitions differ between source and target.'
}

$indexSql = @"
select md5(coalesce(string_agg(definition, '' order by definition), ''))
from (
  select tablename || '|' || regexp_replace(indexdef, ' ON [^ ]+\.', ' ON public.') definition
  from pg_indexes
  where schemaname='public' and tablename in ($tableList)
) definitions
"@
if ((Query $SourceConnectionString $indexSql) -ne (Query $TargetConnectionString $indexSql)) {
  throw 'Index definitions differ between source and target.'
}

$targetContractSql = @"
select jsonb_build_object(
  'auth_fk', exists (
    select 1 from pg_constraint x
    join pg_class c on c.oid=x.conrelid
    where c.relname='tb_org_members' and x.contype='f'
      and pg_get_constraintdef(x.oid) like '%REFERENCES neon_auth.%user%(id)%'
  ),
  'rls_tables', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ($tableList) and c.relrowsecurity),
  'member_policies', (select count(*) from pg_policies where schemaname='public' and tablename in ($tableList) and not ('tally_ingest'=any(roles))),
  'ingest_policies', (select count(*) from pg_policies where schemaname='public' and tablename in ($tableList) and 'tally_ingest'=any(roles)),
  'public_policies', (select count(*) from pg_policies where schemaname='public' and tablename in ($tableList) and 'public'=any(roles)),
  'ingest_role', exists (select 1 from pg_roles where rolname='tally_ingest'),
  'rpc', to_regprocedure('public.tb_sync_accounting_data(jsonb)') is not null,
  'rpc_authenticated', has_function_privilege('authenticated','public.tb_sync_accounting_data(jsonb)','EXECUTE'),
  'rpc_anonymous', has_function_privilege('anonymous','public.tb_sync_accounting_data(jsonb)','EXECUTE'),
  'rpc_public', has_function_privilege('public','public.tb_sync_accounting_data(jsonb)','EXECUTE'),
  'private_schema_authenticated', has_schema_privilege('authenticated','tallybridge_private','USAGE'),
  'direct_accounting_writes', exists (
    select 1 from unnest(array[$accountingWriteTableList]) table_name
    where has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT,UPDATE,DELETE')
  ),
  'view', to_regclass('public.tb_ledger_voucher_lines') is not null,
  'functions', (select count(distinct proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in (
    'tb_is_member','tb_voucher_affects_books','tb_dashboard_movement_totals','tb_dashboard_monthly_movement',
    'tb_dashboard_voucher_type_counts','tb_history_coverage','tb_ledger_monthly_summary','tb_trial_balance',
    'tb_trial_balance_verification','tb_tds_source_lines','tb_save_tds_compliance_mapping','tb_sync_accounting_data'
  ))
)::text
"@
$targetContract = Query $TargetConnectionString $targetContractSql | ConvertFrom-Json
if (-not $targetContract.auth_fk) { throw 'The translated neon_auth.user membership FK is missing.' }
if ([int]$targetContract.member_policies -ne 22) { throw "Expected all 22 live member policies; found $($targetContract.member_policies)." }
if ([int]$targetContract.ingest_policies -ne 0) { throw "Expected zero ingestion-role policies; found $($targetContract.ingest_policies)." }
if ([int]$targetContract.public_policies -ne 0) { throw 'One or more migrated policies still target PUBLIC.' }
if ($targetContract.ingest_role) { throw 'The obsolete tally_ingest login role still exists.' }
if (-not $targetContract.rpc -or -not $targetContract.rpc_authenticated) { throw 'The authenticated accounting RPC is missing or not executable.' }
if ($targetContract.rpc_anonymous -or $targetContract.rpc_public) { throw 'The accounting RPC is executable by anonymous or PUBLIC.' }
if ($targetContract.private_schema_authenticated) { throw 'Authenticated clients can access the private ingestion schema.' }
if ($targetContract.direct_accounting_writes) { throw 'Authenticated clients have direct accounting-table write privileges.' }
if (-not $targetContract.view) { throw 'tb_ledger_voucher_lines is missing.' }
if ([int]$targetContract.functions -ne 12) { throw "Expected all 12 live public function names; found $($targetContract.functions)." }

$membershipSql = @"
select count(*)
from public.tb_org_members member
join public.tb_organizations organization on organization.id=member.org_id
join neon_auth."user" auth_user on auth_user.id=member.user_id
where member.user_id='$parsedUserId'::uuid
  and lower(auth_user.email)=lower('$quotedMemberEmail')
  and organization.name='TallyBridge Demo Org'
  and member.role='owner'
"@
if ([int](Query $TargetConnectionString $membershipSql) -ne 1) {
  throw 'Expected exactly one matching owner membership for TallyBridge Demo Org.'
}

Write-Output 'Rows, hashes, constraints, indexes, owner membership, Auth FK, RLS, RPC grants, view, and functions match.'
