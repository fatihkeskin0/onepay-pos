import { prisma } from "@onepara/db";
import { creditWithTx, generateRef, generateToken } from "./wallet.js";

export async function createDeposit(
  userId: string,
  amount: number,
  siteId: number,
  externalId?: string | null,
  pspProvider?: string,
): Promise<{ id: number; reference: string; token: string }> {
  const ref = generateRef();
  const token = generateToken();

  const deposit = await prisma.deposit.create({
    data: {
      userId,
      siteId,
      amount,
      method: "card",
      reference: ref,
      token,
      status: "pending",
      externalId: externalId ?? null,
      pspProvider: pspProvider ?? null,
    },
  });

  return { id: deposit.id, reference: ref, token };
}

export async function approveDeposit(
  depositId: number,
  cashierId: number,
): Promise<Awaited<ReturnType<typeof getDeposit>>> {
  const deposit = await getDeposit(depositId);
  if (!deposit || deposit.status !== "pending") return null;

  let commissionRate = 0;
  let commissionAmount = 0;

  if (deposit.siteId) {
    const site = await prisma.site.findUnique({
      where: { id: deposit.siteId },
      select: { depCommissionRate: true },
    });
    if (site) {
      commissionRate = Number(site.depCommissionRate);
      commissionAmount = Math.round(Number(deposit.amount) * commissionRate) / 100;
    }
  }

  const approved = await prisma.$transaction(async (tx) => {
    const updated = await tx.deposit.updateMany({
      where: { id: depositId, status: "pending" },
      data: {
        status: "approved",
        cashierId,
        approvedAt: new Date(),
        commissionRate,
        commissionAmount,
      },
    });

    if (updated.count !== 1) return false;

    const credited = await creditWithTx(
      tx,
      deposit.userId,
      Number(deposit.amount),
      `DEP-${depositId}`,
      "deposit",
    );

    if (!credited) {
      const existing = await tx.transaction.findUnique({ where: { bcTxId: `DEP-${depositId}` } });
      if (!existing) return false;
    }

    return true;
  });

  if (!approved) return null;
  return getDeposit(depositId);
}

export async function rejectDeposit(
  depositId: number,
  cashierId: number,
  reason = "",
): Promise<Awaited<ReturnType<typeof getDeposit>>> {
  const updated = await prisma.deposit.updateMany({
    where: { id: depositId, status: "pending" },
    data: {
      status: "rejected",
      cashierId,
      rejectReason: reason,
      approvedAt: new Date(),
    },
  });

  if (updated.count !== 1) return null;
  return getDeposit(depositId);
}

export async function cancelDeposit(
  depositId: number,
  reason: string,
): Promise<Awaited<ReturnType<typeof getDeposit>>> {
  const updated = await prisma.deposit.updateMany({
    where: { id: depositId, status: "pending" },
    data: {
      status: "cancelled",
      rejectReason: reason,
    },
  });

  if (updated.count !== 1) return null;
  return getDeposit(depositId);
}

export async function getDeposit(id: number) {
  return prisma.deposit.findUnique({
    where: { id },
    include: { site: true, pspTransactions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
}

export async function getDepositByRefToken(ref: string, token: string) {
  return prisma.deposit.findFirst({ where: { reference: ref, token } });
}

export async function autoApproveFromPsp(depositId: number): Promise<Awaited<ReturnType<typeof getDeposit>>> {
  return approveDeposit(depositId, 0);
}
