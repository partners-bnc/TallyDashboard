# Direct Electron-to-Neon Data API migration

The dashboard and Electron application use Neon Managed Auth and the Neon Data
API. Accounting ingestion no longer traverses a dashboard/Vercel route and no
runtime database login is distributed or deployed.

Electron passes each company-scoped batch to
`public.tb_sync_accounting_data(payload jsonb)` with `neon.rpc(...)`. The
unified Neon client attaches its current Managed Auth JWT. PostgreSQL requires
`auth.uid()`, resolves exactly one `tb_org_members` row, derives `org_id` and
the company UUID, rejects cross-company children and invalid allocations, and
serializes concurrent company batches with an advisory transaction lock.

The public RPC is an authenticated-only security-definer wrapper. Its ingestion
implementation is in the inaccessible `tallybridge_private` schema. Electron
users retain RLS-governed reads but receive no direct accounting-table write
grants. One RPC call is one PostgreSQL transaction, so validation or write
failure rolls back the company, children, allocations, reconciliation,
verification, sync state, and sync runs together.

Cutover uses a write-frozen selective Supabase archive. After restore, create
the requested account through Managed Auth, confirm password sign-in, and pass
the returned UUID plus matching email to `040_remap_member.sql`. The script
replaces the source owner UUID only for `TallyBridge Demo Org`, verifies exactly
one `owner` membership, and then validates the `neon_auth.user` foreign key.

Refresh the Data API schema cache and run `scripts/neon-migration/verify.ps1`.
Verification covers row counts and hashes, constraints, indexes, the view and
functions, the Auth membership, zero ingestion-role policies, absence of the
old login role, authenticated-only RPC execution, private-schema denial, and
the lack of direct accounting writes.

At cutover, enable one Electron client and compare trial balance, dashboard
totals, ledger movement, verification, and TDS output after a controlled sync.
Keep Supabase read-only for seven full days as the rollback source; its migration
and Edge Function artifacts remain intact until that window expires.
