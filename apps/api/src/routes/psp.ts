import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma, type Prisma } from "@onepara/db";
import { getProvider, handlePspPaid } from "../services/psp/index.js";
import type { PspProviderName } from "@onepara/shared";
import { ok, error } from "../services/response.js";

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
    const providerName = request.params.provider as PspProviderName;
    const provider = getProvider(providerName);
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
      await prisma.deposit.updateMany({
        where: { id: depositId, status: "pending" },
        data: { status: "rejected", rejectReason: "PSP ödeme başarısız" },
      });
    }

    if (providerName === "paytr") {
      reply.type("text/plain").send("OK");
      return;
    }

    ok(reply, { received: true });
  });

  app.post("/mock/complete", async (request, reply) => {
    const body = request.body as Record<string, string>;
    const depositId = Number(body.deposit_id);
    const providerRef = body.provider_ref ?? "";

    if (!depositId) {
      error(reply, "deposit_id gerekli", 422);
      return;
    }

    await prisma.pspTransaction.updateMany({
      where: { depositId },
      data: { status: "paid", providerRef },
    });

    await handlePspPaid(depositId);
    ok(reply, { completed: true });
  });
}
