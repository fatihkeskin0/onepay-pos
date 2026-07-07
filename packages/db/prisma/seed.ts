import bcrypt from "bcryptjs";
import { prisma } from "../src/index.js";

async function main() {
  const appEnv = process.env.APP_ENV ?? "development";
  if (appEnv === "production" && process.env.SEED_ALLOW !== "1") {
    console.error("Seed blocked in production. Set SEED_ALLOW=1 to override.");
    process.exit(1);
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const agentPassword = process.env.SEED_AGENT_PASSWORD ?? "agent123";
  const adminHash = await bcrypt.hash(adminPassword, 12);
  const agentHash = await bcrypt.hash(agentPassword, 12);

  const site = await prisma.site.upsert({
    where: { apiKey: "dev_site_api_key_00000000000000000000000000000001" },
    update: {},
    create: {
      name: "Dev Site",
      apiKey: "dev_site_api_key_00000000000000000000000000000001",
      minDeposit: 100,
      callbackUrlDeposit: "http://localhost:4105/test/callback",
      brandColor: "#2563EB",
      brandBgColor: "#F4F7FC",
    },
  });

  const admin = await prisma.cashier.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: adminHash,
      role: "admin",
      isActive: true,
    },
  });

  const agent = await prisma.cashier.upsert({
    where: { username: "agent" },
    update: {},
    create: {
      username: "agent",
      passwordHash: agentHash,
      role: "kasiyer",
      isActive: true,
      commissionRate: 5,
    },
  });

  await prisma.cashierSite.upsert({
    where: { cashierId_siteId: { cashierId: agent.id, siteId: site.id } },
    update: {},
    create: { cashierId: agent.id, siteId: site.id },
  });

  const settings = [
    ["chat_enabled", "1"],
    ["telegram_notify_deposit", "1"],
    ["usd_rate", "34.50"],
  ] as const;

  for (const [key, value] of settings) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  const posMethods = [
    { provider: "paytr", label: "PayTR", enabled: false, isDefault: false, minAmount: 50, maxAmount: 50000, sortOrder: 0 },
    { provider: "stripe", label: "Stripe", enabled: false, isDefault: false, minAmount: 100, maxAmount: 100000, sortOrder: 1 },
    { provider: "sumup", label: "SumUp", enabled: false, isDefault: false, minAmount: 50, maxAmount: 25000, sortOrder: 2 },
  ] as const;

  for (const pm of posMethods) {
    await prisma.posMethod.upsert({
      where: { provider: pm.provider },
      update: {},
      create: pm,
    });
  }

  console.log("Seed complete:", { siteId: site.id, adminId: admin.id, agentId: agent.id });
  if (appEnv !== "production") {
    console.log("Dev login: admin / (SEED_ADMIN_PASSWORD or admin123)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
