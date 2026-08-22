# Neon cutover runbook

## Preconditions

- Neon Managed Auth and Data API are enabled on the Singapore production branch.
- The requested replacement user exists in Managed Auth and password sign-in has returned its UUID.
- Dashboard and Electron artifacts have passed typecheck, tests, lint, and production builds.
- Electron has only the client-safe Neon Auth and Data API URLs; no raw database credential or dashboard sync URL is present.
- Electron sync is paused before the database write freeze starts.

## Cutover

1. Deploy the Neon-ready dashboard and Electron build with synchronization disabled.
2. Stop the Supabase Edge Function write path and confirm no Electron client is syncing.
3. Run `scripts/neon-migration/export.ps1`; retain its custom archive, TOC, and SHA-256 outside Git.
4. Restore with `scripts/neon-migration/restore.ps1` against an unpooled Neon connection.
5. Confirm password sign-in for the requested Managed Auth account and record the returned UUID without storing or logging the password.
6. Run `040_remap_member.sql` using the old membership UUID, explicit Neon UUID, and matching email.
7. Refresh the Data API with `050_refresh_data_api.sql`.
8. Run `scripts/neon-migration/verify.ps1`, then test anonymous denial, non-members, multiple memberships, cross-company records, invalid allocations, duplicate batches, soft deletion, forced rollback, concurrency, dashboard RPCs, Electron reports, and login/logout/session restoration.
9. Enable one Electron client, run one controlled company sync, and compare Trial Balance, dashboard totals, ledger movement, verification, and TDS output.
10. Re-enable normal synchronization only after the controlled comparison passes.

## Seven-day rollback window

Keep Supabase available but read-only for seven full days. Record the cutover timestamp and the archive checksum. Do not delete Supabase data, functions, or the project during this window.

If rollback is required:

1. Pause Electron synchronization and freeze Neon writes.
2. Export the current 16-table Neon closure with the same selective archive process.
3. Restore it into a disposable Supabase validation target first, translating only the membership Auth FK and RLS identity function back to Supabase.
4. Compare all table counts/hashes, constraints, indexes, report functions, and financial outputs.
5. Restore the verified archive to the production Supabase target, revert dashboard/Electron configuration, then enable one controlled sync.
6. Keep Neon unchanged until rollback verification is complete.

Deleting either hosted data set requires separate explicit approval after the rollback window.

## Current connector limitation

The production Data API is enabled at
`https://ep-shiny-poetry-az38gwc1.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb/rest/v1`.
Managed Auth is configured at
`https://ep-shiny-poetry-az38gwc1.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth`.
The configured Neon connector can inspect and query the project, but its
advertised branch-management action still returns `tool not found`; use the
Console if an isolated validation branch is required before the write freeze.
