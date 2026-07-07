# OnePOS Credit Card Panel

Next.js + Node.js (Fastify) credit card deposit platform.

## Stack

- `apps/web` — Next.js 15 panel + payment pages + static API docs (`/docs`)
- `apps/api` — Fastify REST API
- `packages/db` — Prisma + PostgreSQL
- `packages/shared` — shared types and nav config

## Quick Start (local)

```powershell
cd x:\dev\PAYMENTS\onepay-credit-card
Copy-Item .env.example .env
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Use `pnpm dev:clean` if the web app shows stale chunk / Internal Server Error (clears `.next` on start).

- Web: http://localhost:3105
- API: http://localhost:4105
- API Docs: http://localhost:3105/docs
- PostgreSQL (local): localhost:5432
- Redis (local): localhost:6379
- Login: `admin` / `admin123` or `agent` / `agent123`
- Site API key (seed): `dev_site_api_key_00000000000000000000000000000001`

## Panel Routes (admin)

Panel runs on `APP_BASE_URL` (production: `https://app.onekart.info`) without a `/panel` prefix.

| Route | Purpose |
|-------|---------|
| `/pos` | POS provider settings (active/default, min/max) |
| `/sites` | Site management + `dep_commission_rate` |
| `/site-reconciliation` | Per-site gross/commission/net report |
| `/settings` | Account settings |

Landing and API docs: `APP_MARKETING_URL` (e.g. `https://onekart.info`, `/docs`).

## Payment Flow

1. Site calls `POST /user/create_payment_link` with `X-API-Key`
2. User opens `/pay/{token}`
3. Pay page loads `GET /user/pos_methods?token=...`
4. User confirms amount → `POST /user/create_deposit`
5. Embedded checkout (PayTR iframe / Stripe Payment Element) or redirect (SumUp) → PSP webhook → auto approve + commission snapshot
6. Site receives outbound callback (CheckSum signed)
7. Pay page polls `GET /user/deposit_status`

See full integrator reference: http://localhost:3105/docs

## BetConstruct Callback Compatibility

Site callback payload format is **unchanged** from the PHP OnePay system:

```
TraderKey + TransactionID + UserCode + Amount(2 dec) + StatusCode + UnixTime
→ HMAC-SHA256(api_key) → CheckSum (lowercase hex)
```

StatusCode: `1` = approved, `2` = rejected, `3` = cancelled.

BC Wallet API (`/bc/balance`, `/bc/credit`, `/bc/debit`) uses `X-Signature` HMAC with `BC_SECRET`.

## PSP Providers

| Provider | Role | Env vars |
|----------|------|----------|
| paytr | Production | `PAYTR_MERCHANT_*` |
| stripe | Production (Payment Element) | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` |
| sumup | Production | `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE` |

Configure active providers, min/max amounts, and default method in **Admin → POS Ayarları** (`/pos`). Credentials live in `.env`.

## Commission Model

- Each site has `dep_commission_rate` (%), set in `/sites`
- On deposit approval, `commissionRate` and `commissionAmount` are snapshotted on the deposit record
- Site reconciliation report: `/site-reconciliation`

## Docker (local dev)

```powershell
cd ops/docker
docker compose -f compose.dev.yaml up --build
```

Then run migrations/seed inside api container or locally against `postgresql://onepara:onepara@localhost:5432/onepara_card`.

Production first-time seed (inside api container or with prod `DATABASE_URL`):

```powershell
SEED_ALLOW=1 SEED_ADMIN_PASSWORD="your-strong-password" pnpm db:seed:prod
```

Local dev seed: `pnpm db:seed` (uses `.env` via dotenv).

## Production (Coolify)

See [ops/coolify/README.md](ops/coolify/README.md).

- Compose file: `docker-compose.yaml` (Coolify); bundled local: `ops/docker/compose.bundled.yaml`
- Env template: `.env.production.example`
- Deploy: Coolify → Docker Compose → map web (3105) + api (4105) domains

## Scope Notes

This panel is **credit-card deposit only** (no havale IBAN, no withdrawals). Legacy PHP system remains separate for havale operations.
