#!/bin/sh
set -e

cd /app/packages/db

echo "[api] Applying database migrations..."
attempt=1
until npx prisma migrate deploy; do
  if [ "$attempt" -ge 15 ]; then
    echo "[api] Database migration failed after ${attempt} attempts"
    exit 1
  fi
  echo "[api] DB not ready (attempt ${attempt}), retrying in 3s..."
  attempt=$((attempt + 1))
  sleep 3
done

echo "[api] Starting Fastify..."
cd /app
exec node apps/api/dist/index.js
