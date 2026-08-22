# Supabase-to-Neon migration

The custom archive is intentionally excluded from Git. Run the scripts from the
dashboard repository root with PostgreSQL 18 client tools on `PATH`.

1. Freeze Supabase writes and set `SUPABASE_SESSION_POOLER_URL`.
2. Run `./scripts/neon-migration/export.ps1`.
3. Obtain an unpooled connection for the target Neon branch and set
   `NEON_UNPOOLED_CONNECTION_STRING`.
4. Run `./scripts/neon-migration/restore.ps1 -Archive <dump path>`.
5. Create the requested user through Neon Managed Auth and confirm password
   sign-in. Do not persist or log the password; record only the returned UUID.
6. Run `040_remap_member.sql` with `old_user_id`, the explicit `neon_user_id`,
   and matching `member_email`; the script validates the owner membership and
   the translated Auth foreign key in the same transaction.
7. Run `050_refresh_data_api.sql`, `./scripts/neon-migration/verify.ps1`, and
   the RPC/RLS test suite before switching application configuration.

`source-schema-evidence.sql` preserves the 22 live source RLS policy definitions
(the planning document's 23-policy estimate was one high),
including the two former `PUBLIC` policies and the broken TDS self-comparisons.
The active Neon policy translation is in `020_security_and_roles.sql`. It has
no ingestion login role or ingestion policies. Atomic writes are implemented by
the authenticated-only public wrapper and private implementation in
`021_sync_accounting_rpc.sql`.

The source exposes 11 distinct live function names (the planning document
grouped these as 10); those plus the accounting sync RPC are checked by
`verify.ps1`.
