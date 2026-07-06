#!/bin/sh
set -e

cd /app/packages/db

echo "[api] Applying database schema..."
attempt=1
until npx prisma db push --skip-generate; do
  if [ "$attempt" -ge 15 ]; then
    echo "[api] Database schema push failed after ${attempt} attempts"
    exit 1
  fi
  echo "[api] DB not ready (attempt ${attempt}), retrying in 3s..."
  attempt=$((attempt + 1))
  sleep 3
done

echo "[api] Starting Fastify..."
cd /app
exec node apps/api/dist/index.js
