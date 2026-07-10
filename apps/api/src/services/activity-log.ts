import { prisma, Prisma } from "@onepara/db";
import type { DepositStatus, PspTransactionStatus } from "@onepara/db";

export type ActivityCategory =
  | "auth"
  | "deposit"
  | "member"
  | "deposit_edit"
  | "psp"
  | "proxy"
  | "security"
  | "pos"
  | "cashier"
  | "site"
  | "settings";

export interface ActivityLogItem {
  id: string;
  category: string;
  action: string;
  title: string;
  userId?: string;
  actor?: string;
  amount?: string;
  status?: string;
  detail?: string;
  ip?: string;
  target?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

const FETCH_LIMIT = 200;

const LEGACY_CATEGORIES = new Set(["auth", "deposit", "member", "deposit_edit", "psp"]);

const CATEGORY_GROUPS: Record<string, string[]> = {
  admin: ["cashier", "site", "settings"],
};

const ACTION_TITLES: Record<string, string> = {
  login: "Panele giriş yapıldı",
  logout: "Panelden çıkış yapıldı",
  created: "Yatırım oluşturuldu",
  approved: "Yatırım onaylandı",
  rejected: "Yatırım reddedildi",
  cancelled: "Yatırım iptal edildi",
  amount_edit: "Yatırım tutarı düzenlendi",
  bet: "Üye bahis işlemi",
  win: "Üye kazanç işlemi",
  credit: "Üye kredi işlemi",
  debit: "Üye borç işlemi",
  rollback: "Üye işlem geri alındı",
  deposit: "Üye yatırım kredisi",
  initiated: "PSP ödeme başlatıldı",
  processing: "PSP ödeme işleniyor",
  succeeded: "PSP ödeme başarılı",
  paid: "PSP ödeme alındı",
  failed: "PSP ödeme başarısız",
  refunded: "PSP iade",
};

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

function legacyTitle(action: string, detail?: string): string {
  const base = ACTION_TITLES[action] ?? action;
  return detail ? `${base} — ${detail}` : base;
}

function mapSystemRow(row: {
  id: bigint;
  category: string;
  action: string;
  title: string;
  actorId: number | null;
  actorUsername: string | null;
  userId: string | null;
  ip: string | null;
  target: string | null;
  payload: unknown;
  createdAt: Date;
}): ActivityLogItem {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : undefined;

  return {
    id: `sys:${row.id.toString()}`,
    category: row.category,
    action: row.action,
    title: row.title,
    actor: row.actorUsername ?? (row.actorId ? String(row.actorId) : undefined),
    userId: row.userId ?? undefined,
    ip: row.ip ?? undefined,
    target: row.target ?? undefined,
    payload,
    createdAt: row.createdAt.toISOString(),
  };
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
      title: legacyTitle("login", log.username),
      actor: log.username,
      detail: log.role,
      ip: log.ip || undefined,
      payload: { role: log.role, username: log.username, cashier_id: log.cashierId },
      createdAt: log.loggedInAt.toISOString(),
    });
    if (log.loggedOutAt) {
      items.push({
        id: `auth:${log.id}:out`,
        category: "auth",
        action: "logout",
        title: legacyTitle("logout", log.username),
        actor: log.username,
        detail: log.role,
        ip: log.ip || undefined,
        payload: { role: log.role, username: log.username, cashier_id: log.cashierId },
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
    const action = DEPOSIT_ACTION[d.status];
    const detail = `${d.reference}${rejectPart}${sitePart}`;
    return {
      id: `deposit:${d.id}`,
      category: "deposit",
      action,
      title: legacyTitle(action, d.reference),
      userId: d.userId,
      actor,
      amount: d.amount.toString(),
      status: d.status,
      detail,
      ip: undefined,
      target: `deposit:${d.id}`,
      payload: {
        deposit_id: d.id,
        reference: d.reference,
        amount: d.amount.toString(),
        status: d.status,
        site: d.site?.name,
        reject_reason: d.rejectReason,
        actor,
      },
      createdAt: createdAt.toISOString(),
    };
  });
}

