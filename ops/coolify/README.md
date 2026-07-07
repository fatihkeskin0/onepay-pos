# Coolify Deployment

Deploy OnePOS as a **Docker Compose** resource on Coolify.

## Stack

| Service | Image / Dockerfile | Port | Public domain |
|---------|-------------------|------|---------------|
| `web` | `ops/docker/Dockerfile.web` | 3105 | Yes — panel + `/pay/*` + `/docs` |
| `api` | `ops/docker/Dockerfile.api` | 4105 | Yes — PSP webhooks (`/psp/*`) |
| `postgres` | `postgres:16-alpine` | 5432 | No — internal only |
| `redis` | `redis:7-alpine` | 6379 | No — internal only |

**Required backing services:** PostgreSQL (all data — financial + logs) and Redis (rate limiting + cache).

## Quick setup

1. Create a new **Docker Compose** project in Coolify.
2. Point to this repo; compose file: `docker-compose.yaml` (default) or `ops/docker/compose.prod.yaml`.
3. Copy `.env.production.example` → Coolify **Environment Variables**.
4. Map domains in Coolify (Coolify sets `SERVICE_URL_*` automatically):
   - **web** service → port `3105` (panel domain → `SERVICE_URL_WEB`)
   - **api** service → port `4105` (webhook domain → `SERVICE_URL_API`)
5. **Split panel / payment domains** (any two root domains — subdomains optional):
   - Point domain A at **web** → panel (`APP_BASE_URL`, e.g. `https://panel.sirket.com`)
   - Point domain B at the same **web** service → payment (`APP_PAYMENT_URL`, e.g. `https://odeme.click`)
   - Middleware keeps `/panel/*` on panel domain and `/pay/*` on payment domain (cross-domain redirects).
   - Customer payment links always use `APP_PAYMENT_URL` (API-generated).
   - CORS auto-includes both origins.
6. Set required env:
   - `APP_SECRET`, `POSTGRES_PASSWORD`
   - `REDIS_URL` — default `redis://redis:6379` (compose internal)
   - PSP creds for your active provider
   - `APP_PAYMENT_URL` when payment domain differs from panel
7. Deploy. API entrypoint runs `prisma migrate deploy` automatically.

## Environment variables

### Required

| Variable | Description |
|----------|-------------|
| `APP_SECRET` | JWT/session signing secret |
| `SERVICE_URL_WEB` | Auto — Coolify web domain (panel; `APP_BASE_URL` fallback) |
| `SERVICE_URL_API` | Auto — Coolify api domain (`API_PUBLIC_URL` fallback) |
| `APP_BASE_URL` | Panel URL override (admin `/panel/*`) |
| `APP_PAYMENT_URL` | Payment URL override (customer `/pay/*` links) |
| `SERVICE_URL_PAYMENT` | Optional Coolify-style alias for payment domain |
| `API_PUBLIC_URL` | Optional override for PSP webhooks |
| `CORS_ORIGIN` | Optional comma-separated origins; defaults to panel + payment URLs |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/onepara_card` |
| `REDIS_URL` | Redis connection string |

### PSP (fill only active provider)

Set `PSP_DEFAULT_PROVIDER` to `paytr`, `stripe`, or `sumup`. Only that provider's credentials are required:

| Provider | Variables |
|----------|-----------|
| PayTR | `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT`, `PAYTR_TEST_MODE` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` — webhook events: `payment_intent.succeeded`, `payment_intent.payment_failed` |
| SumUp | `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE` |

### Optional

| Variable | Description |
|----------|-------------|
| `BC_SECRET`, `BC_API_URL`, `BC_PARTNER_ID` | BetConstruct integration |
| `TELEGRAM_BOT_TOKEN` | Telegram notifications |

## First admin user

After first deploy, exec into the **api** container and seed once (production guard requires `SEED_ALLOW=1`):

```sh
SEED_ALLOW=1 SEED_ADMIN_PASSWORD="your-strong-password" pnpm db:seed:prod
```

Or run locally against production DB with `DATABASE_URL` and `APP_ENV=production` set.

Seeding is blocked in production without `SEED_ALLOW=1`. Admin password comes from `SEED_ADMIN_PASSWORD` (not logged). Activate your PSP in **Admin → POS Ayarları** after seed.

## External PostgreSQL / Redis

To use Coolify-managed services instead of bundled compose services:

1. Remove `postgres` and/or `redis` from compose (or disable them).
2. Set `DATABASE_URL` and/or `REDIS_URL` to external connection strings.
3. Remove corresponding `depends_on` entries from the `api` service.

## Architecture notes

- Web proxies `/backend/*` → internal `http://api:4105/*` (set at build via `NEXT_PUBLIC_API_URL`).
- Merchants integrate via `/backend/user/*` on the **web** domain.
- PSP callbacks hit **api** domain: `POST /psp/{provider}/callback`.
- Health checks: `GET /api/health` (web), `GET /health` (api — includes Redis status).
- Rate limiting uses Redis (not DB). Audit/login/chat logs stay in PostgreSQL.

## Local dev (unchanged)

```powershell
Copy-Item .env.example .env
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Use `pnpm dev:clean` if Next.js cache issues occur on Windows.

For Docker-based local stack with Postgres + Redis:

```powershell
docker compose -f ops/docker/compose.dev.yaml up -d postgres redis
```
