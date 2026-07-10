import type { FastifyInstance } from "fastify";
import { prisma } from "@onepara/db";
import {
  requireAuth,
  requireStepUp,
  hashPassword,
  checkPassword,
  completeLoginSession,
  makePartialToken,
  verifyPartialToken,
  verifyTotp,
  generateSecret,
  getQrDataUrl,
  verifyToken,
  clearSession,
} from "../auth/index.js";
import { ok, error } from "../services/response.js";
import { byIp, getClientIp } from "../services/rate-limit.js";
import { enforcePanelAccess } from "../services/access/enforce.js";
import { approveDeposit, rejectDeposit } from "../services/payment.js";
import { depositApproved, depositRejected, depositUrl, getSiteCallback } from "../services/callback.js";
import { getCashierSiteIds, cashierCanAccessSite } from "../services/cashier-sites.js";
import { recordSystemActivity } from "../services/system-activity.js";
import { collectSystemStatus } from "../services/system-health.js";
import { buildDashboardStats, buildHourlyStats, resolveDashboardRange } from "../services/dashboard-stats.js";

export async function cashierRoutes(app: FastifyInstance): Promise<void> {
  app.post("/login", async (request, reply) => {
    if (!(await byIp(request, "login", 10, 60, reply))) return;
    if (!(await enforcePanelAccess(request, reply))) return;

    const body = request.body as { username?: string; password?: string };
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");

    const cashier = await prisma.cashier.findUnique({ where: { username } });
    if (!cashier?.isActive || !(await checkPassword(password, cashier.passwordHash))) {
      error(reply, "Kullanıcı adı veya şifre hatalı", 401);
      return;
    }

    const partialToken = makePartialToken(cashier.id);

    if (!cashier.totpEnabled) {
      ok(reply, {
        requires_2fa_setup: true,
        partial_token: partialToken,
      });
      return;
    }

    ok(reply, {
      requires_2fa: true,
      partial_token: partialToken,
    });
  });

  app.post("/onboarding/setup", async (request, reply) => {
    if (!(await byIp(request, "onboarding", 10, 60, reply))) return;
    if (!(await enforcePanelAccess(request, reply))) return;

    const partialToken = String((request.body as { partial_token?: string }).partial_token ?? "");
    const cashierId = verifyPartialToken(partialToken);
    if (!cashierId) {
      error(reply, "Oturum süresi doldu", 401);
      return;
    }

    const cashier = await prisma.cashier.findUnique({ where: { id: cashierId } });
    if (!cashier?.isActive) {
      error(reply, "Hesap bulunamadı", 401);
      return;
    }
    if (cashier.totpEnabled) {
      error(reply, "2FA zaten etkin", 409);
      return;
    }

    const secret = generateSecret();
    await prisma.cashier.update({ where: { id: cashier.id }, data: { totpSecret: secret } });
    const qr = await getQrDataUrl(secret, cashier.username);
    ok(reply, { secret, qr });
  });

  app.post("/onboarding/verify", async (request, reply) => {
    if (!(await byIp(request, "onboarding", 10, 60, reply))) return;
    if (!(await enforcePanelAccess(request, reply))) return;

    const body = request.body as { partial_token?: string; code?: string };
    const cashierId = verifyPartialToken(String(body.partial_token ?? ""));
    if (!cashierId) {
      error(reply, "Oturum süresi doldu", 401);
      return;
    }

    const cashier = await prisma.cashier.findUnique({ where: { id: cashierId } });
    if (!cashier?.isActive || !cashier.totpSecret) {
      error(reply, "Kurulum bulunamadı", 401);
      return;
    }
    if (cashier.totpEnabled) {
      error(reply, "2FA zaten etkin", 409);
      return;
    }
    if (!verifyTotp(cashier.totpSecret, String(body.code ?? ""))) {
      error(reply, "Geçersiz kod", 401);
      return;
    }

    await prisma.cashier.update({
      where: { id: cashier.id },
      data: { totpEnabled: true },
    });

    const clientIp = getClientIp(request);
    const session = await completeLoginSession(cashier, clientIp);
    await recordSystemActivity(request, { id: cashier.id, role: cashier.role as "admin" | "kasiyer", exp: 0 }, {
      category: "auth",
      action: "setup_2fa",
      title: `2FA kurulumu tamamlandı: ${cashier.username}`,
      payload: { cashier_id: cashier.id, username: cashier.username, role: cashier.role },
    });
    ok(reply, { ...session });
  });

  app.post("/verify_2fa", async (request, reply) => {
    if (!(await byIp(request, "2fa", 10, 60, reply))) return;
    if (!(await enforcePanelAccess(request, reply))) return;
    const body = request.body as { partial_token?: string; code?: string };
    const cashierId = verifyPartialToken(String(body.partial_token ?? ""));
    if (!cashierId) {
      error(reply, "Oturum süresi doldu", 401);
      return;
    }

    const cashier = await prisma.cashier.findUnique({ where: { id: cashierId } });
    if (!cashier?.isActive || !cashier.totpEnabled || !cashier.totpSecret) {
      error(reply, "2FA kurulumu gerekli", 403, null, "TOTP_REQUIRED");
      return;
    }
    if (!verifyTotp(cashier.totpSecret, String(body.code ?? ""))) {
      error(reply, "Geçersiz kod", 401);
      return;
    }

    const clientIp = getClientIp(request);
    const session = await completeLoginSession(cashier, clientIp);
    await recordSystemActivity(request, { id: cashier.id, role: cashier.role as "admin" | "kasiyer", exp: 0 }, {
      category: "auth",
      action: "login",
      title: `Panele giriş yapıldı: ${cashier.username}`,
      payload: { cashier_id: cashier.id, username: cashier.username, role: cashier.role },
    });
    ok(reply, { ...session });
  });

  app.post("/logout", async (request, reply) => {
    const header = request.headers.authorization ?? "";
    const token = header.replace(/^Bearer\s+/i, "");
    const user = verifyToken(token);
    if (user) {
      await clearSession(user.id);
    }

    const body = request.body as { log_id?: number };
    if (body.log_id) {
      await prisma.loginLog.updateMany({
        where: { id: body.log_id, loggedOutAt: null },
        data: { loggedOutAt: new Date() },
      });
    }
    if (user) {
      const cashier = await prisma.cashier.findUnique({ where: { id: user.id }, select: { username: true, role: true } });
      await recordSystemActivity(request, user, {
        category: "auth",
        action: "logout",
        title: `Panelden çıkış yapıldı: ${cashier?.username ?? user.id}`,
        payload: { cashier_id: user.id, username: cashier?.username, role: cashier?.role ?? user.role },
      });
    }
    ok(reply, {});
  });

  app.get("/badges", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;

    const siteIds = await getCashierSiteIds(user);
    const where: { status: "pending"; siteId?: { in: number[] } } = { status: "pending" };

    if (siteIds !== "all") {
      if (siteIds.length === 0) {
        ok(reply, { pending_deposits: 0 });
        return;
      }
      where.siteId = { in: siteIds };
    }

    const pendingDeposits = await prisma.deposit.count({ where });
    ok(reply, { pending_deposits: pendingDeposits });
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
    if (!user || !(await requireStepUp(request, reply, user.id))) return;

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

    await recordSystemActivity(request, user, {
      category: "deposit",
      action: "approve_deposit",
      title: `Yatırım onaylandı: ${approved.reference}`,
      userId: approved.userId,
      target: `deposit:${approved.id}`,
      payload: {
        deposit_id: approved.id,
        reference: approved.reference,
        amount: approved.amount.toString(),
        user_id: approved.userId,
      },
    });

    ok(reply, { approved: true });
  });

  app.post("/reject_deposit", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user || !(await requireStepUp(request, reply, user.id))) return;

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

    await recordSystemActivity(request, user, {
      category: "deposit",
      action: "reject_deposit",
      title: `Yatırım reddedildi: ${rejected.reference}`,
      userId: rejected.userId,
      target: `deposit:${rejected.id}`,
      payload: {
        deposit_id: rejected.id,
        reference: rejected.reference,
        amount: rejected.amount.toString(),
        user_id: rejected.userId,
        reason: String(body.reason ?? ""),
      },
    });

    ok(reply, { rejected: true });
  });

  app.get("/stats", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;

    try {
      const q = request.query as { from?: string; to?: string; date?: string };
      const bounds = resolveDashboardRange(q.from, q.to, q.date);
      const stats = await buildDashboardStats(bounds, false);
      ok(reply, stats);
    } catch (e) {
      error(reply, e instanceof Error ? e.message : "İstatistikler alınamadı", 400);
    }
  });

  app.get("/hourly_stats", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;

    try {
      const q = request.query as { from?: string; to?: string; date?: string };
      const bounds = resolveDashboardRange(q.from, q.to, q.date);
      const hourly = await buildHourlyStats(bounds);
      ok(reply, hourly);
    } catch (e) {
      error(reply, e instanceof Error ? e.message : "Saatlik veri alınamadı", 400);
    }
  });

  app.get("/system_status", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user) return;

    try {
      const status = await collectSystemStatus();
      ok(reply, status);
    } catch (e) {
      error(reply, e instanceof Error ? e.message : "Sistem durumu alınamadı", 500);
    }
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

  app.post("/change_password", async (request, reply) => {
    const user = await requireAuth(request, reply, "kasiyer", "admin");
    if (!user || !(await byIp(request, "pwd", 5, 300, reply))) return;
    if (!(await requireStepUp(request, reply, user.id))) return;

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
