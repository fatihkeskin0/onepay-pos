import { prisma } from "@onepara/db";

const MAX_RANGE_DAYS = 62;

export interface DashboardRangeBounds {
  rangeStart: Date;
  rangeEnd: Date;
  from: string;
  to: string;
  isSingleDay: boolean;
  isToday: boolean;
}

export function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDayStart(iso: string): Date {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Geçersiz tarih");
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayEnd(iso: string): Date {
  const d = new Date(`${iso}T00:00:00`);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function resolveDashboardRange(fromStr?: string, toStr?: string, legacyDate?: string): DashboardRangeBounds {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = formatIsoDate(todayStart);

  let fromIso = legacyDate || fromStr || todayIso;
  let toIso = legacyDate || toStr || fromIso;

  if (parseDayStart(fromIso) > todayStart) fromIso = todayIso;
  if (parseDayStart(toIso) > todayStart) toIso = todayIso;
  if (parseDayStart(fromIso) > parseDayStart(toIso)) {
    const swap = fromIso;
    fromIso = toIso;
    toIso = swap;
  }

  let rangeStart = parseDayStart(fromIso);
  let rangeEnd = dayEnd(toIso);

  const maxStart = new Date(rangeEnd);
  maxStart.setHours(0, 0, 0, 0);
  maxStart.setDate(maxStart.getDate() - (MAX_RANGE_DAYS - 1));
  if (rangeStart < maxStart) {
    rangeStart = maxStart;
    fromIso = formatIsoDate(rangeStart);
  }

  const isSingleDay = fromIso === toIso;
  const isToday = isSingleDay && fromIso === todayIso;

  return {
    rangeStart,
    rangeEnd,
    from: fromIso,
    to: toIso,
    isSingleDay,
    isToday,
  };
}

function eachDayInRange(bounds: DashboardRangeBounds): string[] {
  const days: string[] = [];
  const cursor = new Date(bounds.rangeStart);
  const end = parseDayStart(bounds.to);
  while (cursor <= end) {
    days.push(formatIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export async function buildDashboardStats(bounds: DashboardRangeBounds, includeOnlineAgents: boolean) {
  const rangeFilter = { gte: bounds.rangeStart, lte: bounds.rangeEnd };

  const [
    pending,
    approvedRange,
    amountRange,
    commissionRange,
    rejectedRange,
    onlineAgents,
    rangeDeposits,
    recent,
  ] = await Promise.all([
    prisma.deposit.count({ where: { status: "pending" } }),
    prisma.deposit.count({ where: { status: "approved", approvedAt: rangeFilter } }),
    prisma.deposit.aggregate({
      where: { status: "approved", approvedAt: rangeFilter },
      _sum: { amount: true },
    }),
    prisma.deposit.aggregate({
      where: { status: "approved", approvedAt: rangeFilter },
      _sum: { commissionAmount: true },
    }),
    prisma.deposit.count({ where: { status: "rejected", approvedAt: rangeFilter } }),
    includeOnlineAgents
      ? prisma.cashier.count({
          where: {
            role: "kasiyer",
            isActive: true,
            lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
          },
        })
      : Promise.resolve(0),
    prisma.deposit.findMany({
      where: { status: "approved", approvedAt: rangeFilter },
      select: { amount: true, approvedAt: true },
    }),
    prisma.deposit.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { site: { select: { name: true } } },
    }),
  ]);

  const trendMap = new Map<string, { count: number; amount: number }>();
  for (const day of eachDayInRange(bounds)) {
    trendMap.set(day, { count: 0, amount: 0 });
  }
  for (const dep of rangeDeposits) {
    if (!dep.approvedAt) continue;
    const key = formatIsoDate(dep.approvedAt);
    const slot = trendMap.get(key);
    if (slot) {
      slot.count += 1;
      slot.amount += Number(dep.amount);
    }
  }
  const trend = Array.from(trendMap.entries()).map(([date, v]) => ({ date, ...v }));

  return {
    selected_from: bounds.from,
    selected_to: bounds.to,
    is_today: bounds.isToday,
    pending_deposits: pending,
    approved_today: approvedRange,
    amount_today: amountRange._sum.amount ?? 0,
    commission_today: commissionRange._sum.commissionAmount ?? 0,
    rejected_today: rejectedRange,
    online_agents: includeOnlineAgents ? onlineAgents : undefined,
    trend,
    recent: recent.map((d) => ({
      id: d.id,
      reference: d.reference,
      amount: d.amount,
      status: d.status,
      site_name: d.site?.name ?? "—",
      user_id: d.userId,
      created_at: d.createdAt.toISOString(),
    })),
  };
}

export async function buildHourlyStats(bounds: DashboardRangeBounds) {
  const hourlyStart = parseDayStart(bounds.to);
  const hourlyEnd = dayEnd(bounds.to);

  const deposits = await prisma.deposit.findMany({
    where: {
      status: "approved",
      approvedAt: { gte: hourlyStart, lte: hourlyEnd },
    },
    select: { amount: true, approvedAt: true },
  });

  const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0, amount: 0 }));
  for (const d of deposits) {
    if (!d.approvedAt) continue;
    const h = d.approvedAt.getHours();
    const slot = hours[h];
    if (slot) {
      slot.count += 1;
      slot.amount += Number(d.amount);
    }
  }

  return { hours, date: bounds.to };
}

// Backward-compatible single-day helper
export function resolveDashboardDay(dateStr?: string): DashboardRangeBounds {
  return resolveDashboardRange(dateStr, dateStr, dateStr);
}
