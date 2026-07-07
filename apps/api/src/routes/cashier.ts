import type { FastifyInstance } from "fastify";
import { prisma } from "@onepara/db";
import {
  generateToken,
  requireAuth,
  hashPassword,
  checkPassword,
} from "../services/auth.js";
import { ok, error } from "../services/response.js";
import { byIp } from "../services/rate-limit.js";
import { makePartialToken, verifyPartialToken, verifyTotp, generateSecret, getQrDataUrl } from "../services/totp.js";
import { approveDeposit, rejectDeposit } from "../services/payment.js";
import { depositApproved, depositRejected, depositUrl, getSiteCallback } from "../services/callback.js";
import { getCashierSiteIds, cashierCanAccessSite } from "../services/cashier-sites.js";

export async function cashierRoutes(app: FastifyInstance): Promise<void> {
  app.post("/login", async (request, reply) => {
    if (!(await byIp(request, "login", 10, 60, reply))) return;

    const body = request.body as { username?: string; password?: string };
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");

    const cashier = await prisma.cashier.findUnique({ where: { username } });
    if (!cashier?.isActive || !(await checkPassword(password, cashier.passwordHash))) {
      error(reply, "Kullanıcı adı veya şifre hatalı", 401);
      return;
    }

    if (cashier.totpEnabled && cashier.totpSecret) {
      ok(reply, {
        requires_2fa: true,
        partial_token: makePartialToken(cashier.id),
      });
      return;
    }

    const log = await prisma.loginLog.create({
      data: {
        cashierId: cashier.id,
        username: cashier.username,
        role: cashier.role,
        ip: request.ip ?? "",
      },
    });

    await prisma.cashier.update({
      where: { id: cashier.id },
      data: { lastLogin: new Date() },
    });

    ok(reply, {
      token: generateToken(cashier.id, cashier.role, cashier.siteId, cashier.tokenVersion),
      role: cashier.role,
      username: cashier.username,
      theme: cashier.theme,
      log_id: log.id,
    });
  });

  app.post("/verify_2fa", async (request, reply) => {
    if (!(await byIp(request, "2fa", 10, 60, reply))) return;
    const body = request.body as { partial_token?: string; code?: string };
    const cashierId = verifyPartialToken(String(body.partial_token ?? ""));
    if (!cashierId) {
      error(reply, "Oturum süresi doldu", 401);
      return;
    }

    const cashier = await prisma.cashier.findUnique({ where: { id: cashierId } });
    if (!cashier?.totpSecret || !verifyTotp(cashier.totpSecret, String(body.code ?? ""))) {
      error(reply, "Geçersiz kod", 401);
      return;
    }

    const log = await prisma.loginLog.create({
      data: { cashierId: cashier.id, username: cashier.username, role: cashier.role, ip: request.ip ?? "" },
    });

    ok(reply, {
      token: generateToken(cashier.id, cashier.role, cashier.siteId, cashier.tokenVersion),
      role: cashier.role,
      username: cashier.username,
      theme: cashier.theme,
      log_id: log.id,
    });
  });

  app.post("/logout", async (request, reply) => {
    const body = request.body as { log_id?: number };
    if (body.log_id) {
      await prisma.loginLog.updateMany({
        where: { id: body.log_id, loggedOutAt: null },
        data: { loggedOutAt: new Date() },
      });
    }
    ok(reply, {});
  });

  app.get("/deposits", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;

    const q = request.query as Record<string, string>;
    const status = q.status ?? "pending";
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = 20;

    const where: Record<string, unknown> = {};
    if (status !== "all") where.status = status;
    if (q.from) where.createdAt = { ...(where.createdAt as object), gte: new Date(q.from) };
    if (q.to) where.createdAt = { ...(where.createdAt as object), lte: new Date(q.to) };
    if (q.q) where.OR = [{ reference: { contains: q.q } }, { userId: { contains: q.q } }];

    const siteIds = await getCashierSiteIds(user);
    if (siteIds !== "all") {
      if (siteIds.length === 0) {
        ok(reply, { items: [], total: 0, page, pages: 0 });
        return;
      }
      where.siteId = { in: siteIds };
    }

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

    ok(reply, { items, total, page, pages: Math.ceil(total / limit) });
  });

  app.post("/approve_deposit", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;

    const body = request.body as { id?: number };
    const depositId = Number(body.id);

    const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
    if (!deposit || !(await cashierCanAccessSite(user, deposit.siteId))) {
      error(reply, "Yetkisiz", 403);
      return;
    }

    const approved = await approveDeposit(depositId, user.id);
    if (!approved) {
      error(reply, "Onaylanamadı", 409);
      return;
    }

    if (approved.siteId) {
      const siteCb = await getSiteCallback(approved.siteId);
      if (siteCb) {
        const url = depositUrl(siteCb);
        if (url) await depositApproved(approved, siteCb.apiKey, url);
      }
    }

    ok(reply, { approved: true });
  });

  app.post("/reject_deposit", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;

    const body = request.body as { id?: number; reason?: string };
    const depositId = Number(body.id);

    const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
    if (!deposit || !(await cashierCanAccessSite(user, deposit.siteId))) {
      error(reply, "Yetkisiz", 403);
      return;
    }

    const rejected = await rejectDeposit(depositId, user.id, String(body.reason ?? ""));
    if (!rejected) {
      error(reply, "Reddedilemedi", 409);
      return;
    }

    if (rejected.siteId) {
      const siteCb = await getSiteCallback(rejected.siteId);
      if (siteCb) {
        const url = depositUrl(siteCb);
        if (url) await depositRejected(rejected, siteCb.apiKey, url);
      }
    }

    ok(reply, { rejected: true });
  });

  app.get("/stats", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);

    const [pending, approvedToday, totalToday, commissionToday, rejectedToday, weekDeposits, recent] =
      await Promise.all([
        prisma.deposit.count({ where: { status: "pending" } }),
        prisma.deposit.count({ where: { status: "approved", approvedAt: { gte: today } } }),
        prisma.deposit.aggregate({
          where: { status: "approved", approvedAt: { gte: today } },
          _sum: { amount: true },
        }),
        prisma.deposit.aggregate({
          where: { status: "approved", approvedAt: { gte: today } },
          _sum: { commissionAmount: true },
        }),
        prisma.deposit.count({ where: { status: "rejected", approvedAt: { gte: today } } }),
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
      amount_today: totalToday._sum.amount ?? 0,
      commission_today: commissionToday._sum.commissionAmount ?? 0,
      rejected_today: rejectedToday,
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

  app.get("/hourly_stats", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;

    const deposits = await prisma.deposit.findMany({
      where: { status: "approved", approvedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      select: { amount: true, approvedAt: true },
    });

    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0, amount: 0 }));
    for (const d of deposits) {
      if (!d.approvedAt) continue;
      const h = d.approvedAt.getHours();
      const slot = hours[h];
      if (slot) {
        slot.count += 1;
        slot.amount += Number(d.amount);
      }
    }

    ok(reply, { hours });
  });

  app.get("/commission_chart", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;
    ok(reply, { labels: [], values: [] });
  });

  app.get("/poll", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;

    const since = Number((request.query as { since?: string }).since ?? 0);
    const sinceDate = since ? new Date(since * 1000) : new Date(Date.now() - 60_000);

    const newDeps = await prisma.deposit.findMany({
      where: { createdAt: { gt: sinceDate }, status: "pending" },
      take: 10,
    });

    ok(reply, {
      new_deposits: newDeps,
      server_time: Math.floor(Date.now() / 1000),
    });
  });

  app.get("/profile", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;

    const cashier = await prisma.cashier.findUnique({ where: { id: user.id } });
    ok(reply, { cashier });
  });

  app.post("/save_theme", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;
    const theme = String((request.body as { theme?: string }).theme ?? "light");
    await prisma.cashier.update({ where: { id: user.id }, data: { theme } });
    ok(reply, { theme });
  });

  app.get("/get_2fa_status", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;
    const c = await prisma.cashier.findUnique({ where: { id: user.id } });
    ok(reply, { enabled: c?.totpEnabled ?? false });
  });

  app.post("/setup_2fa", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;
    const c = await prisma.cashier.findUnique({ where: { id: user.id } });
    if (!c) return;
    const secret = generateSecret();
    await prisma.cashier.update({ where: { id: c.id }, data: { totpSecret: secret } });
    const qr = await getQrDataUrl(secret, c.username);
    ok(reply, { secret, qr });
  });

  app.post("/enable_2fa", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;
    const code = String((request.body as { code?: string }).code ?? "");
    const c = await prisma.cashier.findUnique({ where: { id: user.id } });
    if (!c?.totpSecret || !verifyTotp(c.totpSecret, code)) {
      error(reply, "Geçersiz kod", 422);
      return;
    }
    await prisma.cashier.update({ where: { id: c.id }, data: { totpEnabled: true } });
    ok(reply, { enabled: true });
  });

  app.post("/disable_2fa", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;
    const password = String((request.body as { password?: string }).password ?? "");
    const c = await prisma.cashier.findUnique({ where: { id: user.id } });
    if (!c || !(await checkPassword(password, c.passwordHash))) {
      error(reply, "Şifre hatalı", 401);
      return;
    }
    await prisma.cashier.update({
      where: { id: c.id },
      data: { totpEnabled: false, totpSecret: null },
    });
    ok(reply, { enabled: false });
  });

  app.post("/change_password", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user || !(await byIp(request, "pwd", 5, 300, reply))) return;

    const body = request.body as { old_password?: string; new_password?: string };
    const c = await prisma.cashier.findUnique({ where: { id: user.id } });
    if (!c || !(await checkPassword(String(body.old_password), c.passwordHash))) {
      error(reply, "Mevcut şifre hatalı", 401);
      return;
    }
    await prisma.cashier.update({
      where: { id: c.id },
      data: { passwordHash: await hashPassword(String(body.new_password)) },
    });
    ok(reply, {});
  });

  app.get("/announcements", async (request, reply) => {
    await requireAuth(request, reply, "kasiyer", "admin");
    const items = await prisma.announcement.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } });
    ok(reply, { items });
  });
}
