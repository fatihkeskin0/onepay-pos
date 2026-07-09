import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { API_ROUTE_PREFIX } from "@onepara/shared";
import { prisma, type Prisma } from "@onepara/db";
import { config } from "../config.js";
import { requireSite } from "../services/site-auth.js";
import { ok, error } from "../services/response.js";
import { createDeposit, cancelDeposit } from "../services/payment.js";
import { depositCancelled, depositUrl, getSiteCallback, notifyDeposit } from "../services/callback.js";
import { byIp } from "../services/rate-limit.js";
import {
  getActivePosMethodForSite,
  resolvePosProvider,
  validateAmountForMethod,
} from "../services/pos-methods.js";
import { buildPspEmbedPayload, extractPspEmbedFields } from "../services/psp/embed-response.js";
import { formatBcExpiry } from "../services/format.js";

const PAYMENT_LINK_TTL_MS = 15 * 60 * 1000;

async function loadSessionByToken(token: string) {
  return prisma.paymentSession.findFirst({
    where: { token },
    include: { site: true },
  });
}

async function notifySiteCancelled(depositId: number): Promise<void> {
  const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!deposit?.siteId) return;

  const siteCb = await getSiteCallback(deposit.siteId);
  if (!siteCb) return;

  const url = depositUrl(siteCb);
  if (url) {
    await depositCancelled(deposit, siteCb.apiKey, url);
  }
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.post("/create_payment_link", async (request, reply) => {
    if (!(await byIp(request, "create-link", 60, 60, reply))) return;

    const site = await requireSite(request, reply);
    if (!site) return;

    const body = request.body as Record<string, unknown>;
    const userId = String(body.user_id ?? "").trim();
    const amount = Number(body.amount ?? 0);
    const userName = String(body.name ?? body.user_name ?? "").trim();
    const returnUrl = String(body.return_url ?? "").trim();
    const externalId = String(body.transaction_id ?? "").trim();

    if (!userId) {
      error(reply, "user_id gerekli", 400);
      return;
    }

    if (!userName) {
      error(reply, "name gerekli", 400);
      return;
    }

    if (userName.length > 100) {
      error(reply, "name en fazla 100 karakter olabilir", 400);
      return;
    }

    if (!externalId) {
      error(reply, "transaction_id gerekli", 400);
      return;
    }

    if (externalId.length > 128) {
      error(reply, "transaction_id en fazla 128 karakter olabilir", 400);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      error(reply, "Geçerli amount gerekli", 400);
      return;
    }

    if (amount < Number(site.minDeposit)) {
      error(reply, `Minimum yatırım tutarı ${site.minDeposit} TL`, 400);
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
        externalId,
      },
    });

    ok(reply, {
      url: `${config.app.paymentUrl}/pay/${token}`,
      token,
      expires_at: formatBcExpiry(expiresAt),
    });
  });

  app.get("/pos_methods", async (request, reply) => {
    if (!(await byIp(request, "pos-methods", 120, 60, reply))) return;

    const token = String((request.query as { token?: string }).token ?? "");
    if (!token) {
      error(reply, "token gerekli", 422);
      return;
    }

    const session = await loadSessionByToken(token);
    if (!session) {
      error(reply, "Geçersiz oturum", 404);
      return;
    }

    if (session.expiresAt < new Date()) {
      error(reply, "Ödeme süresi doldu", 410);
      return;
    }

    const active = await getActivePosMethodForSite(Number(session.site.minDeposit));
    const fixedAmount = Number(session.amount);

    ok(reply, {
      session: {
        token: session.token,
        amount: fixedAmount,
        user_name: session.userName,
        site_name: session.site.name,
        brand: {
          color: session.site.brandColor,
          bg: session.site.brandBgColor,
          theme: session.site.brandTheme === "dark" ? "dark" : "light",
          logo: session.site.brandLogoUrl,
          name: session.site.name,
        },
      },
      payment_ready: active != null,
      limits: active ? { min: active.min, max: active.max } : null,
    });
  });

  app.post("/create_deposit", async (request, reply) => {
    if (!(await byIp(request, "create-deposit", 30, 60, reply))) return;

    const body = request.body as Record<string, unknown>;
    const sessionToken = body.session_token ? String(body.session_token) : null;

    if (!sessionToken) {
      error(reply, "session_token gerekli", 422);
      return;
    }

    const sessionWithSite = await prisma.paymentSession.findFirst({
      where: { token: sessionToken },
      include: { site: true },
    });

    if (!sessionWithSite || !sessionWithSite.site.isActive) {
      error(reply, "Geçersiz oturum", 404);
      return;
    }

    const site = sessionWithSite.site;
    const session = sessionWithSite;

    if (session.expiresAt < new Date()) {
      error(reply, "Ödeme süresi doldu", 410);
      return;
    }

    const locked = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM payment_sessions WHERE id = ${session.id} FOR UPDATE`;

      const freshSession = await tx.paymentSession.findUnique({ where: { id: session.id } });
      if (!freshSession) return { type: "invalid" as const };

      if (freshSession.depositRef && freshSession.depositToken) {
        const existing = await tx.deposit.findFirst({
          where: { reference: freshSession.depositRef, token: freshSession.depositToken },
          include: { pspTransactions: { orderBy: { createdAt: "desc" }, take: 1 } },
        });

        if (
          existing &&
          existing.status === "pending" &&
          existing.pspTransactions[0]?.status === "initiated"
        ) {
          return { type: "existing" as const, deposit: existing };
        }

        if (existing) {
          await tx.paymentSession.update({
            where: { id: session.id },
            data: { depositRef: null, depositToken: null },
          });
        }
      }

      return { type: "create" as const };
    });

    if (locked.type === "invalid") {
      error(reply, "Geçersiz oturum", 404);
      return;
    }

    if (locked.type === "existing") {
      const pspTx = locked.deposit.pspTransactions[0];
      const embed = extractPspEmbedFields(pspTx);
      ok(reply, {
        reference: locked.deposit.reference,
        token: locked.deposit.token,
        amount: locked.deposit.amount,
        provider: locked.deposit.pspProvider,
        ...embed,
      });
      return;
    }

    const userId = session.userId;
    const amount = Number(session.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      error(reply, "Geçerli tutar girin", 422);
      return;
    }

    const resolved = await resolvePosProvider(null, Number(site.minDeposit));
    if (!resolved) {
      error(reply, "Aktif POS yöntemi bulunamadı", 503);
      return;
    }

    const { method, provider } = resolved;
    if (method) {
      const amountErr = validateAmountForMethod(
        amount,
        Number(method.minAmount),
        Number(method.maxAmount),
        Number(site.minDeposit),
      );
      if (amountErr) {
        error(reply, amountErr, 422);
        return;
      }
    } else if (amount < Number(site.minDeposit)) {
      error(reply, `Minimum yatırım tutarı ${site.minDeposit} TL`, 422);
      return;
    }

    const pending = await prisma.deposit.findFirst({
      where: {
        userId,
        siteId: site.id,
        status: "pending",
        pspTransactions: { some: { status: "initiated" } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (pending) {
      const age = Date.now() - pending.createdAt.getTime();
      if (age < 15 * 60 * 1000) {
        error(reply, "Bekleyen yatırımınız var", 409, {
          remaining_seconds: Math.ceil((15 * 60 * 1000 - age) / 1000),
        });
        return;
      }
    }

    const { id, reference, token: depToken } = await createDeposit(
      userId,
      amount,
      site.id,
      session.externalId,
      provider.name,
    );

    try {
      const pspResult = await provider.createPayment({
        depositId: id,
        reference,
        amount,
        userId,
        userName: session.userName,
        siteName: site.name,
        returnUrl: session.returnUrl || `${config.app.paymentUrl}/pay/${sessionToken}`,
        callbackUrl: `${config.api.publicUrl}${API_ROUTE_PREFIX}/psp/${provider.name}/callback`,
        userIp: request.ip ?? "127.0.0.1",
        email: `${userId}@${site.name.toLowerCase().replace(/[^a-z0-9]/g, "") || "site"}.pay`,
      });

      const embedStore = buildPspEmbedPayload(pspResult);

      await prisma.pspTransaction.create({
        data: {
          depositId: id,
          provider: provider.name,
          providerRef: pspResult.providerRef,
          status: "initiated",
          amount,
          redirectUrl: embedStore.redirectUrl,
          rawResponse: embedStore.rawResponse as Prisma.InputJsonValue,
        },
      });

      await prisma.deposit.update({
        where: { id },
        data: { pspRef: pspResult.providerRef },
      });

      await prisma.paymentSession.update({
        where: { id: session.id },
        data: { depositRef: reference, depositToken: depToken, amount },
      });

      const recentCount = await prisma.deposit.count({
        where: {
          userId,
          siteId: site.id,
          createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        },
      });

      if (recentCount >= 3) {
        await prisma.deposit.update({
          where: { id },
          data: { isSuspicious: true, suspiciousReason: "10 dk içinde 3+ deneme" },
        });
      }

      const deposit = await prisma.deposit.findUnique({ where: { id } });
      if (deposit) await notifyDeposit(deposit, site.name);

      ok(reply, {
        reference,
        token: depToken,
        amount,
        redirect_url: pspResult.redirectUrl ?? null,
        provider: provider.name,
        render_mode: pspResult.renderMode,
        iframe_url: pspResult.iframeUrl ?? null,
        client_secret: pspResult.clientSecret ?? null,
        publishable_key: pspResult.publishableKey ?? null,
      });
    } catch (e) {
      await cancelDeposit(id, "PSP başlatılamadı");
      error(reply, e instanceof Error ? e.message : "PSP hatası", 502);
    }
  });

  app.get("/deposit_status", async (request, reply) => {
    if (!(await byIp(request, "deposit-status", 120, 60, reply))) return;

    const query = request.query as Record<string, string>;
    const ref = query.ref;
    const token = query.token;

    if (!ref || !token) {
      error(reply, "ref ve token gerekli", 422);
      return;
    }

    const deposit = await prisma.deposit.findFirst({
      where: { reference: ref, token },
      include: { site: true, pspTransactions: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (!deposit) {
      error(reply, "Kayıt bulunamadı", 404);
      return;
    }

    let remainingSeconds = 0;
    if (deposit.status === "pending") {
      const session = await prisma.paymentSession.findFirst({
        where: { depositRef: ref, depositToken: token },
      });
      if (session?.expiresAt) {
        remainingSeconds = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
        if (remainingSeconds === 0) {
          const cancelled = await cancelDeposit(deposit.id, "Süre aşımı: ödeme süresi doldu");
          if (cancelled) {
            await notifySiteCancelled(deposit.id);
            deposit.status = "cancelled";
          }
        }
      }
    }

    const pspTx = deposit.pspTransactions[0];
    const embed = extractPspEmbedFields(pspTx);

    ok(reply, {
      status: deposit.status,
      amount: deposit.amount,
      reference: deposit.reference,
      reject_reason: deposit.rejectReason,
      remaining_seconds: remainingSeconds,
      provider: deposit.pspProvider,
      ...embed,
      brand: deposit.site
        ? {
            color: deposit.site.brandColor,
            bg: deposit.site.brandBgColor,
            theme: deposit.site.brandTheme === "dark" ? "dark" : "light",
            logo: deposit.site.brandLogoUrl,
            name: deposit.site.name,
          }
        : null,
    });
  });

  app.post("/cancel_deposit", async (request, reply) => {
    if (!(await byIp(request, "cancel-deposit", 30, 60, reply))) return;

    const body = request.body as Record<string, string>;
    const ref = body.ref;
    const token = body.token;

    if (!ref || !token) {
      error(reply, "ref ve token gerekli", 422);
      return;
    }

    const deposit = await prisma.deposit.findFirst({ where: { reference: ref, token } });
    if (!deposit) {
      error(reply, "Kayıt bulunamadı", 404);
      return;
    }

    const cancelled = await cancelDeposit(deposit.id, "Kullanıcı iptal etti");
    if (!cancelled) {
      error(reply, "İptal edilemez", 409);
      return;
    }

    await notifySiteCancelled(deposit.id);
    ok(reply, { cancelled: true });
  });

  app.get("/history", async (request, reply) => {
    const site = await requireSite(request, reply);
    if (!site) return;

    if (!(await byIp(request, "user-history", 60, 60, reply))) return;

    const query = request.query as Record<string, string>;
    const userId = query.user_id;
    const page = Math.max(1, Number(query.page ?? 1));
    const type = query.type ?? "all";
    const limit = 20;
    const skip = (page - 1) * limit;

    if (!userId) {
      error(reply, "user_id gerekli", 422);
      return;
    }

    const where =
      type === "deposit"
        ? { userId, type: { in: ["deposit", "credit"] } }
        : type === "bet"
          ? { userId, type: { in: ["bet", "debit", "win"] } }
          : { userId };

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    ok(reply, { items, page, total, pages: Math.ceil(total / limit) });
  });
}
