import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";
import fastifyRawBody from "fastify-raw-body";
import { join } from "node:path";
import { API_ROUTE_PREFIX } from "@onepara/shared";
import { config } from "./config.js";
import { createAppLogger, DEV_QUIET_ROUTE_PATHS } from "./logger.js";
import { error } from "./services/response.js";
import { userRoutes } from "./routes/user.js";
import { cashierRoutes } from "./routes/cashier.js";
import { adminRoutes } from "./routes/admin.js";
import { pspRoutes } from "./routes/psp.js";
import { bcRoutes } from "./routes/bc.js";
import { publicRoutes } from "./routes/public.js";
import { prisma } from "@onepara/db";
import { pingRedis, waitForRedis } from "./services/redis.js";
import { depositCancelled, depositUrl, getSiteCallback } from "./services/callback.js";
import { runCloudflareAutoSync } from "./services/cloudflare.js";

async function notifyDepositCancelled(depositId: number): Promise<void> {
  const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!deposit?.siteId) return;

  const siteCb = await getSiteCallback(deposit.siteId);
  if (!siteCb) return;

  const url = depositUrl(siteCb);
  if (url) {
    await depositCancelled(deposit, siteCb.apiKey, url);
  }
}

async function autoCancelDeposits(): Promise<void> {
  const now = new Date();

  const staleDeposits = await prisma.deposit.findMany({
    where: {
      status: "pending",
      createdAt: { lt: new Date(now.getTime() - 35 * 60 * 1000) },
    },
    select: { id: true },
  });

  if (staleDeposits.length > 0) {
    await prisma.deposit.updateMany({
      where: {
        id: { in: staleDeposits.map((d) => d.id) },
        status: "pending",
      },
      data: { status: "cancelled", rejectReason: "Süre aşımı: kullanıcı ödeme yapmadı" },
    });

    for (const row of staleDeposits) {
      await notifyDepositCancelled(row.id);
    }
  }

  const expiredSessions = await prisma.paymentSession.findMany({
    where: { expiresAt: { lt: now }, depositRef: { not: null } },
  });

  for (const session of expiredSessions) {
    if (!session.depositRef) continue;

    const pending = await prisma.deposit.findMany({
      where: { reference: session.depositRef, status: "pending" },
      select: { id: true },
    });

    if (pending.length === 0) continue;

    await prisma.deposit.updateMany({
      where: { reference: session.depositRef, status: "pending" },
      data: { status: "cancelled", rejectReason: "Süre aşımı: ödeme süresi doldu" },
    });

    for (const row of pending) {
      await notifyDepositCancelled(row.id);
    }
  }
}

const app = Fastify({
  logger: createAppLogger(),
});

if (config.app.env === "development") {
  app.addHook("onRoute", (routeOptions) => {
    const path = routeOptions.url ?? "";
    const quiet =
      path === "/health" ||
      path.endsWith("/badges") ||
      DEV_QUIET_ROUTE_PATHS.has(path);
    if (quiet) {
      routeOptions.logLevel = "silent";
    }
  });
}

await app.register(cors, {
  origin: config.app.env === "development" ? true : config.api.corsOrigin,
  methods: ["GET", "POST", "OPTIONS", "DELETE"],
  allowedHeaders: ["Authorization", "Content-Type", "X-API-Key", "X-APIKEY", "X-Signature", "Stripe-Signature"],
});

await app.register(formbody);
await app.register(fastifyStatic, {
  root: join(config.upload.dir),
  prefix: "/uploads/",
  decorateReply: false,
});
await app.register(fastifyRawBody, {
  field: "rawBody",
  global: true,
  encoding: "utf8",
  runFirst: true,
});

app.setErrorHandler((err, _request, reply) => {
  console.error(err);
  if (config.app.env === "production") {
    error(reply, "Sunucu hatası", 500);
  } else {
    error(reply, (err as Error).message, 500);
  }
});

app.get("/health", async (_request, reply) => {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const redisOk = await pingRedis();
  const okHealth = dbOk && redisOk;

  reply.status(okHealth ? 200 : 503).send({ ok: okHealth, db: dbOk, redis: redisOk });
});

async function versionedApiRoutes(app: FastifyInstance): Promise<void> {
  await app.register(userRoutes, { prefix: "/user" });
  await app.register(cashierRoutes, { prefix: "/cashier" });
  await app.register(adminRoutes, { prefix: "/admin" });
  await app.register(pspRoutes, { prefix: "/psp" });
  await app.register(bcRoutes, { prefix: "/api" });
  await app.register(publicRoutes, { prefix: "/public" });
}

await app.register(versionedApiRoutes, { prefix: API_ROUTE_PREFIX });

setInterval(() => {
  autoCancelDeposits().catch(console.error);
}, 60_000);

try {
  await waitForRedis();
  await app.listen({ port: config.api.port, host: config.api.host });
  console.log(`API listening on http://${config.api.host}:${config.api.port}`);
  await runCloudflareAutoSync();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
