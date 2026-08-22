---
type: "architecture"
date: "2026-08-21T12:23:23.735333+00:00"
question: "Which architecture components must change for the Supabase-to-Neon migration?"
contributor: "graphify"
outcome: "useful"
---

# Q: Which architecture components must change for the Supabase-to-Neon migration?

## Answer

The migration spans dashboard authentication and server-side data access, proxy protection, the accounting ingestion boundary, tenant/RLS policies, report RPCs, and the Electron authentication, report, and sync clients. Preserve company-GUID tenancy, transactionality, Keytar persistence, and the database RLS authorization boundary.

## Outcome

- Signal: useful