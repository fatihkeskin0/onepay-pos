#!/bin/sh
set -e

if [ -f /app/ops/scripts/disable-panel-whitelist.mjs ]; then
  cd /app
  exec node ops/scripts/disable-panel-whitelist.mjs
fi

echo "[break-glass] Panel whitelist kapatılıyor (SQL fallback)..."

if [ -z "$DATABASE_URL" ]; then
  echo "[break-glass] Hata: DATABASE_URL tanımlı değil" >&2
  exit 1
fi

cd /app/packages/db
printf '%s\n' \
  "INSERT INTO settings (key, value, updated_at) VALUES ('panel_access_whitelist_enabled', '0', NOW()) ON CONFLICT (key) DO UPDATE SET value = '0', updated_at = NOW();" \
  | npx prisma db execute --stdin

cd /app
if [ -n "$REDIS_URL" ]; then
  node -e "
    const Redis = require('ioredis');
    const r = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });
    r.del('cache:setting:panel_access_whitelist_enabled')
      .then(() => { console.log('[break-glass] Redis cache temizlendi.'); })
      .catch((e) => { console.warn('[break-glass] Redis:', e.message); })
      .finally(() => r.disconnect());
  " || true
fi

echo "[break-glass] Panel erişim whitelist KAPATILDI (value=0)."
echo "[break-glass] Panel IP bellek cache en fazla ~60sn sürebilir; gerekirse api container restart."
