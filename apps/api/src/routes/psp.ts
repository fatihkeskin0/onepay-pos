import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma, type Prisma } from "@onepara/db";
import {
  getProvider,
  handlePspFailed,
  handlePspPaid,
  isKnownProvider,
} from "../services/psp/index.js";
import { validatePspPaymentAmount } from "../services/psp/validate-amount.js";
import type { PspProviderName } from "@onepara/shared";
import { ok, error } from "../services/response.js";
import { byIp } from "../services/rate-limit.js";

function getRawBody(request: FastifyRequest): string | undefined {
  const raw = (request as FastifyRequest & { rawBody?: string | Buffer }).rawBody;
  if (typeof raw === "string") return raw;
  if (Buffer.isBuffer(raw)) return raw.toString("utf8");
  return undefined;
}

async function resolveDepositId(
  providerName: PspProviderName,
  depositId: number | undefined,
  providerRef: string | undefined,
): Promise<number | null> {
  if (depositId && depositId > 0) return depositId;
  if (!providerRef) return null;

  const pspTx = await prisma.pspTransaction.findFirst({
    where: {
      provider: providerName,
      OR: [{ providerRef }, { deposit: { reference: providerRef } }],
    },
    orderBy: { createdAt: "desc" },
  });

  return pspTx?.depositId ?? null;
}

export async function pspRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { provider: string } }>("/:provider/callback", async (request, reply) => {
    if (!(await byIp(request, "psp-callback", 120, 60, reply))) return;

    const providerName = request.params.provider;

    if (!isKnownProvider(providerName)) {
      error(reply, "Unknown provider", 404);
      return;
    }

    const provider = getProvider(providerName);
    if (!provider) {
      error(reply, "Unknown provider", 404);
      return;
    }

    const rawBody = getRawBody(request);
    const result = await provider.verifyCallback(request.body, request.headers, rawBody);

    if (!result.valid) {
      if (providerName === "paytr") {
        reply.status(400).type("text/plain").send("PAYTR notification failed");
        return;
      }
      error(reply, "Invalid callback", 400);
      return;
    }

    const depositId = await resolveDepositId(providerName, result.depositId, result.providerRef);

    if (!depositId) {
      if (providerName === "paytr") {
        reply.status(404).type("text/plain").send("Deposit not found");
        return;
      }
      error(reply, "Deposit not found", 404);
      return;
    }

    const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
    if (!deposit) {
      error(reply, "Deposit not found", 404);
      return;
    }

    if (deposit.status !== "pending" && result.status === "paid") {
      if (providerName === "paytr") {
        reply.type("text/plain").send("OK");
        return;
      }
      ok(reply, { received: true, skipped: true });
      return;
    }

    if (
      (result.status === "paid" || result.status === "failed") &&
      !validatePspPaymentAmount(Number(deposit.amount), providerName, result)
    ) {
      if (providerName === "paytr") {
        reply.status(400).type("text/plain").send("Amount mismatch");
        return;
      }
      error(reply, "Amount mismatch", 400);
      return;
    }

    const pspTx = await prisma.pspTransaction.findFirst({
      where: { depositId, provider: providerName },
      orderBy: { createdAt: "desc" },
    });

    if (pspTx) {
      await prisma.pspTransaction.update({
        where: { id: pspTx.id },
        data: {
          status: result.status === "paid" ? "paid" : result.status === "failed" ? "failed" : "processing",
          providerRef: result.providerRef ?? pspTx.providerRef,
          rawResponse: (result.rawPayload ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }

    if (result.status === "paid") {
      await handlePspPaid(depositId);
    } else if (result.status === "failed") {
      await handlePspFailed(depositId);
    }

    if (providerName === "paytr") {
      reply.type("text/plain").send("OK");
      return;
    }

    ok(reply, { received: true });
  });
}
