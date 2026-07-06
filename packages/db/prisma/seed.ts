import bcrypt from "bcryptjs";
import { prisma } from "../src/index.js";

async function main() {
  const adminHash = await bcrypt.hash("admin123", 10);
  const agentHash = await bcrypt.hash("agent123", 10);

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
    ["psp_default_provider", "mock"],
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
    { provider: "mock", label: "Mock (Dev)", enabled: true, isDefault: true, minAmount: 50, maxAmount: 100000, sortOrder: 0 },
    { provider: "paytr", label: "PayTR", enabled: false, isDefault: false, minAmount: 50, maxAmount: 50000, sortOrder: 1 },
    { provider: "stripe", label: "Stripe", enabled: false, isDefault: false, minAmount: 100, maxAmount: 100000, sortOrder: 2 },
    { provider: "sumup", label: "SumUp", enabled: false, isDefault: false, minAmount: 50, maxAmount: 25000, sortOrder: 3 },
  ] as const;

  for (const pm of posMethods) {
    await prisma.posMethod.upsert({
      where: { provider: pm.provider },
      update: {},
      create: pm,
    });
  }

  console.log("Seed complete:", { siteId: site.id, adminId: admin.id, agentId: agent.id });
  console.log("Login: admin / admin123, agent / agent123");
  console.log("Site API key:", site.apiKey);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
