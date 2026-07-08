import { LS_KEYS } from "@onepara/shared";
import {
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";

export interface DashboardDateRange {
  from: string;
  to: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 62;

function toIsoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  return isValid(parseISO(value));
}

export function normalizeDashboardDateRange(
  from: string,
  to: string,
  today = startOfDay(new Date()),
): DashboardDateRange | null {
  if (!isIsoDate(from) || !isIsoDate(to)) return null;

  let fromDate = startOfDay(parseISO(from));
  let toDate = startOfDay(parseISO(to));

  if (toDate > today) toDate = today;
  if (fromDate > toDate) fromDate = toDate;

  if (differenceInCalendarDays(toDate, fromDate) > MAX_RANGE_DAYS) {
    fromDate = subDays(toDate, MAX_RANGE_DAYS);
  }

  return { from: toIsoDate(fromDate), to: toIsoDate(toDate) };
}

export function loadDashboardDateRange(): DashboardDateRange | null {
  try {
    const raw = localStorage.getItem(LS_KEYS.dashDateRange);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { from?: unknown; to?: unknown };
    if (typeof parsed.from !== "string" || typeof parsed.to !== "string") return null;
    return normalizeDashboardDateRange(parsed.from, parsed.to);
  } catch {
    return null;
  }
}

export function saveDashboardDateRange(range: DashboardDateRange): void {
  try {
    const normalized = normalizeDashboardDateRange(range.from, range.to);
    if (!normalized) return;
    localStorage.setItem(LS_KEYS.dashDateRange, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
}
