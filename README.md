# TallyBridge Executive Dashboard

A standalone Next.js App Router dashboard for read-only executive accounting analysis. This repository is intentionally separate from the Electron sync application at `../tallyBridge`.

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Configure the values documented in `.env.example`. The browser-visible value is:

- `NEXT_PUBLIC_NEON_DATA_API_URL`

`NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET` are server-side Auth configuration. The dashboard has no runtime database credential or Electron ingestion endpoint.

## Data and security model

The dashboard authenticates with Neon Managed Auth through `src/proxy.ts`. Every Data API query carries the user JWT, and PostgreSQL RLS remains the read-authorization boundary. Organization membership and company scope are resolved before accounting data is requested.

Electron sync invokes `tb_sync_accounting_data(payload)` through its authenticated Neon client. The public RPC derives tenancy from `auth.uid()` and delegates to private, security-definer ingestion logic, so each company batch is atomic without granting direct accounting-table writes. See `database/neon/README.md` for database restore and cutover instructions.

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

## Migration status

The application code is Neon-ready, and the production Managed Auth and Data API endpoints are configured. Production cutover still requires restoring the final write-frozen archive, creating the replacement Managed Auth user, confirming password sign-in, remapping the explicit returned user UUID and matching email, and running the supplied database verification scripts.
