# Coolify Deployment

Deploy OnePOS as a **Docker Compose** resource on Coolify.

## Stack

| Service | Image / Dockerfile | Port | Public domain |
|---------|-------------------|------|---------------|
| `web` | `ops/docker/Dockerfile.web` | 3105 | Yes — panel + `/pay/*` + `/docs` |
| `api` | `ops/docker/Dockerfile.api` | 4105 | Yes — PSP webhooks (`/psp/*`) |

**Required backing services:** PostgreSQL and Redis — use **Coolify managed resources** (e.g. `postgres:18-alpine`). Bundled stack for local only: `ops/docker/compose.bundled.yaml`.

## Quick setup

1. Create a **Docker Compose** project pointing to this repo.
2. **Docker Compose Location:** `/docker-compose.yaml` (api + web only — not `/ops/docker/compose.prod.yaml`).
3. Create **PostgreSQL** and **Redis** as separate Coolify resources; copy their internal URLs into `DATABASE_URL` and `REDIS_URL`.
4. `DATABASE_URL` / `REDIS_URL` must use **Coolify internal hostnames** (from each resource’s connection string — not `@postgres:5432`).
5. The compose file attaches `api` to the external `coolify` Docker network so it can reach managed Postgres/Redis.
6. Map domains in Coolify **Domains** tab — **each hostname must be listed separately** on the **web** service (port **3105**):
   - `https://onekart.info` — marketing landing + `/docs`
   - `https://app.onekart.info` — panel (`/login`, `/dashboard`, …)
   - `https://odeme.click` — customer `/pay/*` only
   - **api** service (port **4105**): `https://api.onekart.info`
   - Missing `app.*` in Domains → Traefik shows **“no available server”** even when `onekart.info` works.
7. Set **required URL env** (do not add `SERVICE_URL_*` — not in compose):
   - `APP_MARKETING_URL`, `APP_BASE_URL`, `APP_PAYMENT_URL`, `API_PUBLIC_URL`
   - Web build uses `API_PUBLIC_URL` as `NEXT_PUBLIC_API_URL` (browser calls `https://api.onekart.info` directly)
   - Payment domain (e.g. `https://odeme.click`) via DNS → same web service + `APP_PAYMENT_URL`
8. Set secrets: `APP_SECRET`, `DATABASE_URL`, `REDIS_URL`, Stripe keys (PayTR optional)
9. Deploy. API entrypoint runs `prisma migrate deploy` automatically (healthcheck allows ~3 min startup).

## Environment variables

### Required

| Variable | Description |
|----------|-------------|
| `APP_SECRET` | JWT/session signing secret |
| `APP_MARKETING_URL` | Landing + docs (e.g. `https://onekart.info`) — **required** when split from panel |
| `APP_BASE_URL` | Panel app subdomain (e.g. `https://app.onekart.info`, paths like `/dashboard`) — **required** |
| `APP_PAYMENT_URL` | Payment URL (customer `/pay/*` links) — **required** |
| `API_PUBLIC_URL` | PSP webhook base URL — **required** |
| `CORS_ORIGIN` | Optional comma-separated origins; defaults to marketing + panel + payment URLs |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/onepara_card` — use Coolify Postgres internal hostname |
| `REDIS_URL` | Redis connection string — use Coolify Redis internal URL |

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
| `BC_SECRET` | HMAC secret for BetConstruct seamless wallet callbacks (`/api/*`) — set only if used |
| `TELEGRAM_BOT_TOKEN` | Telegram notifications |

## First admin user

After first deploy, exec into the **api** container and seed once (production guard requires `SEED_ALLOW=1`):

```sh
SEED_ALLOW=1 SEED_ADMIN_PASSWORD="your-strong-password" pnpm db:seed:prod
```

Or run locally against production DB with `DATABASE_URL` and `APP_ENV=production` set.

Seeding is blocked in production without `SEED_ALLOW=1`. Admin password comes from `SEED_ADMIN_PASSWORD` (not logged). Activate your PSP in **Admin → POS Ayarları** after seed.

## Local bundled stack (postgres + redis)

```powershell
docker compose -f ops/docker/compose.bundled.yaml up --build
```

## Architecture notes

- Web proxies `/backend/*` → internal `http://api:4105/*` (fallback when build lacks public API URL).
- Panel/pay browser requests use `NEXT_PUBLIC_API_URL` (`API_PUBLIC_URL` at build), e.g. `https://api.onekart.info`.
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
