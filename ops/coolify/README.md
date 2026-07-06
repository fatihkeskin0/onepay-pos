# Coolify Deployment

Deploy OnePOS as a **Docker Compose** resource on Coolify.

## Stack

| Service | Dockerfile | Port | Public domain |
|---------|------------|------|---------------|
| `web` | `ops/docker/Dockerfile.web` | 3105 | Yes — panel + `/pay/*` + `/docs` |
| `api` | `ops/docker/Dockerfile.api` | 4105 | Yes — PSP webhooks (`/psp/*`) |
| `mysql` | MariaDB 10.11 image | 3306 | No — internal only |

## Quick setup

1. Create a new **Docker Compose** project in Coolify.
2. Point to this repo; compose file: `ops/docker/compose.prod.yml`.
3. Copy `.env.production.example` → Coolify **Environment Variables**.
4. Set required values:
   - `APP_BASE_URL` — web domain (`https://pay.yourdomain.com`)
   - `API_PUBLIC_URL` — api domain (`https://api.yourdomain.com`)
   - `APP_SECRET`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`
5. Map domains in Coolify:
   - **web** service → `APP_BASE_URL` domain, port `3105`
   - **api** service → `API_PUBLIC_URL` domain, port `4105`
6. Deploy. API entrypoint runs `prisma db push` automatically.

## First admin user

After first deploy, exec into the **api** container and seed once:

```sh
pnpm db:seed
```

Or run locally against production DB with `DATABASE_URL` set.

Default seed credentials (change immediately):

- `admin` / `admin123`

## External MySQL

To use Coolify/managed MySQL instead of the bundled `mysql` service:

1. Remove the `mysql` service from compose (or disable it).
2. Set `DATABASE_URL` to your external connection string.
3. Remove `depends_on: mysql` from the `api` service.

## Architecture notes

- Web proxies `/backend/*` → internal `http://api:4105/*` (set at build via `NEXT_PUBLIC_API_URL`).
- Merchants integrate via `/backend/user/*` on the **web** domain.
- PSP callbacks hit **api** domain: `POST /psp/{provider}/callback`.
- Health checks: `GET /api/health` (web), `GET /health` (api).

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
