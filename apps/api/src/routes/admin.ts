import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { prisma } from "@onepara/db";
import { requireAuth, hashPassword, generateApiKey } from "../services/auth.js";
import { ok, error } from "../services/response.js";
import { config } from "../config.js";
import { approveDeposit, rejectDeposit } from "../services/payment.js";
import { depositApproved, depositRejected, depositUrl, getSiteCallback, invalidateSettingCache } from "../services/callback.js";
import { invalidatePosMethodsCache, listPosMethodsWithMeta, activateSinglePosMethod, deactivatePosMethod } from "../services/pos-methods.js";
import { formatBcExpiry } from "../services/format.js";
import { getActivityLogs } from "../services/activity-log.js";
import { buildSiteDepositsXlsx } from "../services/deposit-export.js";
import { saveSiteLogo } from "../services/site-logo.js";
import { getCloudflareStatus, isCloudflareConfigured, syncCloudflare } from "../services/cloudflare.js";
import {
  addTrustedIp,
  deleteTrustedIp,
  exportFail2banIgnoreFile,
  listTrustedIps,
  syncTrustedIpIntegrations,
  updateTrustedIp,
} from "../services/trusted-ip.js";

const PAYMENT_LINK_TTL_MS = 15 * 60 * 1000;

function parseBrandTheme(value: unknown): "light" | "dark" {
  return String(value ?? "light") === "dark" ? "dark" : "light";
}

