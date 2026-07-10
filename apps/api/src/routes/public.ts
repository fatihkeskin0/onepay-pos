import type { FastifyInstance } from "fastify";
import { prisma } from "@onepara/db";
import { ok, error } from "../services/response.js";
import { byIp, getClientIp } from "../services/rate-limit.js";
import { getSetting } from "../services/callback.js";
import { isValidTelegramUsername, normalizeTelegramUsername } from "../services/telegram-username.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get("/landing-info", async (_request, reply) => {
    const username = normalizeTelegramUsername(await getSetting("telegram_support_username"));
    ok(reply, {
      telegram_support_username: username || null,
      telegram_url: username ? `https://t.me/${username}` : null,
    });
  });

  app.post("/apply", async (request, reply) => {
    if (!(await byIp(request, "apply", 5, 3600, reply))) return;

    const body = request.body as {
      company_name?: string;
      contact_name?: string;
      email?: string;
      telegram_username?: string;
      message?: string;
    };

    const companyName = String(body.company_name ?? "").trim().slice(0, 200);
    const contactName = String(body.contact_name ?? "").trim().slice(0, 120);
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
    const telegramUsername = normalizeTelegramUsername(body.telegram_username);
    const message = String(body.message ?? "").trim().slice(0, 2000) || null;

    if (!companyName || !contactName || !email || !telegramUsername) {
      error(reply, "Lütfen zorunlu alanları doldurun", 400);
      return;
    }

    if (!EMAIL_RE.test(email)) {
      error(reply, "Geçerli bir e-posta adresi girin", 400);
      return;
    }

    if (!isValidTelegramUsername(telegramUsername)) {
      error(reply, "Geçerli bir Telegram kullanıcı adı girin", 400);
      return;
    }

    const ip = getClientIp(request);

    await prisma.merchantApplication.create({
      data: {
        companyName,
        contactName,
        email,
        telegramUsername,
        message,
        ip,
      },
    });

    ok(reply, { submitted: true });
  });
}
