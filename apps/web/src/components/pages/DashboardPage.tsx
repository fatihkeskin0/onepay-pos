"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { API } from "@/lib/api";
import { PAGE_HREF } from "@/lib/nav";
import { panelHref } from "@/lib/panel-routes";
import { useClientSession } from "@/hooks/useClientSession";
import { useClientClock } from "@/hooks/useClientClock";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { HourlyTrendChart, WeeklyTrendChart } from "@/components/pages/DashboardCharts";
import {
  DashboardDateFilter,
  formatDashboardRangeLabel,
  todayRange,
  type DashboardDateRange,
} from "@/components/pages/DashboardDateFilter";
import { loadDashboardDateRange, saveDashboardDateRange } from "@/lib/dashboard-date-range";

interface TrendDay {
  date: string;
  count: number;
  amount: number;
}

interface RecentDeposit {
  id: number;
  reference: string;
  amount: string | number;
  status: string;
  site_name: string;
  user_id: string;
  created_at: string;
}

interface HourSlot {
  hour: number;
  count: number;
  amount: number;
}

interface DashboardData {
  selected_from?: string;
  selected_to?: string;
  is_today?: boolean;
  pending_deposits: number;
  approved_today: number;
  amount_today: string | number;
  commission_today: string | number;
  rejected_today: number;
  online_agents?: number;
  trend: TrendDay[];
  recent: RecentDeposit[];
}

interface ServiceHealth {
  ok: boolean;
  ms: number | null;
  uptime_pct: number;
}

interface SystemStatus {
  db: ServiceHealth;
  redis: ServiceHealth;
  api: ServiceHealth;
  window_min: number;
  checked_at: string;
}

const STATUS_BADGE: Record<string, "pending" | "approved" | "rejected" | "cancelled" | "gray"> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  cancelled: "cancelled",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Bekliyor",
  approved: "Onaylı",
  rejected: "Red",
  cancelled: "İptal",
};

