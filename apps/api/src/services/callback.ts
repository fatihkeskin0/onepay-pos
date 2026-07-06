import { createHmac } from "node:crypto";
import { prisma } from "@onepara/db";
import { config } from "../config.js";

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function fireCallback(
  url: string,
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!url) return;

  try {
    new URL(url);
  } catch {
    return;
  }

  const unixTime = Math.floor(Date.now() / 1000);
  const amount = Number(payload.Amount ?? 0).toFixed(2);

  const canonical =
    String(payload.TraderKey ?? "") +
    String(payload.TransactionID ?? "") +
    String(payload.UserCode ?? "") +
    amount +
    String(payload.StatusCode ?? "") +
    String(unixTime);

  const fullPayload = {
    ...payload,
    Amount: amount,
    UnixTime: unixTime,
    CheckSum: createHmac("sha256", apiKey).update(canonical).digest("hex").toLowerCase(),
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(fullPayload),
      signal: AbortSignal.timeout(10_000),
    });
    console.log(`[Callback] url=${url} http=${res.status} payload=${JSON.stringify(fullPayload)}`);
  } catch (e) {
    console.error("[Callback] Exception:", e);
  }
}

export async function depositApproved(
  deposit: { id: number; userId: string; amount: { toString(): string }; externalId?: string | null },
  apiKey: string,
  callbackUrl: string,
): Promise<void> {
  await fireCallback(callbackUrl, apiKey, {
    TraderKey: apiKey,
    TransactionID: deposit.id,
    UserCode: deposit.userId,
    Amount: deposit.amount,
    StatusCode: 1,
    StatusMessage: "Yatırım talebiniz onaylandı.",
    CustomField: deposit.externalId ?? "",
  });
}

export async function depositRejected(
  deposit: {
    id: number;
    userId: string;
    amount: { toString(): string };
    externalId?: string | null;
    rejectReason?: string | null;
  },
  apiKey: string,
  callbackUrl: string,
): Promise<void> {
  await fireCallback(callbackUrl, apiKey, {
    TraderKey: apiKey,
    TransactionID: deposit.id,
    UserCode: deposit.userId,
    Amount: deposit.amount,
    StatusCode: 2,
    StatusMessage: deposit.rejectReason || "Yatırım talebi reddedildi.",
    CustomField: deposit.externalId ?? "",
  });
}

export function depositUrl(site: {
  callbackUrlDeposit?: string | null;
  callbackUrl?: string | null;
}): string {
  return site.callbackUrlDeposit ?? site.callbackUrl ?? "";
}

export async function getSiteCallback(siteId: number) {
  return prisma.site.findUnique({
    where: { id: siteId },
    select: {
      apiKey: true,
      callbackUrl: true,
      callbackUrlDeposit: true,
      callbackUrlWithdrawal: true,
    },
  });
}

export async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token =
    (await getSetting("telegram_bot_token")) || config.telegram.botToken;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (e) {
    console.error("[Telegram]", e);
  }
}

export async function notifyDeposit(
  deposit: { reference: string; amount: { toString(): string }; userId: string },
  siteName: string,
): Promise<void> {
  const enabled = await getSetting("telegram_notify_deposit");
  if (enabled === "0") return;

  const admins = await prisma.cashier.findMany({
    where: { role: "admin", isActive: true, telegramChatId: { not: null } },
  });

  const text = `💳 <b>Yeni KK Yatırım</b>\nSite: ${siteName}\nRef: ${deposit.reference}\nTutar: ${deposit.amount} TL\nUser: ${deposit.userId}`;

  for (const admin of admins) {
    if (admin.telegramChatId) await sendTelegram(admin.telegramChatId, text);
  }
}
