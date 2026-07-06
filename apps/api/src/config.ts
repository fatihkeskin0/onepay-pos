import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../../.env") });

const apiPort = Number(process.env.API_PORT ?? 4105);
const webPort = Number(process.env.WEB_PORT ?? 3105);

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
    baseUrl: process.env.APP_BASE_URL ?? `http://localhost:${webPort}`,
    paymentUrl: process.env.APP_PAYMENT_URL ?? `http://localhost:${webPort}`,
  },
  api: {
    port: apiPort,
    publicUrl: process.env.API_PUBLIC_URL ?? `http://localhost:${apiPort}`,
    host: process.env.API_HOST ?? "0.0.0.0",
    corsOrigin: process.env.CORS_ORIGIN ?? `http://localhost:${webPort}`,
  },
  bc: {
    secret: process.env.BC_SECRET ?? "dev-bc-secret",
    apiUrl: process.env.BC_API_URL ?? "https://api.betconstruct.com",
    partnerId: process.env.BC_PARTNER_ID ?? "",
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  },
  psp: {
    defaultProvider: (process.env.PSP_DEFAULT_PROVIDER ?? "mock") as "mock" | "paytr" | "stripe" | "sumup",
    paytr: {
      merchantId: process.env.PAYTR_MERCHANT_ID ?? "",
      merchantKey: process.env.PAYTR_MERCHANT_KEY ?? "",
      merchantSalt: process.env.PAYTR_MERCHANT_SALT ?? "",
      testMode: (process.env.PAYTR_TEST_MODE ?? (process.env.APP_ENV === "production" ? "0" : "1")) === "1",
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? "",
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    },
    sumup: {
      apiKey: process.env.SUMUP_API_KEY ?? "",
      merchantCode: process.env.SUMUP_MERCHANT_CODE ?? "",
    },
  },
} as const;
