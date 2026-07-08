import { prisma } from "@onepara/db";

export interface UserListItem {
  userId: string;
  balance: number;
  currency: string;
  updatedAt: string;
  depositCount: number;
  approvedDepositTotal: number;
  pendingDepositCount: number;
}

export interface UserDepositItem {
  id: number;
  reference: string;
  amount: number;
  status: string;
  siteName: string | null;
  createdAt: string;
  approvedAt: string | null;
}

export interface UserProfileDetail {
  userId: string;
  displayName: string | null;
  balance: number;
  currency: string;
  updatedAt: string;
  depositCount: number;
  approvedDepositTotal: number;
  pendingDepositCount: number;
  totalCredited: number;
  totalDebited: number;
}

export interface PaginatedDeposits {
  items: UserDepositItem[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface UserProfileOptions {
  depositPage?: number;
  depositLimit?: number;
}

const TX_PREVIEW_LIMIT = 5;

function toNumber(val: unknown): number {
  return Number(val ?? 0);
}

function mapDeposit(
  d: {
    id: number;
    reference: string;
    amount: unknown;
    status: string;
    createdAt: Date;
    approvedAt: Date | null;
    site: { name: string } | null;
  },
): UserDepositItem {
  return {
    id: d.id,
    reference: d.reference,
    amount: toNumber(d.amount),
    status: d.status,
    siteName: d.site?.name ?? null,
    createdAt: d.createdAt.toISOString(),
    approvedAt: d.approvedAt?.toISOString() ?? null,
  };
}

export async function listUserProfiles(search: string): Promise<UserListItem[]> {
  const wallets = await prisma.wallet.findMany({
    where: search ? { userId: { contains: search } } : {},
    take: 50,
    orderBy: { updatedAt: "desc" },
  });

  if (wallets.length === 0) return [];

  const userIds = wallets.map((w) => w.userId);

  const [approvedGroups, pendingGroups] = await Promise.all([
    prisma.deposit.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: "approved" },
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.deposit.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: "pending" },
      _count: { id: true },
    }),
  ]);

  const approvedMap = new Map(
    approvedGroups.map((g) => [
      g.userId,
      { count: g._count.id, total: toNumber(g._sum.amount) },
    ]),
  );
  const pendingMap = new Map(pendingGroups.map((g) => [g.userId, g._count.id]));

  return wallets.map((w) => {
    const approved = approvedMap.get(w.userId);
    return {
      userId: w.userId,
      balance: toNumber(w.balance),
      currency: w.currency,
      updatedAt: w.updatedAt.toISOString(),
      depositCount: approved?.count ?? 0,
      approvedDepositTotal: approved?.total ?? 0,
      pendingDepositCount: pendingMap.get(w.userId) ?? 0,
    };
  });
}

export async function getUserProfileDetail(userId: string, options: UserProfileOptions = {}) {
  const depositPage = Math.max(1, options.depositPage ?? 1);
  const depositLimit = Math.min(20, Math.max(1, options.depositLimit ?? 10));
  const depositSkip = (depositPage - 1) * depositLimit;

  const [
    wallet,
    session,
    deposits,
    depositTotal,
    transactions,
    transactionTotal,
    creditAgg,
    debitAgg,
    approvedAgg,
    pendingCount,
    depositCount,
  ] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.paymentSession.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { userName: true },
    }),
    prisma.deposit.findMany({
      where: { userId },
      include: { site: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: depositSkip,
      take: depositLimit,
    }),
    prisma.deposit.count({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: TX_PREVIEW_LIMIT,
    }),
    prisma.transaction.count({ where: { userId } }),
    prisma.transaction.aggregate({
      where: { userId, amount: { gte: 0 } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
    prisma.deposit.aggregate({
      where: { userId, status: "approved" },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.deposit.count({ where: { userId, status: "pending" } }),
    prisma.deposit.count({ where: { userId } }),
  ]);

  const totalCredited = toNumber(creditAgg._sum.amount);
  const totalDebited = Math.abs(toNumber(debitAgg._sum.amount));
  const depositPages = Math.max(1, Math.ceil(depositTotal / depositLimit));

  const profile: UserProfileDetail | null = wallet
    ? {
        userId: wallet.userId,
        displayName: session?.userName?.trim() || null,
        balance: toNumber(wallet.balance),
        currency: wallet.currency,
        updatedAt: wallet.updatedAt.toISOString(),
        depositCount,
        approvedDepositTotal: toNumber(approvedAgg._sum.amount),
        pendingDepositCount: pendingCount,
        totalCredited,
        totalDebited,
      }
    : null;

  const paginatedDeposits: PaginatedDeposits = {
    items: deposits.map(mapDeposit),
    total: depositTotal,
    page: depositPage,
    pages: depositPages,
    limit: depositLimit,
  };

  return {
    profile,
    deposits: paginatedDeposits,
    transactions: {
      items: transactions.map((tx) => ({
        id: Number(tx.id),
        type: tx.type,
        amount: toNumber(tx.amount),
        status: tx.status,
        createdAt: tx.createdAt.toISOString(),
      })),
      total: transactionTotal,
      limit: TX_PREVIEW_LIMIT,
    },
  };
}
