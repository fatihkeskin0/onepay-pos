import { prisma } from "@onepara/db";
import type { DepositStatus, PspTransactionStatus } from "@onepara/db";

export type ActivityCategory = "auth" | "deposit" | "member" | "deposit_edit" | "psp" | "proxy";

export interface ActivityLogItem {
  id: string;
  category: ActivityCategory;
  action: string;
  userId?: string;
  actor?: string;
  amount?: string;
  status?: string;
  detail?: string;
  ip?: string;
  createdAt: string;
}

const FETCH_LIMIT = 200;

const DEPOSIT_ACTION: Record<DepositStatus, string> = {
  pending: "created",
  approved: "approved",
  rejected: "rejected",
  cancelled: "cancelled",
};

function mapPspAction(status: PspTransactionStatus): string {
  if (status === "paid") return "succeeded";
  return status;
}

function mapLoginLogs(
  rows: Awaited<ReturnType<typeof prisma.loginLog.findMany>>,
): ActivityLogItem[] {
  const items: ActivityLogItem[] = [];
  for (const log of rows) {
    items.push({
      id: `auth:${log.id}:in`,
      category: "auth",
      action: "login",
      actor: log.username,
      detail: log.role,
      ip: log.ip || undefined,
      createdAt: log.loggedInAt.toISOString(),
    });
    if (log.loggedOutAt) {
      items.push({
        id: `auth:${log.id}:out`,
        category: "auth",
        action: "logout",
        actor: log.username,
        detail: log.role,
        ip: log.ip || undefined,
        createdAt: log.loggedOutAt.toISOString(),
      });
    }
  }
  return items;
}

function mapDeposits(
  rows: Awaited<
    ReturnType<
      typeof prisma.deposit.findMany<{ include: { site: { select: { name: true } } } }>
    >
  >,
): ActivityLogItem[] {
  return rows.map((d) => {
    const createdAt = d.status === "approved" && d.approvedAt ? d.approvedAt : d.createdAt;
    const actor = d.processedByAdminUsername ?? undefined;
    const sitePart = d.site?.name ? ` (${d.site.name})` : "";
    const rejectPart = d.rejectReason ? ` — ${d.rejectReason}` : "";
    return {
      id: `deposit:${d.id}`,
      category: "deposit" as const,
      action: DEPOSIT_ACTION[d.status],
      userId: d.userId,
      actor,
      amount: d.amount.toString(),
      status: d.status,
      detail: `${d.reference}${rejectPart}${sitePart}`,
      createdAt: createdAt.toISOString(),
    };
  });
}

function mapTransactions(
  rows: Awaited<ReturnType<typeof prisma.transaction.findMany>>,
): ActivityLogItem[] {
  return rows.map((t) => ({
    id: `member:${t.id}`,
    category: "member" as const,
    action: t.type,
    userId: t.userId,
    amount: t.amount.toString(),
    status: t.status,
    createdAt: t.createdAt.toISOString(),
  }));
}

function mapDepositEdits(
  rows: Awaited<
    ReturnType<
      typeof prisma.depositEditLog.findMany<{ include: { deposit: { select: { reference: true } } } }>
    >
  >,
): ActivityLogItem[] {
  return rows.map((log) => ({
    id: `deposit_edit:${log.id}`,
    category: "deposit_edit" as const,
    action: "amount_edit",
    actor: log.editedBy,
    amount: log.newAmount.toString(),
    detail: `${log.deposit.reference}: ${log.oldAmount} → ${log.newAmount}`,
    createdAt: log.editedAt.toISOString(),
  }));
}

function mapPspTransactions(
  rows: Awaited<
    ReturnType<
      typeof prisma.pspTransaction.findMany<{ include: { deposit: { select: { reference: true; userId: true } } } }>
    >
  >,
): ActivityLogItem[] {
  return rows.map((pt) => ({
    id: `psp:${pt.id}`,
    category: "psp" as const,
    action: mapPspAction(pt.status),
    userId: pt.deposit.userId,
    amount: pt.amount.toString(),
    status: pt.status,
    detail: `${pt.provider} — ${pt.deposit.reference}`,
    createdAt: pt.createdAt.toISOString(),
  }));
}

function matchesQuery(item: ActivityLogItem, q: string): boolean {
  const needle = q.toLowerCase();
  const haystack = [
    item.userId,
    item.actor,
    item.detail,
    item.action,
    item.status,
    item.ip,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function matchesUserId(item: ActivityLogItem, userId: string): boolean {
  return item.userId === userId || item.actor === userId;
}

export async function getActivityLogs(params: {
  page?: number;
  limit?: number;
  category?: string;
  user_id?: string;
  q?: string;
}): Promise<{ items: ActivityLogItem[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 50));
  const category = params.category?.trim() as ActivityCategory | undefined;
  const userId = params.user_id?.trim();
  const q = params.q?.trim();

  const validCategories: ActivityCategory[] = ["auth", "deposit", "member", "deposit_edit", "psp", "proxy"];
  const cat = category && validCategories.includes(category) ? category : undefined;

  const fetches: Promise<ActivityLogItem[]>[] = [];

  if (!cat || cat === "auth") {
    fetches.push(
      prisma.loginLog
        .findMany({ orderBy: { loggedInAt: "desc" }, take: FETCH_LIMIT })
        .then(mapLoginLogs),
    );
  }

  if (!cat || cat === "deposit") {
    fetches.push(
      prisma.deposit
        .findMany({
          orderBy: { createdAt: "desc" },
          take: FETCH_LIMIT,
          include: { site: { select: { name: true } } },
        })
        .then(mapDeposits),
    );
  }

  if (!cat || cat === "member") {
    fetches.push(
      prisma.transaction
        .findMany({ orderBy: { createdAt: "desc" }, take: FETCH_LIMIT })
        .then(mapTransactions),
    );
  }

  if (!cat || cat === "deposit_edit") {
    fetches.push(
      prisma.depositEditLog
        .findMany({
          orderBy: { editedAt: "desc" },
          take: FETCH_LIMIT,
          include: { deposit: { select: { reference: true } } },
        })
        .then(mapDepositEdits),
    );
  }

  if (!cat || cat === "psp") {
    fetches.push(
      prisma.pspTransaction
        .findMany({
          orderBy: { createdAt: "desc" },
          take: FETCH_LIMIT,
          include: { deposit: { select: { reference: true, userId: true } } },
        })
        .then(mapPspTransactions),
    );
  }

  const chunks = await Promise.all(fetches);
  let merged = chunks.flat();

  if (userId) {
    merged = merged.filter((item) => matchesUserId(item, userId));
  }

  if (q) {
    merged = merged.filter((item) => matchesQuery(item, q));
  }

  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = merged.length;
  const start = (page - 1) * limit;
  const items = merged.slice(start, start + limit);

  return { items, total, page, limit };
}
