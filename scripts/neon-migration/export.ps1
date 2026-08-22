param(
  [string]$OutputDirectory = '.migration-artifacts/final-cutover'
)

$ErrorActionPreference = 'Stop'
$connectionString = $env:SUPABASE_SESSION_POOLER_URL
if (-not $connectionString) { $connectionString = $env:SUPABASE_CONNECTION_STRING }
if (-not $connectionString) {
  throw 'Set SUPABASE_SESSION_POOLER_URL before running the selective export.'
}

$tables = @(
  'tb_organizations', 'tb_org_members', 'tb_companies', 'tb_company_sync_state',
  'tb_ledger_groups', 'tb_ledgers', 'tb_ledger_balance_snapshots', 'tb_sync_runs',
  'tb_tally_trial_balance_snapshots', 'tb_tally_verification_snapshots', 'tb_vouchers',
  'tb_voucher_ledger_entries', 'tb_voucher_bill_allocations',
  'tb_voucher_cost_centre_allocations', 'tds_ledger_mappings', 'compliance_mapping_profiles'
)

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
$archive = Join-Path $resolvedOutput 'tally-closure.dump'
$tableArguments = foreach ($table in $tables) { '--table'; "public.$table" }

& pg_dump --format=custom --no-owner --no-privileges --dbname=$connectionString `
  @tableArguments --file=$archive
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }

& pg_restore --list $archive |
  Set-Content -Encoding utf8 (Join-Path $resolvedOutput 'tally-closure.toc.txt')
$checksum = (Get-FileHash -Algorithm SHA256 $archive).Hash.ToLowerInvariant()
"$checksum  tally-closure.dump" |
  Set-Content -Encoding ascii (Join-Path $resolvedOutput 'tally-closure.sha256')

Write-Output "Archive: $archive"
Write-Output "SHA256: $checksum"
