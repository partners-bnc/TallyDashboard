---
type: "architecture"
date: "2026-08-22T10:54:44.544975+00:00"
question: "How does the completed TallyBridge Supabase-to-Neon migration connect Auth, Data API, RLS, and RPC across dashboard and Electron?"
contributor: "graphify"
outcome: "corrected"
correction: "The existing graph predates the Neon rewrite. Current source-of-truth files are database/neon/*.sql, src/lib/neon/data-api.ts, src/lib/auth/server.ts, src/lib/data.ts, and the sibling Electron auth/sync clients. Validation is complete on br-dark-mode-azfjigx7; production br-dry-heart-azz7ln2y is not restored."
---

# Neon migration architecture correction

The existing graph describes the former Supabase architecture and was useful only for locating the boundaries that changed.

The current implementation is documented in `docs/supabase-to-neon-migration-guide.md`. Neon Managed Auth issues the user JWT; the Neon Data API maps it to the PostgreSQL `authenticated` role; grants and RLS authorize reads; and Electron performs accounting writes only through the authenticated, transactional `tb_sync_accounting_data` RPC. There is no Vercel or other serverless sync proxy.

The restored schema/data and tested implementation are on validation branch `br-dark-mode-azfjigx7`. Production branch `br-dry-heart-azz7ln2y` had no TallyBridge schema at the August 22, 2026 verification point.
