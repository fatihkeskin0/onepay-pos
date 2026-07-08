# Coolify Deployment

Deploy OnePOS as a **Docker Compose** resource on Coolify.

## Stack

| Service | Image / Dockerfile | Container port | Public domain |
|---------|-------------------|----------------|---------------|
| `web` | `ops/docker/Dockerfile.web` | 80 | Yes — panel + `/pay/*` + `/docs` |
| `api` | `ops/docker/Dockerfile.api` | 80 | Yes — PSP webhooks (`/psp/*`) |

**Required backing services:** PostgreSQL and Redis — use **Coolify managed resources** (e.g. `postgres:18-alpine`). Bundled stack for local only: `ops/docker/compose.bundled.yaml`.

## Quick setup

1. Create a **Docker Compose** project pointing to this repo.
2. **Docker Compose Location:** `/docker-compose.yaml` (api + web only — not `/ops/docker/compose.prod.yaml`).
3. Create **PostgreSQL** and **Redis** as separate Coolify resources; copy their internal URLs into `DATABASE_URL` and `REDIS_URL`.
4. `DATABASE_URL` / `REDIS_URL` must use **Coolify internal hostnames** (from each resource’s connection string — not `@postgres:5432`).
5. The compose file attaches `api` to the external `coolify` Docker network so it can reach managed Postgres/Redis.
6. Map domains in Coolify **Domains** tab — **comma-separated, one field** per service. Containers listen on **port 80** (Coolify/Traefik default — do **not** append `:3105` or `:4105` to domains):
   - **web:** `https://onekart.info,https://app.onekart.info,https://odeme.click`
   - Marketing: `onekart.info` · Panel: `app.onekart.info` · Payment: `odeme.click`
   - **api:** `https://api.onekart.info`
   - All three web hostnames must be present; missing `app.*` → **“no available server”** or 504 on that host.
7. Set **required URL env** (do not add `SERVICE_URL_*` — not in compose):
   - `APP_MARKETING_URL`, `APP_BASE_URL`, `APP_PAYMENT_URL`, `API_PUBLIC_URL`
   - Browser panel/pay calls use same-origin `/backend/*` proxy (no `NEXT_PUBLIC_API_URL` needed). Leave `NEXT_PUBLIC_API_URL` unset unless you explicitly want cross-origin API calls.
   - Payment domain (e.g. `https://odeme.click`) via DNS → same web service + `APP_PAYMENT_URL`
8. Set secrets: `APP_SECRET`, `DATABASE_URL`, `REDIS_URL`, Stripe keys (PayTR optional)
9. Deploy. API entrypoint runs `prisma migrate deploy` automatically (healthcheck allows ~3 min startup).

## Cloudflare (API integration)

Production traffic stays **behind Cloudflare proxy** (orange cloud). Set env on the **api** service:

| Variable | Example |
|----------|---------|
| `CLOUDFLARE_API_TOKEN` | Custom token (secret) |
| `CLOUDFLARE_ACCOUNT_ID` | `14cc9d8a8239fc9bc69265d82d9d8aa2` |
| `CLOUDFLARE_ORIGIN_IP` | Coolify server public IP |
| `CLOUDFLARE_ZONE_ID_ONEKART` | `583a4c1b8eca2293926b4926b462a215` |
| `CLOUDFLARE_ZONE_ID_ODEME` | `7aba743cb513d4e7c9a8d6fc4e7863e7` |
| `CLOUDFLARE_AUTO_SYNC` | `1` — sync DNS + SSL on API startup |

Also set `APP_MARKETING_URL` on the **api** service (DNS host derivation).

**Admin → Güvenlik → IP Yönetimi**: BetConstruct/partner IP whitelist, Cloudflare allow rules, fail2ban ignore export.

Token also needs **Zone → Firewall Services → Edit** for trusted IP sync.

Sync creates **A records** with **proxied=true** for hosts from `APP_MARKETING_URL`, `APP_BASE_URL`, `API_PUBLIC_URL`, `APP_PAYMENT_URL`. SSL: **Full (strict)** + **Always HTTPS**.

## Trusted IPs & fail2ban

**Admin → Güvenlik → IP Yönetimi** (`/security`):

