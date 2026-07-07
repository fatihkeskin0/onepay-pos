import type { FastifyInstance } from "fastify";
import { prisma } from "@onepara/db";
import { verifyBcSignature } from "../services/auth.js";
import { bcOk, bcError } from "../services/response.js";
import { credit, debit, rollback, getOrCreateWallet } from "../services/wallet.js";
import { byIp } from "../services/rate-limit.js";

function parsePositiveAmount(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

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
    const amount = parsePositiveAmount(body.Amount);
    if (!amount) {
      bcError(reply, 5, "Invalid amount");
      return;
    }
    const okResult = await credit(String(body.UserId), amount, String(body.TransactionId), "win");
    if (!okResult) {
      bcError(reply, 2, "Duplicate transaction");
      return;
    }
    const wallet = await getOrCreateWallet(String(body.UserId));
    bcOk(reply, { Balance: Number(wallet.balance) });
  });

  app.post("/debit", async (request, reply) => {
    if (!(await verify(request, reply))) return;
    const body = request.body as { UserId?: string; Amount?: number; TransactionId?: string };
    const amount = parsePositiveAmount(body.Amount);
    if (!amount) {
      bcError(reply, 5, "Invalid amount");
      return;
    }
    const okResult = await debit(String(body.UserId), amount, String(body.TransactionId), "bet");
    if (!okResult) {
      bcError(reply, 3, "Insufficient balance");
      return;
    }
    const wallet = await getOrCreateWallet(String(body.UserId));
    bcOk(reply, { Balance: Number(wallet.balance) });
  });

  app.post("/rollback", async (request, reply) => {
    if (!(await verify(request, reply))) return;
    const body = request.body as { TransactionId?: string; UserId?: string };
    const txId = String(body.TransactionId ?? "");
    const userId = String(body.UserId ?? "");

    const original = await prisma.transaction.findFirst({
      where: { bcTxId: txId, status: "completed" },
    });

    if (!original || original.userId !== userId) {
      bcError(reply, 4, "Transaction not found");
      return;
    }

    const okResult = await rollback(txId);
    if (!okResult) {
      bcError(reply, 4, "Transaction not found");
      return;
    }
    const wallet = await getOrCreateWallet(userId);
    bcOk(reply, { Balance: Number(wallet.balance) });
  });
}
