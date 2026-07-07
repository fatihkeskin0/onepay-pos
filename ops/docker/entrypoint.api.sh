#!/bin/sh
set -e

log_host() {
  name="$1"
  url="$2"
  host=$(printf '%s' "$url" | sed -n 's#.*@\([^/:]*\).*#\1#p')
  if [ -z "$host" ]; then
    host=$(printf '%s' "$url" | sed -n 's#^[a-z]*://\([^:/@]*\).*#\1#p')
  fi
  echo "[api] ${name} host: ${host:-unknown}"
}

log_host "DATABASE_URL" "$DATABASE_URL"
log_host "REDIS_URL" "$REDIS_URL"

cd /app/packages/db

echo "[api] Applying database migrations..."
attempt=1
max_attempts=30
until npx prisma migrate deploy; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "[api] Database migration failed after ${attempt} attempts"
    exit 1
  fi
  echo "[api] DB not ready (attempt ${attempt}/${max_attempts}), retrying in 5s..."
  attempt=$((attempt + 1))
  sleep 5
done

echo "[api] Starting Fastify..."
cd /app
exec node apps/api/dist/index.js