function mapTransactions(
  rows: Awaited<ReturnType<typeof prisma.transaction.findMany>>,
): ActivityLogItem[] {
  return rows.map((t) => ({
    id: `member:${t.id}`,
    category: "member",
    action: t.type,
    title: legacyTitle(t.type, t.userId),
    userId: t.userId,
    amount: t.amount.toString(),
    status: t.status,
    target: `transaction:${t.id}`,
    payload: {
      transaction_id: t.id,
      type: t.type,
      amount: t.amount.toString(),
      status: t.status,
      user_id: t.userId,
    },
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
    category: "deposit_edit",
    action: "amount_edit",
    title: `Tutar düzenlendi: ${log.deposit.reference}`,
    actor: log.editedBy,
    amount: log.newAmount.toString(),
    detail: `${log.deposit.reference}: ${log.oldAmount} → ${log.newAmount}`,
    target: `deposit:${log.depositId}`,
    payload: {
      deposit_id: log.depositId,
      reference: log.deposit.reference,
      old_amount: log.oldAmount.toString(),
      new_amount: log.newAmount.toString(),
      edited_by: log.editedBy,
    },
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
  return rows.map((pt) => {
    const action = mapPspAction(pt.status);
    return {
      id: `psp:${pt.id}`,
      category: "psp",
      action,
      title: legacyTitle(action, pt.deposit.reference),
      userId: pt.deposit.userId,
      amount: pt.amount.toString(),
      status: pt.status,
      detail: `${pt.provider} — ${pt.deposit.reference}`,
      target: `psp:${pt.id}`,
      payload: {
        psp_id: pt.id,
        provider: pt.provider,
        reference: pt.deposit.reference,
        amount: pt.amount.toString(),
        status: pt.status,
        user_id: pt.deposit.userId,
      },
      createdAt: pt.createdAt.toISOString(),
    };
  });
}

function matchesQuery(item: ActivityLogItem, q: string): boolean {
  const needle = q.toLowerCase();
  const haystack = [
    item.title,
    item.userId,
    item.actor,
    item.detail,
    item.action,
    item.status,
    item.ip,
    item.target,
    item.category,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function matchesUserId(item: ActivityLogItem, userId: string): boolean {
  return item.userId === userId || item.actor === userId;
}

async function fetchSystemLogs(categories: string[] | undefined): Promise<ActivityLogItem[]> {
  const where: Prisma.SystemActivityLogWhereInput = {};
  if (categories?.length) {
    where.category = { in: categories };
  }

  const rows = await prisma.systemActivityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: FETCH_LIMIT,
  });

  return rows.map(mapSystemRow);
}

async function fetchLegacyLogs(cat: string | undefined): Promise<ActivityLogItem[]> {
  const fetches: Promise<ActivityLogItem[]>[] = [];

  if (!cat || cat === "auth") {
    fetches.push(
      prisma.loginLog.findMany({ orderBy: { loggedInAt: "desc" }, take: FETCH_LIMIT }).then(mapLoginLogs),
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
      prisma.transaction.findMany({ orderBy: { createdAt: "desc" }, take: FETCH_LIMIT }).then(mapTransactions),
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

  if (fetches.length === 0) return [];
  const chunks = await Promise.all(fetches);
  return chunks.flat();
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
  const category = params.category?.trim();
  const userId = params.user_id?.trim();
  const q = params.q?.trim();

  let merged: ActivityLogItem[] = [];

  if (!category) {
    const [systemItems, legacyItems] = await Promise.all([
      fetchSystemLogs(undefined),
      fetchLegacyLogs(undefined),
    ]);
    merged = [...systemItems, ...legacyItems];
  } else if (CATEGORY_GROUPS[category]) {
    merged = await fetchSystemLogs(CATEGORY_GROUPS[category]);
  } else if (LEGACY_CATEGORIES.has(category)) {
    const [systemItems, legacyItems] = await Promise.all([
      fetchSystemLogs([category]),
      fetchLegacyLogs(category),
    ]);
    merged = [...systemItems, ...legacyItems];
  } else {
    merged = await fetchSystemLogs([category]);
  }

  if (userId) {
    merged = merged.filter((item) => matchesUserId(item, userId));
  }

  if (q) {
    merged = merged.filter((item) => matchesQuery(item, q));
  }

  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const seen = new Set<string>();
  merged = merged.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  const total = merged.length;
  const start = (page - 1) * limit;
  const items = merged.slice(start, start + limit);

  return { items, total, page, limit };
}