- Add multiple IPs/CIDRs (BetConstruct, merchant backends)
- **API rate limit bypass** for whitelisted IPs (all routes including `/api/*`, `/user/*`)
- **Cloudflare allow** firewall access rules per zone (via API)
- **fail2ban ignore file** export to `FAIL2BAN_IGNORE_FILE` (default `/app/data/fail2ban/onepos-ignore.conf`)

The API container **cannot** run `fail2ban-client` or SSH — it only writes the ignore file. On the Coolify host:

1. Bind-mount host path into the api volume, e.g. map `/etc/fail2ban/jail.d/onepos-ignore.conf` to container `FAIL2BAN_IGNORE_FILE`, **or** cron-copy from Docker volume.
2. In `/etc/fail2ban/jail.local` under `[DEFAULT]`:

```ini
[DEFAULT]
ignoreip = 127.0.0.1/8 ::1
# include OnePOS export (after panel sync):
# ignoreip = ... (paste from generated file or use include if your fail2ban version supports it)
```

3. After panel sync: `sudo fail2ban-client reload`

Env: `FAIL2BAN_IGNORE_FILE=/app/data/fail2ban/onepos-ignore.conf` (compose default).

### Manual dashboard settings (fallback)

| Setting | Value | Notes |
|---------|--------|--------|
| **DNS proxy** | **Proxied** (orange cloud) | All public records: `@`, `app`, `api`, and payment host |
| **SSL/TLS mode** | **Full (strict)** | Origin (Coolify/Let's Encrypt) must have a valid cert |
| **Always Use HTTPS** | **On** | Edge redirects HTTP → HTTPS |
| **Automatic HTTPS Rewrites** | **On** | Optional but recommended |
| **Minimum TLS Version** | **TLS 1.2** | Default is fine |
| **SSL/TLS mode: Flexible** | **Off** | Flexible breaks origin HTTPS and causes 525/504 loops |

DNS records (all **Proxied** → same Coolify server IP):

| Type | Name | Target |
|------|------|--------|
| A or CNAME | `@` | Coolify server |
| A or CNAME | `app` | Same server |
| A or CNAME | `api` | Same server |

If `odeme.click` is a separate zone, its A/CNAME must point to the **same origin IP** as `onekart.info`.

**Do not use for production:** grey cloud (DNS only), Flexible SSL, or pausing Cloudflare orange proxy — use only for short-lived debugging.

## Post-deploy verification

Test public URLs in the browser (through Cloudflare):

- `https://onekart.info`
- `https://app.onekart.info/login`
- `https://api.onekart.info/health`

Optional **server-side** check (Traefik only, not a substitute for Cloudflare testing):

```sh
curl -I --max-time 15 -k -H "Host: onekart.info" https://127.0.0.1/
```

Expected: **200** or **30x** — not timeout. If public URLs fail but this works, review Cloudflare SSL/proxy settings above.

If domains still include `:3105` or `:4105`, remove those suffixes and redeploy.

### Login fails with CORS / `api.onekart.info` 504

The browser error is usually **not** a CORS config bug. Check:

```sh
curl -I https://api.onekart.info/health
curl -I https://app.onekart.info/backend/health
```

| Result | Meaning |
|--------|---------|
| `api` → **504**, `backend/health` → **200** | API container is healthy but **`api` subdomain is not routed** in Coolify. Add `https://api.onekart.info` to the **api** service Domains tab (port **80**). Panel login should still work via `/backend` after web redeploy (see compose: empty `NEXT_PUBLIC_API_URL`). |
| Both **504** | API container down — check Coolify logs, `DATABASE_URL`, `REDIS_URL`, migrations. |
| `api/health` → **200** but browser CORS | Set `CORS_ORIGIN` on **api** to include `https://app.onekart.info` (comma-separated). |

`static.cloudflareinsights.com ... ERR_BLOCKED_BY_CLIENT` is an ad blocker — ignore it.

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

- Web proxies `/backend/*` → internal `http://api:80/*` (fallback when build lacks public API URL).
- Panel/pay browser requests use `/backend/*` on the web domain (internal `http://api:80`). `API_PUBLIC_URL` is for PSP webhooks and external integrations only.
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