function formatMoney(val: string | number | null | undefined) {
  const n = Number(val ?? 0);
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatShortDate(iso: string) {
  return format(parseISO(iso), "d MMM", { locale: tr });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

type StatTone = "amber" | "green" | "blue" | "purple" | "red" | "teal";

interface MetricCard {
  key: string;
  label: string;
  value: string;
  hint?: string;
  tone: StatTone;
  icon: string;
  href?: string;
}

function statusTone(status: string): string {
  return STATUS_BADGE[status] ?? "gray";
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [hours, setHours] = useState<HourSlot[]>([]);
  const [newApplications, setNewApplications] = useState(0);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [dateRange, setDateRange] = useState<DashboardDateRange>(todayRange);
  const [rangeReady, setRangeReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const { ready, username, isAdmin, badges } = useClientSession();
  const pollInFlight = useRef(false);
  const { combinedLabel: clockLabel } = useClientClock();

  useEffect(() => {
    const stored = loadDashboardDateRange();
    if (stored) setDateRange(stored);
    setRangeReady(true);
  }, []);

  const handleDateRangeChange = (range: DashboardDateRange) => {
    setDateRange(range);
    saveDashboardDateRange(range);
  };

  useEffect(() => {
    if (!ready || !rangeReady) return;

    const load = async () => {
      if (pollInFlight.current || document.hidden) return;
      pollInFlight.current = true;
      setLoading(true);
      try {
        const endpoint = isAdmin ? "/admin/dashboard" : "/cashier/stats";
        const dateQuery = `from=${dateRange.from}&to=${dateRange.to}`;
        const [dash, hourly, status] = await Promise.all([
          API.get<DashboardData>(`${endpoint}?${dateQuery}`),
          API.get<{ hours: HourSlot[]; date: string }>(`/cashier/hourly_stats?${dateQuery}`).catch(() => ({
            hours: [],
            date: dateRange.to,
          })),
          API.get<SystemStatus>("/cashier/system_status").catch(() => null),
        ]);
        setData(dash);
        setHours(hourly.hours ?? []);
        setNewApplications(badges["nav-badge-applications"] ?? 0);
        setSystemStatus(status);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
        pollInFlight.current = false;
      }
    };

    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [isAdmin, ready, rangeReady, dateRange, badges]);

  const trend = useMemo(() => data?.trend ?? [], [data?.trend]);
  const trendChartData = useMemo(
    () =>
      trend.map((day) => ({
        label: formatShortDate(day.date),
        amount: Number(day.amount),
        count: day.count,
      })),
    [trend],
  );
  const hourChartData = useMemo(
    () =>
      hours.map((h) => ({
        label: `${String(h.hour).padStart(2, "0")}:00`,
        amount: Number(h.amount),
        count: h.count,
      })),
    [hours],
  );
  const trendTotal = useMemo(() => trend.reduce((sum, d) => sum + Number(d.amount), 0), [trend]);
  const trendCount = useMemo(() => trend.reduce((sum, d) => sum + d.count, 0), [trend]);

  const approvedToday = data?.approved_today ?? 0;
  const amountToday = Number(data?.amount_today ?? 0);
  const avgTicket = approvedToday > 0 ? amountToday / approvedToday : 0;
  const peakHour = useMemo(() => {
    if (!hours.length) return null;
    return hours.reduce((best, h) => (h.amount > best.amount ? h : best), hours[0] ?? null);
  }, [hours]);

  const displayName = ready ? username || "Kullanıcı" : "Kullanıcı";
  const pending = data?.pending_deposits ?? 0;
  const activeFrom = data?.selected_from ?? dateRange.from;
  const activeTo = data?.selected_to ?? dateRange.to;
  const isTodaySelected = data?.is_today ?? (activeFrom === activeTo && activeFrom === todayRange().from);
  const isSingleDay = activeFrom === activeTo;
  const statsScopeLabel = isTodaySelected
    ? "Onay, ciro, komisyon ve red — bugün"
    : isSingleDay
      ? `Onay, ciro, komisyon ve red — ${formatDashboardRangeLabel(activeFrom, activeTo)}`
      : `Onay, ciro, komisyon ve red — ${formatDashboardRangeLabel(activeFrom, activeTo)}`;

  const metrics: MetricCard[] = [
    {
      key: "pending",
      label: "Bekleyen",
      value: loading ? "—" : String(pending),
      hint: "Anlık kuyruk",
      tone: "amber",
      icon: "pending",
      href: PAGE_HREF["adm-dep"] ?? panelHref("deposit"),
    },
    {
      key: "approved",
      label: "Onay",
      value: loading ? "—" : String(approvedToday),
      hint: avgTicket > 0 ? `Ort. ${formatMoney(avgTicket)} ₺` : undefined,
      tone: "green",
      icon: "check",
    },
    {
      key: "amount",
      label: "Ciro",
      value: loading ? "—" : `${formatMoney(data?.amount_today)} ₺`,
      tone: "blue",
      icon: "card",
    },
    {
      key: "commission",
      label: "Komisyon",
      value: loading ? "—" : `${formatMoney(data?.commission_today)} ₺`,
      tone: "purple",
      icon: "chart",
      href: isAdmin ? PAGE_HREF["adm-site-mutabakat"] : undefined,
    },
    {
      key: "rejected",
      label: "Red",
      value: loading ? "—" : String(data?.rejected_today ?? 0),
      tone: "red",
      icon: "x",
    },
    ...(isAdmin
      ? [
          {
            key: "online",
            label: "Agent",
            value: loading ? "—" : String(data?.online_agents ?? 0),
            hint: "Anlık · 5 dk",
            tone: "teal" as StatTone,
            icon: "online",
            href: PAGE_HREF["adm-monitor"],
          },
        ]
      : []),
  ];

  const quickLinks = [
    { href: PAGE_HREF["adm-basvurular"], label: "Başvurular", icon: "users" },
    { href: PAGE_HREF["adm-dep"], label: "Yatırımlar", icon: "card" },
    { href: PAGE_HREF["adm-siteler"], label: "Siteler", icon: "globe" },
    { href: PAGE_HREF["adm-site-mutabakat"], label: "Mutabakat", icon: "receipt" },
    { href: PAGE_HREF["adm-pos"], label: "POS", icon: "bank" },
    { href: PAGE_HREF["adm-raporlar"], label: "Raporlar", icon: "report" },
    { href: PAGE_HREF["adm-guvenlik"] ?? panelHref("security"), label: "Güvenlik", icon: "shield" },
  ];

  const alerts = [
    pending > 0 && !loading
      ? {
          key: "pending",
          href: PAGE_HREF["adm-dep"] ?? panelHref("deposit"),
          tone: "warn" as const,
          icon: "pending",
          text: `${pending} bekleyen yatırım`,
        }
      : null,
    isAdmin && newApplications > 0 && !loading
      ? {
          key: "apps",
          href: PAGE_HREF["adm-basvurular"] ?? panelHref("applications"),
          tone: "info" as const,
          icon: "users",
          text: `${newApplications} yeni başvuru`,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    href: string;
    tone: "warn" | "info";
    icon: string;
    text: string;
  }>;

  return (
    <div className="dash">
      <header className="dash-topbar">
        <div className="dash-topbar-main">
          <div>
            <p className="dash-topbar-eyebrow">{clockLabel || "—"}</p>
            <h1 className="dash-topbar-title">
              Merhaba, <span>{displayName}</span>
            </h1>
          </div>
        </div>
        <div className="dash-topbar-meta">
          <div className="dash-health" title={`Son ${systemStatus?.window_min ?? 30} dk — uptime & latency`}>
            <div className={`dash-health-item${systemStatus?.db.ok === false ? " dash-health-item--down" : ""}`}>
              <span className="dash-health-dot" />
              <span className="dash-health-label">DB</span>
              <span className="dash-health-uptime">
                uptime {systemStatus ? `${systemStatus.db.uptime_pct}%` : "—"}
              </span>
              <span className="dash-health-ms">
                {systemStatus?.db.ms != null ? `${systemStatus.db.ms}ms` : "—"}
              </span>
            </div>
            <div className={`dash-health-item${systemStatus?.redis.ok === false ? " dash-health-item--down" : ""}`}>
              <span className="dash-health-dot" />
              <span className="dash-health-label">Redis</span>
              <span className="dash-health-uptime">
                uptime {systemStatus ? `${systemStatus.redis.uptime_pct}%` : "—"}
              </span>
              <span className="dash-health-ms">
                {systemStatus?.redis.ms != null ? `${systemStatus.redis.ms}ms` : "—"}
              </span>
            </div>
            <div className={`dash-health-item${systemStatus?.api.ok === false ? " dash-health-item--down" : ""}`}>
              <span className="dash-health-dot" />
              <span className="dash-health-label">API</span>
              <span className="dash-health-uptime">
                uptime {systemStatus ? `${systemStatus.api.uptime_pct}%` : "—"}
              </span>
              <span className="dash-health-ms">
                {systemStatus?.api.ms != null ? `${systemStatus.api.ms}ms` : "—"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {alerts.length > 0 ? (
        <div className="dash-alerts">
          {alerts.map((alert) => (
            <Link
              key={alert.key}
              href={alert.href}
              className={`dash-alert dash-alert--${alert.tone}`}
            >
              <Icon name={alert.icon} size={14} />
              <span>{alert.text}</span>
              <span className="dash-alert-arrow">→</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="dash-metrics-wrap">
        <div className="dash-metrics-toolbar">
          <DashboardDateFilter value={dateRange} onChange={handleDateRangeChange} />
          <p className="dash-metrics-scope">{statsScopeLabel}</p>
        </div>

        <div className="dash-metrics">
        {metrics.map((card) => {
          const body = (
            <>
              <span className={`dash-metric-icon dash-metric-icon--${card.tone}`}>
                <Icon name={card.icon} size={15} />
              </span>
              <span className="dash-metric-label">{card.label}</span>
              <span className="dash-metric-value">{card.value}</span>
              {card.hint ? <span className="dash-metric-hint">{card.hint}</span> : null}
            </>
          );
          return card.href ? (
            <Link key={card.key} href={card.href} className={`dash-metric dash-metric--${card.tone}`}>
              {body}
            </Link>
          ) : (
            <div key={card.key} className={`dash-metric dash-metric--${card.tone}`}>
              {body}
            </div>
          );
        })}
        </div>
      </div>

      <div className="dash-analytics">
        <section className="dash-panel">
          <header className="dash-panel-head">
            <div>
              <h2>Trend</h2>
              <p>
                {isSingleDay
                  ? formatDashboardRangeLabel(activeFrom, activeTo)
                  : `${formatShortDate(activeFrom)} – ${formatShortDate(activeTo)}`}
              </p>
            </div>
            <div className="dash-panel-stat">
              <strong>{loading ? "—" : `${formatMoney(trendTotal)} ₺`}</strong>
              <span>{loading ? "" : `${trendCount} işlem`}</span>
            </div>
          </header>
          <div className="dash-chart-panel">
            {loading ? (
              <div className="dash-skeleton dash-skeleton--chart" />
            ) : (
              <WeeklyTrendChart data={trendChartData} />
            )}
          </div>
        </section>

        <section className="dash-panel">
          <header className="dash-panel-head">
            <div>
              <h2>Saatlik</h2>
              <p>
                {isSingleDay
                  ? isTodaySelected
                    ? "Bugün saatlik akış"
                    : `${formatShortDate(activeTo)} saatlik`
                  : `${formatShortDate(activeTo)} günü saatlik`}
              </p>
            </div>
            {peakHour && !loading ? (
              <div className="dash-panel-stat">
                <strong>{String(peakHour.hour).padStart(2, "0")}:00</strong>
                <span>{formatMoney(peakHour.amount)} ₺</span>
              </div>
            ) : null}
          </header>
          <div className="dash-chart-panel dash-chart-panel--compact">
            {loading ? (
              <div className="dash-skeleton dash-skeleton--hourly" />
            ) : (
              <HourlyTrendChart data={hourChartData} />
            )}
          </div>
        </section>
      </div>

      <div className="dash-bottom">
        <section className="dash-panel dash-panel--table">
          <header className="dash-panel-head">
            <div>
              <h2>Son işlemler</h2>
              <p>Son 8 kayıt</p>
            </div>
            <Link href={PAGE_HREF["adm-dep"] ?? panelHref("deposit")} className="dash-link">
              Tümü
            </Link>
          </header>

          <div className="table-wrap dash-table-wrap dash-table-wrap--flush">
            <table className="dash-table dash-table--recent">
              <thead>
                <tr>
                  <th className="dash-table-status-col" aria-label="Durum" />
                  <th>Ref</th>
                  <th>Site</th>
                  <th>Kullanıcı</th>
                  <th className="dash-table-num">Tutar</th>
                  <th>Durum</th>
                  <th className="dash-table-num">Saat</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="table-loading">
                      Yükleniyor…
                    </td>
                  </tr>
                ) : !data?.recent.length ? (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      Henüz işlem yok
                    </td>
                  </tr>
                ) : (
                  data.recent.map((r) => (
                    <tr key={r.id} className={`dash-row dash-row--${statusTone(r.status)}`}>
                      <td className="dash-table-status-col">
                        <span className={`dash-status-dot dash-status-dot--${statusTone(r.status)}`} />
                      </td>
                      <td className="cell-mono">{r.reference}</td>
                      <td>{r.site_name}</td>
                      <td className="cell-muted">{r.user_id}</td>
                      <td className="dash-table-num dash-table-amount">{formatMoney(r.amount)} ₺</td>
                      <td>
                        <Badge variant={STATUS_BADGE[r.status] ?? "gray"}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                      </td>
                      <td className="dash-table-num cell-muted">{formatTime(r.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {isAdmin ? (
          <section className="dash-panel dash-panel--shortcuts">
            <header className="dash-panel-head">
              <div>
                <h2>Kısayollar</h2>
                <p>Modüller</p>
              </div>
            </header>
            <nav className="dash-shortcuts">
              {quickLinks.map((item) => (
                <Link key={item.href} href={item.href ?? "#"} className="dash-shortcut">
                  <Icon name={item.icon} size={15} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </section>
        ) : null}
      </div>
    </div>
  );
}
