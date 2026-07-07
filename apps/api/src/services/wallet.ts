import { randomBytes } from "node:crypto";
import type { Prisma } from "@onepara/db";
import { prisma } from "@onepara/db";

export async function getWallet(userId: string) {
  return prisma.wallet.findUnique({ where: { userId } });
}

export async function getOrCreateWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: {},
  });
}

async function txExists(txId: string): Promise<boolean> {
  const tx = await prisma.transaction.findUnique({ where: { bcTxId: txId } });
  return !!tx;
}

export async function creditWithTx(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  txId: string,
  type = "credit",
): Promise<boolean> {
  const existing = await tx.transaction.findUnique({ where: { bcTxId: txId } });
  if (existing) return false;

  await tx.wallet.upsert({
    where: { userId },
    create: { userId, balance: amount },
    update: { balance: { increment: amount } },
  });

  await tx.transaction.create({
    data: { userId, type, amount, bcTxId: txId, status: "completed" },
  });

  return true;
}

export async function credit(
  userId: string,
  amount: number,
  txId: string,
  type = "credit",
): Promise<boolean> {
  if (await txExists(txId)) return false;

  await getOrCreateWallet(userId);

  return prisma.$transaction(async (tx) => creditWithTx(tx, userId, amount, txId, type));
}

export async function debit(
  userId: string,
  amount: number,
  txId: string,
  type = "debit",
): Promise<boolean> {
  if (await txExists(txId)) return false;

  const wallet = await getWallet(userId);
  if (!wallet || Number(wallet.balance) < amount) return false;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.wallet.updateMany({
      where: { userId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (updated.count === 0) return false;
    await tx.transaction.create({
      data: { userId, type, amount: -amount, bcTxId: txId, status: "completed" },
    });
    return true;
  });

  return result;
}

export async function rollback(txId: string): Promise<boolean> {
  const tx = await prisma.transaction.findFirst({
    where: { bcTxId: txId, status: "completed" },
  });
  if (!tx) return false;

  const reversal = -Number(tx.amount);

  await prisma.$transaction(async (db) => {
    await db.wallet.update({
      where: { userId: tx.userId },
      data: { balance: { increment: reversal } },
    });
    await db.transaction.update({
      where: { id: tx.id },
      data: { status: "rolled_back" },
    });
    await db.transaction.create({
      data: {
        userId: tx.userId,
        type: "rollback",
        amount: reversal,
        bcTxId: `RB-${txId}`,
        status: "completed",
      },
    });
  });

  return true;
}

export function generateRef(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const dateStr =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return dateStr + rand;
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}
