param(
  [Parameter(Mandatory = $true)] [string]$Archive,
  [string]$TargetConnectionString = $env:NEON_UNPOOLED_CONNECTION_STRING
)

$ErrorActionPreference = 'Stop'
if (-not $TargetConnectionString) {
  throw 'Set NEON_UNPOOLED_CONNECTION_STRING to the target branch connection string.'
}

$resolvedArchive = (Resolve-Path -LiteralPath $Archive).Path
$workingDirectory = Split-Path -Parent $resolvedArchive
$curatedToc = Join-Path $workingDirectory 'tally-closure.curated.toc.txt'

$toc = & pg_restore --list $resolvedArchive
if ($LASTEXITCODE -ne 0) { throw 'Could not read the archive TOC.' }
$curated = $toc | ForEach-Object {
  if ($_ -match ' ROW SECURITY public ' -or
      $_ -match ' POLICY public ' -or
      $_ -match ' FK CONSTRAINT public tb_org_members tb_org_members_user_id_fkey ') {
    "; excluded for Neon translation: $_"
  } else {
    $_
  }
}
$curated | Set-Content -Encoding utf8 $curatedToc

& pg_restore --exit-on-error --single-transaction --no-owner --no-privileges `
  --section=pre-data --dbname=$TargetConnectionString $resolvedArchive
if ($LASTEXITCODE -ne 0) { throw 'Base table restore failed.' }

& pg_restore --exit-on-error --single-transaction --no-owner --no-privileges `
  --section=data --dbname=$TargetConnectionString $resolvedArchive
if ($LASTEXITCODE -ne 0) { throw 'Table data restore failed.' }

& pg_restore --exit-on-error --single-transaction --no-owner --no-privileges `
  --section=post-data --use-list=$curatedToc --dbname=$TargetConnectionString $resolvedArchive
if ($LASTEXITCODE -ne 0) { throw 'Constraints/indexes/internal foreign keys restore failed.' }

$sqlFiles = @(
  'database/neon/010_functions.sql',
  'database/neon/011_view.sql',
  'database/neon/012_functions.sql',
  'database/neon/013_generic_compliance_mapping.sql',
  'database/neon/020_security_and_roles.sql',
  'database/neon/021_sync_accounting_rpc.sql',
  'database/neon/050_refresh_data_api.sql'
)
foreach ($sqlFile in $sqlFiles) {
  & psql $TargetConnectionString -X -v ON_ERROR_STOP=1 --single-transaction --file=$sqlFile
  if ($LASTEXITCODE -ne 0) { throw "Failed while applying $sqlFile" }
}

Write-Output 'Selective restore and Neon policy translation completed.'
