import type { FastifyInstance } from "fastify";
import { prisma } from "@onepara/db";
import { verifyBcSignature } from "../services/auth.js";
import { bcOk, bcError } from "../services/response.js";
import { credit, debit, rollback, getOrCreateWallet } from "../services/wallet.js";
import { byIp } from "../services/rate-limit.js";

export async function bcRoutes(app: FastifyInstance): Promise<void> {
  const verify = async (
    request: { body: unknown; headers: Record<string, unknown>; ip?: string },
    reply: Parameters<typeof bcError>[0],
  ): Promise<boolean> => {
    const raw = JSON.stringify(request.body);
    const sig = String(request.headers["x-signature"] ?? "");
    const ipOk = await byIp(request as never, "bc-api", 300, 60, reply as never);
    if (!ipOk) return false;
    if (!verifyBcSignature(raw, sig)) {
      bcError(reply, 1, "Invalid signature");
      return false;
    }
    return true;
  };

  app.post("/balance", async (request, reply) => {
    if (!(await verify(request, reply))) return;
    const body = request.body as { UserId?: string };
    const wallet = await getOrCreateWallet(String(body.UserId ?? ""));
    bcOk(reply, { Balance: Number(wallet.balance), CurrencyId: "TRY" });
  });

  app.post("/credit", async (request, reply) => {
    if (!(await verify(request, reply))) return;
    const body = request.body as { UserId?: string; Amount?: number; TransactionId?: string };
    const ok = await credit(String(body.UserId), Number(body.Amount), String(body.TransactionId), "win");
    if (!ok) {
      bcError(reply, 2, "Duplicate transaction");
      return;
    }
    const wallet = await getOrCreateWallet(String(body.UserId));
    bcOk(reply, { Balance: Number(wallet.balance) });
  });

  app.post("/debit", async (request, reply) => {
    if (!(await verify(request, reply))) return;
    const body = request.body as { UserId?: string; Amount?: number; TransactionId?: string };
    const ok = await debit(String(body.UserId), Number(body.Amount), String(body.TransactionId), "bet");
    if (!ok) {
      bcError(reply, 3, "Insufficient balance");
      return;
    }
    const wallet = await getOrCreateWallet(String(body.UserId));
    bcOk(reply, { Balance: Number(wallet.balance) });
  });

  app.post("/rollback", async (request, reply) => {
    if (!(await verify(request, reply))) return;
    const body = request.body as { TransactionId?: string; UserId?: string };
    const ok = await rollback(String(body.TransactionId));
    if (!ok) {
      bcError(reply, 4, "Transaction not found");
      return;
    }
    const wallet = await getOrCreateWallet(String(body.UserId));
    bcOk(reply, { Balance: Number(wallet.balance) });
  });
}