function parseReconciliationRange(q: { from?: string; to?: string }) {
  const to = q.to ? new Date(`${q.to}T23:59:59`) : new Date();
  const from = q.from ? new Date(`${q.from}T00:00:00`) : new Date(Date.now() - 30 * 86400000);
  return { from, to };
}

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

    const [dep, suspicious, online, applications] = await Promise.all([
      prisma.deposit.count({ where: { status: "pending" } }),
      prisma.deposit.count({ where: { isSuspicious: true, status: "pending" } }),
      prisma.cashier.count({
        where: { role: "kasiyer", lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
      }),
      prisma.merchantApplication.count({ where: { status: "new" } }),
    ]);

    ok(reply, {
      deposits: dep,
      suspicious,
      online_kas: online,
      applications,
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
        brandTheme: parseBrandTheme(body.brand_theme),
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
        brandTheme: body.brand_theme != null ? parseBrandTheme(body.brand_theme) : undefined,
        brandLogoUrl: body.brand_logo_url != null ? String(body.brand_logo_url) : undefined,
        isActive: body.is_active != null ? Boolean(body.is_active) : undefined,
        depCommissionRate: body.dep_commission_rate != null ? Number(body.dep_commission_rate) : undefined,
      },
    });
    ok(reply, { site });
  });

  app.post("/upload_site_logo", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;

    const body = request.body as {
      site_id?: number;
      filename?: string;
      content_base64?: string;
    };

    const siteId = Number(body.site_id);
    if (!Number.isFinite(siteId) || siteId <= 0) {
      error(reply, "Geçerli site_id gerekli", 422);
      return;
    }

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      error(reply, "Site bulunamadı", 404);
      return;
    }

    try {
      const logoUrl = await saveSiteLogo(
        siteId,
        String(body.filename ?? "logo.png"),
        String(body.content_base64 ?? ""),
      );
      await prisma.site.update({ where: { id: siteId }, data: { brandLogoUrl: logoUrl } });
      ok(reply, { url: logoUrl });
    } catch (e) {
      error(reply, e instanceof Error ? e.message : "Logo yüklenemedi", 422);
    }
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
    if (deposit.status !== "pending") {
      error(reply, "Yalnızca bekleyen yatırım tutarı değiştirilebilir", 409);
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

  app.get("/logs", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const q = request.query as {
      page?: string;
      limit?: string;
      category?: string;
      user_id?: string;
      q?: string;
    };
    const result = await getActivityLogs({
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 50,
      category: q.category,
      user_id: q.user_id,
      q: q.q,
    });
    ok(reply, result);
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
      let normalized = String(value ?? "");
      if (key === "telegram_support_username") {
        normalized = normalized.trim().replace(/^@+/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 64);
      }
      await prisma.setting.upsert({ where: { key }, update: { value: normalized }, create: { key, value: normalized } });
      await invalidateSettingCache(key);
    }
    ok(reply, {});
  });

  app.get("/cloudflare/status", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;

    try {
      const status = await getCloudflareStatus();
      ok(reply, status as unknown as Record<string, unknown>);
    } catch (err) {
      error(reply, err instanceof Error ? err.message : "Cloudflare status failed", 500);
    }
  });

  app.post("/cloudflare/sync", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;

    if (!isCloudflareConfigured()) {
      error(reply, "Cloudflare yapılandırılmamış (token, origin IP, zone ID)", 400);
      return;
    }

    const body = (request.body ?? {}) as { dns?: boolean; ssl?: boolean };
    try {
      const result = await syncCloudflare({
        dns: body.dns !== false,
        ssl: body.ssl !== false,
      });
      ok(reply, result as unknown as Record<string, unknown>);
    } catch (err) {
      error(reply, err instanceof Error ? err.message : "Cloudflare sync failed", 500);
    }
  });

  app.get("/trusted_ips", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    try {
      const items = await listTrustedIps();
      ok(reply, {
        items,
        fail2ban_file: config.security.fail2banIgnoreFile || null,
      });
    } catch (err) {
      error(reply, err instanceof Error ? err.message : "Liste alınamadı", 500);
    }
  });

  app.post("/add_trusted_ip", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const body = request.body as Record<string, unknown>;
    try {
      const item = await addTrustedIp({
        cidr: String(body.cidr ?? ""),
        label: String(body.label ?? ""),
        category: body.category != null ? String(body.category) : undefined,
        skip_rate_limit: body.skip_rate_limit !== false,
        sync_cloudflare: body.sync_cloudflare !== false,
        note: body.note != null ? String(body.note) : undefined,
      });
      if (body.sync_now === true) {
        await syncTrustedIpIntegrations();
      }
      ok(reply, { item });
    } catch (err) {
      error(reply, err instanceof Error ? err.message : "Eklenemedi", 400);
    }
  });

  app.post("/update_trusted_ip", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const body = request.body as Record<string, unknown>;
    const id = Number(body.id);
    if (!id) {
      error(reply, "id gerekli", 400);
      return;
    }
    try {
      const item = await updateTrustedIp(id, {
        cidr: body.cidr != null ? String(body.cidr) : undefined,
        label: body.label != null ? String(body.label) : undefined,
        category: body.category != null ? String(body.category) : undefined,
        skip_rate_limit: body.skip_rate_limit !== undefined ? Boolean(body.skip_rate_limit) : undefined,
        sync_cloudflare: body.sync_cloudflare !== undefined ? Boolean(body.sync_cloudflare) : undefined,
        is_active: body.is_active !== undefined ? Boolean(body.is_active) : undefined,
        note: body.note !== undefined ? String(body.note) : undefined,
      });
      if (body.sync_now === true) {
        await syncTrustedIpIntegrations();
      }
      ok(reply, { item });
    } catch (err) {
      error(reply, err instanceof Error ? err.message : "Güncellenemedi", 400);
    }
  });

  app.post("/delete_trusted_ip", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    const body = request.body as { id?: number };
    const id = Number(body.id);
    if (!id) {
      error(reply, "id gerekli", 400);
      return;
    }
    try {
      await deleteTrustedIp(id);
      try {
        await exportFail2banIgnoreFile();
      } catch {
        /* optional export */
      }
      ok(reply, {});
    } catch (err) {
      error(reply, err instanceof Error ? err.message : "Silinemedi", 400);
    }
  });

  app.post("/sync_trusted_ips", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;
    try {
      const result = await syncTrustedIpIntegrations();
      ok(reply, result as unknown as Record<string, unknown>);
    } catch (err) {
      error(reply, err instanceof Error ? err.message : "Senkron başarısız", 500);
    }
  });

  app.get("/applications", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;

    const q = request.query as { page?: string; status?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = 20;
    const status = q.status && q.status !== "all" ? q.status : undefined;
    const where = status ? { status: status as "new" | "reviewed" | "archived" } : {};

    const [items, total] = await Promise.all([
      prisma.merchantApplication.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.merchantApplication.count({ where }),
    ]);

    ok(reply, {
      items: items.map((a) => ({
        id: a.id,
        company_name: a.companyName,
        contact_name: a.contactName,
        email: a.email,
        phone: a.phone,
        message: a.message,
        status: a.status,
        ip: a.ip,
        created_at: a.createdAt.toISOString(),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  });

  app.post("/applications/update_status", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;

    const body = request.body as { id?: number; status?: string };
    const id = Number(body.id);
    const status = body.status;
    if (!id || !status || !["new", "reviewed", "archived"].includes(status)) {
      error(reply, "Geçersiz istek", 400);
      return;
    }

    await prisma.merchantApplication.update({
      where: { id },
      data: { status: status as "new" | "reviewed" | "archived" },
    });
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
    const { from, to } = parseReconciliationRange(q);

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

  app.get("/site_reconciliation/export", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;

    const q = request.query as { from?: string; to?: string; site_id?: string };
    const { from, to } = parseReconciliationRange(q);
    const siteId = q.site_id ? Number(q.site_id) : null;

    if (q.site_id && (!siteId || !Number.isFinite(siteId))) {
      error(reply, "Geçersiz site_id", 422);
      return;
    }

    const deposits = await prisma.deposit.findMany({
      where: {
        status: "approved",
        approvedAt: { gte: from, lte: to },
        siteId: siteId ?? { not: null },
      },
      include: { site: { select: { name: true } } },
      orderBy: [{ approvedAt: "asc" }, { id: "asc" }],
    });

    const rows = deposits.map((d) => {
      const amount = Number(d.amount);
      const commission = Number(d.commissionAmount);
      return {
        reference: d.reference,
        siteName: d.site?.name ?? "—",
        userId: d.userId,
        amount,
        commission,
        net: amount - commission,
        status: d.status,
        pspProvider: d.pspProvider,
        externalId: d.externalId,
        createdAt: d.createdAt.toISOString(),
        approvedAt: d.approvedAt?.toISOString() ?? null,
      };
    });

    const fileFrom = q.from ?? from.toISOString().slice(0, 10);
    const fileTo = q.to ?? to.toISOString().slice(0, 10);
    const siteSuffix = siteId ? `-site${siteId}` : "";
    const filename = `site-mutabakat${siteSuffix}-${fileFrom}_${fileTo}.xlsx`;

    const buffer = buildSiteDepositsXlsx(rows);
    reply
      .header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      )
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(buffer);
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

    const enabling = body.enabled === true;

    const method = await prisma.posMethod.upsert({
      where: { provider },
      update: {
        label: body.label != null ? String(body.label) : undefined,
        enabled: body.enabled != null ? Boolean(body.enabled) : undefined,
        minAmount: body.min_amount != null ? Number(body.min_amount) : undefined,
        maxAmount: body.max_amount != null ? Number(body.max_amount) : undefined,
        sortOrder: body.sort_order != null ? Number(body.sort_order) : undefined,
      },
      create: {
        provider,
        label: String(body.label ?? provider),
        enabled: false,
        minAmount: Number(body.min_amount ?? 50),
        maxAmount: Number(body.max_amount ?? 100000),
        sortOrder: Number(body.sort_order ?? 0),
        isDefault: false,
      },
    });

    if (enabling) {
      await activateSinglePosMethod(provider);
    } else if (body.enabled === false) {
      await deactivatePosMethod(provider);
    } else {
      await invalidatePosMethodsCache();
    }

    const saved = await prisma.posMethod.findUnique({ where: { provider } });
    ok(reply, { method: saved ?? method });
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

    if (method.enabled) {
      await deactivatePosMethod(provider);
    } else {
      await activateSinglePosMethod(provider);
    }

    const updated = await prisma.posMethod.findUnique({ where: { provider } });
    ok(reply, { method: updated });
  });

  app.post("/demo_payment_link", async (request, reply) => {
    const user = await requireAuth(request, reply, "admin");
    if (!user) return;

    const body = request.body as Record<string, unknown>;
    const siteId = Number(body.site_id);
    const userId = String(body.user_id ?? "demo_user");
    const userName = String(body.name ?? "Demo Müşteri");
    let amount = body.amount != null ? Number(body.amount) : 0;
    const returnUrl = body.return_url ? String(body.return_url) : `${config.app.baseUrl}/demo`;

    if (!siteId) {
      error(reply, "site_id gerekli", 422);
      return;
    }

    const site = await prisma.site.findFirst({ where: { id: siteId, isActive: true } });
    if (!site) {
      error(reply, "Site bulunamadı veya pasif", 404);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      amount = Number(site.minDeposit);
    }

    if (amount < Number(site.minDeposit)) {
      error(reply, `Minimum yatırım tutarı ${site.minDeposit} TL`, 422);
      return;
    }

    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + PAYMENT_LINK_TTL_MS);

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
      expires_at: formatBcExpiry(expiresAt),
      amount,
      site_name: site.name,
    });
  });
}
