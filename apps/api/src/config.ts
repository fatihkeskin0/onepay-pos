import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../../.env") });

const apiPort = Number(process.env.API_PORT ?? 4105);
const webPort = Number(process.env.WEB_PORT ?? 3105);

function envFirst(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function coolifyServiceUrl(urlKey: string, fqdnKey: string): string | undefined {
  const url = envFirst(urlKey);
  if (url) return url;
  const fqdn = envFirst(fqdnKey);
  if (!fqdn) return undefined;
  return fqdn.startsWith("http://") || fqdn.startsWith("https://") ? fqdn : `https://${fqdn}`;
}

const marketingUrl =
  envFirst("APP_MARKETING_URL") ??
  coolifyServiceUrl("SERVICE_URL_MARKETING", "SERVICE_FQDN_MARKETING") ??
  undefined;

const panelUrl =
  envFirst("APP_BASE_URL") ??
  coolifyServiceUrl("SERVICE_URL_WEB", "SERVICE_FQDN_WEB") ??
  marketingUrl ??
  `http://localhost:${webPort}`;

const paymentUrl =
  envFirst("APP_PAYMENT_URL") ??
  coolifyServiceUrl("SERVICE_URL_PAYMENT", "SERVICE_FQDN_PAYMENT") ??
  panelUrl;

const apiPublicUrl =
  envFirst("API_PUBLIC_URL") ??
  coolifyServiceUrl("SERVICE_URL_API", "SERVICE_FQDN_API") ??
  `http://localhost:${apiPort}`;

function cloudflareZones(): Array<{ id: string; domain: string }> {
  const zones: Array<{ id: string; domain: string }> = [];
  const onekartId = envFirst("CLOUDFLARE_ZONE_ID_ONEKART");
  const odemeId = envFirst("CLOUDFLARE_ZONE_ID_ODEME");
  if (onekartId) {
    zones.push({
      id: onekartId,
      domain: envFirst("CLOUDFLARE_ZONE_DOMAIN_ONEKART") ?? "onekart.info",
    });
  }
  if (odemeId) {
    zones.push({
      id: odemeId,
      domain: envFirst("CLOUDFLARE_ZONE_DOMAIN_ODEME") ?? "odeme.click",
    });
  }
  return zones;
}

function resolveCorsOrigins(): string | string[] {
  const explicit = envFirst("CORS_ORIGIN");
  const autoOrigins = [panelUrl, paymentUrl, marketingUrl].filter((x): x is string => Boolean(x));

  if (explicit) {
    const parts = explicit.split(",").map((s) => s.trim()).filter(Boolean);
    const merged = [...new Set([...parts, ...autoOrigins])];
    if (merged.length === 0) return panelUrl;
    if (merged.length === 1) return merged[0] ?? panelUrl;
    return merged;
  }

  const origins = [...new Set(autoOrigins)];
  if (origins.length <= 1) return origins[0] ?? panelUrl;
  return origins;
}

export const config = {
  db: {
    url: process.env.DATABASE_URL ?? "postgresql://onepara:onepara@localhost:5432/onepara_card",
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },
  app: {
    secret: process.env.APP_SECRET ?? "dev-secret-change-in-production",
    env: process.env.APP_ENV ?? "development",
    webPort,
    marketingUrl: marketingUrl ?? panelUrl,
    baseUrl: panelUrl,
    paymentUrl,
  },
  cloudflare: {
    apiToken: process.env.CLOUDFLARE_API_TOKEN ?? "",
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    originIp: process.env.CLOUDFLARE_ORIGIN_IP ?? "",
    autoSync: process.env.CLOUDFLARE_AUTO_SYNC === "1",
    zones: cloudflareZones(),
  },
  api: {
    port: apiPort,
    publicUrl: apiPublicUrl,
    host: process.env.API_HOST ?? "0.0.0.0",
    corsOrigin: resolveCorsOrigins(),
  },
  bc: {
    secret: process.env.BC_SECRET ?? "dev-bc-secret",
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  },
  psp: {
    defaultProvider: (process.env.PSP_DEFAULT_PROVIDER ?? "stripe") as "paytr" | "stripe" | "sumup",
    paytr: {
      merchantId: process.env.PAYTR_MERCHANT_ID ?? "",
      merchantKey: process.env.PAYTR_MERCHANT_KEY ?? "",
      merchantSalt: process.env.PAYTR_MERCHANT_SALT ?? "",
      testMode: (process.env.PAYTR_TEST_MODE ?? (process.env.APP_ENV === "production" ? "0" : "1")) === "1",
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? "",
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    },
    sumup: {
      apiKey: process.env.SUMUP_API_KEY ?? "",
      merchantCode: process.env.SUMUP_MERCHANT_CODE ?? "",
    },
  },
  upload: {
    dir: envFirst("UPLOAD_DIR") ?? resolve(__dirname, "../../../data/uploads"),
  },
  security: {
    fail2banIgnoreFile: envFirst("FAIL2BAN_IGNORE_FILE") ?? "",
  },
} as const;

const DEV_APP_SECRET = "dev-secret-change-in-production";
const DEV_BC_SECRET = "dev-bc-secret";

export function validateProductionSecrets(): void {
  if (config.app.env !== "production") return;

  if (!process.env.APP_SECRET?.trim() || config.app.secret === DEV_APP_SECRET) {
    console.error("[config] APP_SECRET must be set to a strong value in production");
    process.exit(1);
  }

  if (!process.env.BC_SECRET?.trim() || config.bc.secret === DEV_BC_SECRET) {
    console.warn(
      "[config] BC_SECRET is not set; BetConstruct wallet callbacks (/api/*) will reject requests until configured",
    );
  }
}

validateProductionSecrets();
