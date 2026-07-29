# TallyBridge Executive Dashboard

A standalone Next.js App Router dashboard for read-only executive accounting analysis. This repository is intentionally separate from the Electron sync application at `../tallyBridge`.

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set only these public variables in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The publishable key is safe for browser use because every `tb_*` table is protected by Supabase RLS. Never add a service-role key to this project.

## Data and security model

The dashboard authenticates with Supabase SSR cookies and refreshes sessions in `src/middleware.ts`. Every server query is made through the authenticated SSR client. Organization membership and company scope are resolved before accounting data is requested. The UI does not expose insert, update, or delete operations.

Apply `supabase/migrations/20260727000000_dashboard_read_contracts.sql` after the existing TallyBridge schema migration. The security-invoker functions are for future database-side aggregation; they preserve the existing RLS boundary and exclude cancelled/deleted vouchers through the canonical ledger view semantics.

## Design foundation

- Astryx core and neutral theme `0.1.8`, initialized with `npx @astryxdesign/cli init`.
- Taste (`design-taste-frontend-v1`) and Hallmark guidance installed under `.agents/skills/`.
- Recharts is used only for chart rendering; each chart has a text legend or numeric KPI companion.
- The app is light-only, uses Geist and Geist Mono, `en-IN` INR formatting, and responsive layouts at mobile/tablet/desktop widths.

Useful Astryx commands used during setup:

```bash
npx astryx template dashboard
npx astryx search "stat card"
npx astryx docs tokens
npx astryx docs theme
```

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Known integration boundary

The current dashboard query façade uses bounded, RLS-filtered reads to make the shell usable against the existing schema. For high-volume production data, wire `src/lib/data.ts` to the provided aggregate RPCs and add a cursor-based `/api/ledger` handler for drawer pages. The migration and UI already separate those concerns so no client-side service key or unbounded history fetch is needed.
