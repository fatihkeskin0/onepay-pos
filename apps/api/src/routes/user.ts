import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { prisma, type Prisma } from "@onepara/db";
import { config } from "../config.js";
import { requireSite } from "../services/site-auth.js";
import { ok, error } from "../services/response.js";
import { createDeposit } from "../services/payment.js";
import { notifyDeposit } from "../services/callback.js";
import {
  getEnabledPosMethodsForSite,
  resolvePosProvider,
  validateAmountForMethod,
} from "../services/pos-methods.js";

async function loadSessionByToken(token: string) {
  return prisma.paymentSession.findFirst({
    where: { token },
    include: { site: true },
  });
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.post("/create_payment_link", async (request, reply) => {
    const site = await requireSite(request, reply);
    if (!site) return;

    const body = request.body as Record<string, unknown>;
    const userId = String(body.user_id ?? "");
    const amount = Number(body.amount ?? 0);
    const userName = String(body.name ?? body.user_name ?? "");
    const returnUrl = String(body.return_url ?? "");
    const externalId = body.transaction_id ? String(body.transaction_id) : null;

    if (!userId) {
      error(reply, "user_id gerekli", 422);
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
        externalId,
      },
    });

    ok(reply, {
      url: `${config.app.paymentUrl}/pay/${token}`,
      token,
      expires_at: expiresAt.toISOString(),
      amount_editable: amount === 0,
    });
  });

  app.get("/pos_methods", async (request, reply) => {
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

    const methods = await getEnabledPosMethodsForSite(Number(session.site.minDeposit));
    const fixedAmount = Number(session.amount);

    ok(reply, {
      session: {
        token: session.token,
        amount: fixedAmount,
        amount_editable: fixedAmount <= 0,
        user_name: session.userName,
        site_name: session.site.name,
        brand: {
          color: session.site.brandColor,
          bg: session.site.brandBgColor,
          logo: session.site.brandLogoUrl,
          name: session.site.name,
        },
      },
      methods,
    });
  });

  app.post("/create_deposit", async (request, reply) => {
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
    let userId = String(body.user_id ?? sessionWithSite.userId);
    let amount = Number(body.amount ?? 0);
    const requestedProvider = body.provider ? String(body.provider) : null;
    const session = sessionWithSite;

    if (session.expiresAt < new Date()) {
      error(reply, "Ödeme süresi doldu", 410);
      return;
    }

    if (session.depositRef && session.depositToken) {
      const existing = await prisma.deposit.findFirst({
        where: { reference: session.depositRef, token: session.depositToken },
        include: { pspTransactions: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      if (existing) {
        const pspTx = existing.pspTransactions[0];
        ok(reply, {
          reference: existing.reference,
          token: existing.token,
          amount: existing.amount,
          redirect_url: pspTx?.redirectUrl ?? null,
          provider: existing.pspProvider,
        });
        return;
      }
    }

    userId = session.userId;
    const sessionAmount = Number(session.amount);
    if (sessionAmount > 0) {
      amount = sessionAmount;
    } else if (amount <= 0) {
      error(reply, "Geçerli tutar girin", 422);
      return;
    }

    const resolved = await resolvePosProvider(requestedProvider, Number(site.minDeposit));
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
      where: { userId, siteId: site.id, status: "pending" },
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

    const pspResult = await provider.createPayment({
      depositId: id,
      reference,
      amount,
      userId,
      userName: session.userName,
      siteName: site.name,
      returnUrl: session.returnUrl || `${config.app.paymentUrl}/pay/${sessionToken}`,
      callbackUrl: `${config.api.publicUrl}/psp/${provider.name}/callback`,
      userIp: request.ip ?? "127.0.0.1",
      email: `${userId}@${site.name.toLowerCase().replace(/[^a-z0-9]/g, "") || "site"}.pay`,
    });

    await prisma.pspTransaction.create({
      data: {
        depositId: id,
        provider: provider.name,
        providerRef: pspResult.providerRef,
        status: "initiated",
        amount,
        redirectUrl: pspResult.redirectUrl ?? null,
        rawResponse: (pspResult.rawResponse ?? undefined) as Prisma.InputJsonValue | undefined,
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
      redirect_url: pspResult.redirectUrl,
      provider: provider.name,
    });
  });

  app.get("/deposit_status", async (request, reply) => {
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
          await prisma.deposit.update({
            where: { id: deposit.id },
            data: { status: "cancelled", rejectReason: "Süre aşımı: ödeme süresi doldu" },
          });
          deposit.status = "cancelled";
        }
      }
    }

    ok(reply, {
      status: deposit.status,
      amount: deposit.amount,
      reference: deposit.reference,
      reject_reason: deposit.rejectReason,
      remaining_seconds: remainingSeconds,
      redirect_url: deposit.pspTransactions[0]?.redirectUrl ?? null,
      provider: deposit.pspProvider,
      brand: deposit.site
        ? {
            color: deposit.site.brandColor,
            bg: deposit.site.brandBgColor,
            logo: deposit.site.brandLogoUrl,
            name: deposit.site.name,
          }
        : null,
    });
  });

  app.post("/cancel_deposit", async (request, reply) => {
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

    if (deposit.status !== "pending") {
      error(reply, "İptal edilemez", 409);
      return;
    }

    await prisma.deposit.update({
      where: { id: deposit.id },
      data: { status: "cancelled", rejectReason: "Kullanıcı iptal etti" },
    });

    ok(reply, { cancelled: true });
  });

  app.get("/history", async (request, reply) => {
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
