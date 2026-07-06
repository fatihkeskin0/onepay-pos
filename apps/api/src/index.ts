import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import fastifyRawBody from "fastify-raw-body";
import { config } from "./config.js";
import { error } from "./services/response.js";
import { userRoutes } from "./routes/user.js";
import { cashierRoutes } from "./routes/cashier.js";
import { adminRoutes } from "./routes/admin.js";
import { pspRoutes } from "./routes/psp.js";
import { bcRoutes } from "./routes/bc.js";
import { prisma } from "@onepara/db";

async function autoCancelDeposits(): Promise<void> {
  const now = new Date();

  await prisma.deposit.updateMany({
    where: {
      status: "pending",
      createdAt: { lt: new Date(now.getTime() - 35 * 60 * 1000) },
    },
    data: { status: "cancelled", rejectReason: "Süre aşımı: kullanıcı ödeme yapmadı" },
  });

  const expiredSessions = await prisma.paymentSession.findMany({
    where: { expiresAt: { lt: now }, depositRef: { not: null } },
  });

  for (const session of expiredSessions) {
    if (!session.depositRef) continue;
    await prisma.deposit.updateMany({
      where: { reference: session.depositRef, status: "pending" },
      data: { status: "cancelled", rejectReason: "Süre aşımı: ödeme süresi doldu" },
    });
  }
}

const app = Fastify({ logger: config.app.env === "development" });

await app.register(cors, {
  origin: config.app.env === "development" ? true : config.api.corsOrigin,
  methods: ["GET", "POST", "OPTIONS", "DELETE"],
  allowedHeaders: ["Authorization", "Content-Type", "X-API-Key", "X-APIKEY", "X-Signature", "Stripe-Signature"],
});

await app.register(formbody);
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

app.get("/health", async () => ({ ok: true }));

await app.register(userRoutes, { prefix: "/user" });
await app.register(cashierRoutes, { prefix: "/cashier" });
await app.register(adminRoutes, { prefix: "/admin" });
await app.register(pspRoutes, { prefix: "/psp" });
await app.register(bcRoutes, { prefix: "/api" });

setInterval(() => {
  autoCancelDeposits().catch(console.error);
}, 60_000);

try {
  await app.listen({ port: config.api.port, host: config.api.host });
  console.log(`API listening on http://${config.api.host}:${config.api.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
