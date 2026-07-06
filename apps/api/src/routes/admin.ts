import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { prisma } from "@onepara/db";
import { requireAuth, hashPassword, generateApiKey } from "../services/auth.js";
import { ok, error } from "../services/response.js";
import { config } from "../config.js";
import { approveDeposit, rejectDeposit } from "../services/payment.js";
import { depositApproved, depositRejected, depositUrl, getSiteCallback } from "../services/callback.js";
import { listPosMethodsWithMeta } from "../services/pos-methods.js";

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/dashboard", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);

    const [
      pending,
      approvedToday,
      amountToday,
      commissionToday,
      rejectedToday,
      onlineAgents,
      weekDeposits,
      recent,
    ] = await Promise.all([
      prisma.deposit.count({ where: { status: "pending" } }),
      prisma.deposit.count({ where: { status: "approved", approvedAt: { gte: today } } }),
      prisma.deposit.aggregate({ where: { status: "approved", approvedAt: { gte: today } }, _sum: { amount: true } }),
      prisma.deposit.aggregate({ where: { status: "approved", approvedAt: { gte: today } }, _sum: { commissionAmount: true } }),
      prisma.deposit.count({ where: { status: "rejected", approvedAt: { gte: today } } }),
      prisma.cashier.count({
        where: {
          role: "kasiyer",
          isActive: true,
          lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
      }),
      prisma.deposit.findMany({
        where: { status: "approved", approvedAt: { gte: weekStart } },
        select: { amount: true, approvedAt: true },
      }),
      prisma.deposit.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { site: { select: { name: true } } },
      }),
    ]);

    const trendMap = new Map<string, { count: number; amount: number }>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      trendMap.set(d.toISOString().slice(0, 10), { count: 0, amount: 0 });
    }
    for (const dep of weekDeposits) {
      if (!dep.approvedAt) continue;
      const key = dep.approvedAt.toISOString().slice(0, 10);
      const slot = trendMap.get(key);
      if (slot) {
        slot.count += 1;
        slot.amount += Number(dep.amount);
      }
    }
    const trend = Array.from(trendMap.entries()).map(([date, v]) => ({ date, ...v }));

    ok(reply, {
      pending_deposits: pending,
      approved_today: approvedToday,
      amount_today: amountToday._sum.amount ?? 0,
      commission_today: commissionToday._sum.commissionAmount ?? 0,
      rejected_today: rejectedToday,
      online_agents: onlineAgents,
      trend,
      recent: recent.map((d) => ({
        id: d.id,
        reference: d.reference,
        amount: d.amount,
        status: d.status,
        site_name: d.site?.name ?? "—",
        user_id: d.userId,
        created_at: d.createdAt.toISOString(),
      })),
    });
  });

  app.get("/badges", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;

    const [dep, suspicious, online, chatUnread] = await Promise.all([
      prisma.deposit.count({ where: { status: "pending" } }),
      prisma.deposit.count({ where: { isSuspicious: true, status: "pending" } }),
      prisma.cashier.count({
        where: { role: "kasiyer", lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
      }),
      prisma.chatMessage.count({ where: { sender: "cashier", readAt: null } }),
    ]);

    ok(reply, {
      deposits: dep,
      suspicious,
      online_kas: online,
      chat_unread: chatUnread,
    });
  });

  app.get("/sites", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const items = await prisma.site.findMany({ orderBy: { name: "asc" } });
    ok(reply, { items });
  });

  app.post("/add_site", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const body = request.body as Record<string, unknown>;
    const site = await prisma.site.create({
      data: {
        name: String(body.name),
        apiKey: generateApiKey(),
        minDeposit: Number(body.min_deposit ?? 100),
        callbackUrlDeposit: body.callback_url_deposit ? String(body.callback_url_deposit) : null,
        brandColor: String(body.brand_color ?? "#2563EB"),
        brandBgColor: String(body.brand_bg_color ?? "#F4F7FC"),
        brandLogoUrl: body.brand_logo_url ? String(body.brand_logo_url) : null,
        depCommissionRate: Number(body.dep_commission_rate ?? 0),
      },
    });
    ok(reply, { site });
  });

  app.post("/update_site", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const body = request.body as Record<string, unknown>;
    const id = Number(body.id);
    const site = await prisma.site.update({
      where: { id },
      data: {
        name: body.name ? String(body.name) : undefined,
        minDeposit: body.min_deposit != null ? Number(body.min_deposit) : undefined,
        callbackUrlDeposit: body.callback_url_deposit != null ? String(body.callback_url_deposit) : undefined,
        brandColor: body.brand_color ? String(body.brand_color) : undefined,
        brandBgColor: body.brand_bg_color ? String(body.brand_bg_color) : undefined,
        brandLogoUrl: body.brand_logo_url != null ? String(body.brand_logo_url) : undefined,
        isActive: body.is_active != null ? Boolean(body.is_active) : undefined,
        depCommissionRate: body.dep_commission_rate != null ? Number(body.dep_commission_rate) : undefined,
      },
    });
    ok(reply, { site });
  });

  app.post("/toggle_site", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const id = Number((request.body as { id?: number }).id);
    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      error(reply, "Site bulunamadı", 404);
      return;
    }
    const updated = await prisma.site.update({ where: { id }, data: { isActive: !site.isActive } });
    ok(reply, { site: updated });
  });

  app.get("/cashiers", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const items = await prisma.cashier.findMany({ orderBy: { username: "asc" } });
    ok(reply, { items });
  });

  app.post("/add_cashier", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const body = request.body as Record<string, unknown>;
    const cashier = await prisma.cashier.create({
      data: {
        username: String(body.username),
        passwordHash: await hashPassword(String(body.password)),
        role: (body.role as "kasiyer" | "admin") ?? "kasiyer",
        commissionRate: Number(body.commission_rate ?? 5),
      },
    });
    ok(reply, { cashier });
  });

  app.post("/update_cashier", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const body = request.body as Record<string, unknown>;
    const id = Number(body.id);
    const data: Record<string, unknown> = {};
    if (body.commission_rate != null) data.commissionRate = Number(body.commission_rate);
    if (body.is_active != null) data.isActive = Boolean(body.is_active);
    if (body.password) data.passwordHash = await hashPassword(String(body.password));
    if (body.telegram_chat_id != null) data.telegramChatId = String(body.telegram_chat_id) || null;
    if (body.admin_note != null) data.adminNote = String(body.admin_note) || null;
    const cashier = await prisma.cashier.update({ where: { id }, data });
    ok(reply, { cashier });
  });

  app.post("/toggle_cashier", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const id = Number((request.body as { id?: number }).id);
    const c = await prisma.cashier.findUnique({ where: { id } });
    if (!c) {
      error(reply, "Bulunamadı", 404);
      return;
    }
    const updated = await prisma.cashier.update({ where: { id }, data: { isActive: !c.isActive } });
    ok(reply, { cashier: updated });
  });

  app.post("/force_logout", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const id = Number((request.body as { id?: number }).id);
    await prisma.cashier.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
    ok(reply, {});
  });

  app.get("/deposits", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;

    const q = request.query as Record<string, string>;
    const status = q.status ?? "all";
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = 20;
    const where: Record<string, unknown> = {};
    if (status !== "all") where.status = status;
    if (q.site_id) where.siteId = Number(q.site_id);

    const [items, total] = await Promise.all([
      prisma.deposit.findMany({
        where,
        include: { site: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.deposit.count({ where }),
    ]);

    ok(reply, { items, total, page });
  });

  app.post("/update_deposit_amount", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const body = request.body as { id?: number; amount?: number };
    const deposit = await prisma.deposit.findUnique({ where: { id: Number(body.id) } });
    if (!deposit) {
      error(reply, "Bulunamadı", 404);
      return;
    }
    await prisma.depositEditLog.create({
      data: {
        depositId: deposit.id,
        oldAmount: deposit.amount,
        newAmount: body.amount ?? deposit.amount,
        editedBy: String(user.id),
      },
    });
    const updated = await prisma.deposit.update({
      where: { id: deposit.id },
      data: { amount: body.amount ?? deposit.amount },
    });
    ok(reply, { deposit: updated });
  });

  app.get("/deposit_edit_logs", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const depositId = Number((request.query as { deposit_id?: string }).deposit_id);
    const items = await prisma.depositEditLog.findMany({ where: { depositId }, orderBy: { editedAt: "desc" } });
    ok(reply, { items });
  });

  app.get("/users", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const search = (request.query as { search?: string }).search ?? "";
    const wallets = await prisma.wallet.findMany({
      where: search ? { userId: { contains: search } } : {},
      take: 50,
      orderBy: { updatedAt: "desc" },
    });
    ok(reply, { items: wallets });
  });

  app.get("/user_detail", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const userId = String((request.query as { user_id?: string }).user_id ?? "");
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const txs = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    ok(reply, { wallet, transactions: txs });
  });

  app.get("/agent_monitor", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const agents = await prisma.cashier.findMany({
      where: { role: "kasiyer", isActive: true },
      select: { id: true, username: true, lastSeenAt: true, lastLogin: true },
    });
    ok(reply, {
      agents: agents.map((a) => ({
        ...a,
        online: a.lastSeenAt ? a.lastSeenAt.getTime() > Date.now() - 5 * 60 * 1000 : false,
      })),
    });
  });

  app.get("/all_sub_users", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const items = await prisma.cashierSubUser.findMany({ include: { cashier: { select: { username: true } } } });
    ok(reply, { items });
  });

  app.post("/toggle_sub_user", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const id = Number((request.body as { id?: number }).id);
    const sub = await prisma.cashierSubUser.findUnique({ where: { id } });
    if (!sub) {
      error(reply, "Bulunamadı", 404);
      return;
    }
    const updated = await prisma.cashierSubUser.update({
      where: { id },
      data: { isActive: !sub.isActive },
    });
    ok(reply, { sub: updated });
  });

  app.post("/delete_sub_user", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const id = Number((request.body as { id?: number }).id);
    await prisma.cashierSubUser.delete({ where: { id } });
    ok(reply, {});
  });

  app.post("/reset_sub_password", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const body = request.body as { id?: number; new_password?: string };
    const id = Number(body.id);
    const updated = await prisma.cashierSubUser.update({
      where: { id },
      data: { passwordHash: await hashPassword(String(body.new_password)) },
    });
    ok(reply, { sub: updated });
  });

  app.get("/login_logs", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const items = await prisma.loginLog.findMany({ orderBy: { loggedInAt: "desc" }, take: 100 });
    ok(reply, { items });
  });

  app.get("/settings", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const items = await prisma.setting.findMany();
    ok(reply, { settings: Object.fromEntries(items.map((s) => [s.key, s.value])) });
  });

  app.post("/update_settings", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const body = request.body as Record<string, string>;
    for (const [key, value] of Object.entries(body)) {
      await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
    ok(reply, {});
  });

  app.get("/announcements", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const items = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" } });
    ok(reply, { items });
  });

  app.post("/save_announcement", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const body = request.body as { id?: number; title?: string; body?: string; type?: string; is_active?: boolean };
    if (body.id) {
      const ann = await prisma.announcement.update({
        where: { id: body.id },
        data: {
          title: body.title,
          body: body.body,
          type: (body.type as "info" | "warning" | "success") ?? "info",
          isActive: body.is_active ?? true,
        },
      });
      ok(reply, { announcement: ann });
      return;
    }
    const ann = await prisma.announcement.create({
      data: {
        title: String(body.title),
        body: String(body.body),
        type: (body.type as "info" | "warning" | "success") ?? "info",
      },
    });
    ok(reply, { announcement: ann });
  });

  app.post("/delete_announcement", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    await prisma.announcement.delete({ where: { id: Number((request.body as { id?: number }).id) } });
    ok(reply, {});
  });

  app.get("/reports", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const q = request.query as { from?: string; to?: string };
    const from = q.from ? new Date(q.from) : new Date(Date.now() - 7 * 86400000);
    const to = q.to ? new Date(q.to) : new Date();

    const deposits = await prisma.deposit.groupBy({
      by: ["status"],
      where: { createdAt: { gte: from, lte: to } },
      _count: true,
      _sum: { amount: true },
    });

    ok(reply, { from, to, deposits });
  });

  app.get("/site_reconciliation", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;

    const q = request.query as { from?: string; to?: string };
    const to = q.to ? new Date(`${q.to}T23:59:59`) : new Date();
    const from = q.from ? new Date(`${q.from}T00:00:00`) : new Date(Date.now() - 30 * 86400000);

    const grouped = await prisma.deposit.groupBy({
      by: ["siteId"],
      where: {
        status: "approved",
        approvedAt: { gte: from, lte: to },
        siteId: { not: null },
      },
      _count: true,
      _sum: { amount: true, commissionAmount: true },
    });

    const siteIds = grouped.map((g) => g.siteId).filter((id): id is number => id != null);
    const sites = siteIds.length
      ? await prisma.site.findMany({ where: { id: { in: siteIds } }, select: { id: true, name: true } })
      : [];
    const siteMap = new Map(sites.map((s) => [s.id, s.name]));

    const rows = grouped.map((g) => {
      const gross = Number(g._sum.amount ?? 0);
      const commission = Number(g._sum.commissionAmount ?? 0);
      return {
        site_id: g.siteId,
        site_name: g.siteId ? (siteMap.get(g.siteId) ?? "—") : "—",
        count: g._count,
        gross,
        commission,
        net: gross - commission,
      };
    });

    const totals = rows.reduce(
      (acc, r) => ({
        count: acc.count + r.count,
        gross: acc.gross + r.gross,
        commission: acc.commission + r.commission,
        net: acc.net + r.net,
      }),
      { count: 0, gross: 0, commission: 0, net: 0 },
    );

    ok(reply, { from: from.toISOString(), to: to.toISOString(), rows, totals });
  });

  app.get("/supheliler", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const items = await prisma.deposit.findMany({
      where: { isSuspicious: true },
      include: { site: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    ok(reply, { items });
  });

  app.get("/chat_list", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const cashiers = await prisma.cashier.findMany({
      where: { role: "kasiyer", isActive: true },
      select: { id: true, username: true },
    });
    const unread = await prisma.chatMessage.groupBy({
      by: ["cashierId"],
      where: { sender: "cashier", readAt: null },
      _count: true,
    });
    ok(reply, { cashiers, unread });
  });

  app.get("/chat", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const cashierId = Number((request.query as { cashier_id?: string }).cashier_id);
    const messages = await prisma.chatMessage.findMany({
      where: { cashierId },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    await prisma.chatMessage.updateMany({
      where: { cashierId, sender: "cashier", readAt: null },
      data: { readAt: new Date() },
    });
    ok(reply, { messages });
  });

  app.post("/chat", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const body = request.body as { cashier_id?: number; message?: string };
    const msg = await prisma.chatMessage.create({
      data: {
        cashierId: Number(body.cashier_id),
        sender: "admin",
        senderName: "Admin",
        message: String(body.message),
      },
    });
    ok(reply, { message: msg });
  });

  app.get("/reconciliation", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const items = await prisma.pspSettlement.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    ok(reply, { items });
  });

  app.post("/reconciliation/import", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const body = request.body as {
      provider?: string;
      period_start?: string;
      period_end?: string;
      gross_amount?: number;
      fee_amount?: number;
      net_amount?: number;
    };

    const settlement = await prisma.pspSettlement.create({
      data: {
        provider: String(body.provider ?? "mock"),
        periodStart: new Date(body.period_start ?? Date.now()),
        periodEnd: new Date(body.period_end ?? Date.now()),
        grossAmount: body.gross_amount ?? 0,
        feeAmount: body.fee_amount ?? 0,
        netAmount: body.net_amount ?? 0,
        status: "pending",
      },
    });

    const matched = await prisma.deposit.count({
      where: {
        status: "approved",
        pspProvider: settlement.provider,
        approvedAt: { gte: settlement.periodStart, lte: settlement.periodEnd },
      },
    });

    await prisma.pspSettlement.update({
      where: { id: settlement.id },
      data: { matchedCount: matched, status: matched > 0 ? "partial" : "pending" },
    });

    ok(reply, { settlement, matched });
  });

  app.get("/pos_methods", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const items = await listPosMethodsWithMeta();
    ok(reply, { items });
  });

  app.post("/save_pos_method", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const body = request.body as {
      provider?: string;
      label?: string;
      enabled?: boolean;
      min_amount?: number;
      max_amount?: number;
      sort_order?: number;
      is_default?: boolean;
    };
    const provider = String(body.provider ?? "");
    if (!provider) {
      error(reply, "provider gerekli", 422);
      return;
    }

    if (body.is_default) {
      await prisma.posMethod.updateMany({ data: { isDefault: false } });
    }

    const method = await prisma.posMethod.upsert({
      where: { provider },
      update: {
        label: body.label != null ? String(body.label) : undefined,
        enabled: body.enabled != null ? Boolean(body.enabled) : undefined,
        minAmount: body.min_amount != null ? Number(body.min_amount) : undefined,
        maxAmount: body.max_amount != null ? Number(body.max_amount) : undefined,
        sortOrder: body.sort_order != null ? Number(body.sort_order) : undefined,
        isDefault: body.is_default != null ? Boolean(body.is_default) : undefined,
      },
      create: {
        provider,
        label: String(body.label ?? provider),
        enabled: Boolean(body.enabled ?? false),
        minAmount: Number(body.min_amount ?? 50),
        maxAmount: Number(body.max_amount ?? 100000),
        sortOrder: Number(body.sort_order ?? 0),
        isDefault: Boolean(body.is_default ?? false),
      },
    });

    ok(reply, { method });
  });

  app.post("/toggle_pos_method", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const provider = String((request.body as { provider?: string }).provider ?? "");
    const method = await prisma.posMethod.findUnique({ where: { provider } });
    if (!method) {
      error(reply, "Bulunamadı", 404);
      return;
    }
    const updated = await prisma.posMethod.update({
      where: { provider },
      data: { enabled: !method.enabled },
    });
    ok(reply, { method: updated });
  });

  app.post("/test_load", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    ok(reply, { loaded: true });
  });

  app.post("/demo_payment_link", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;

    const body = request.body as Record<string, unknown>;
    const siteId = Number(body.site_id);
    const userId = String(body.user_id ?? "demo_user");
    const userName = String(body.name ?? "Demo Müşteri");
    const amount = body.amount != null ? Number(body.amount) : 0;
    const returnUrl = body.return_url ? String(body.return_url) : `${config.app.baseUrl}/panel/demo`;

    if (!siteId) {
      error(reply, "site_id gerekli", 422);
      return;
    }

    const site = await prisma.site.findFirst({ where: { id: siteId, isActive: true } });
    if (!site) {
      error(reply, "Site bulunamadı veya pasif", 404);
      return;
    }

    if (amount > 0 && amount < Number(site.minDeposit)) {
      error(reply, `Minimum yatırım tutarı ${site.minDeposit} TL`, 422);
      return;
    }

    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 45 * 60 * 1000);

    await prisma.paymentSession.create({
      data: {
        token,
        siteId: site.id,
        userId,
        amount,
        userName,
        returnUrl,
        expiresAt,
        externalId: `demo-${Date.now()}`,
      },
    });

    const payPath = `/pay/${token}`;
    ok(reply, {
      token,
      url: `${config.app.paymentUrl}${payPath}`,
      pay_path: payPath,
      expires_at: expiresAt.toISOString(),
      amount_editable: amount === 0,
      site_name: site.name,
    });
  });

  app.post("/test_reset", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    ok(reply, { reset: true });
  });
}
