"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { API } from "@/lib/api";
import { PAGE_HREF } from "@/lib/nav";
import { panelHref } from "@/lib/panel-routes";
import { useClientSession } from "@/hooks/useClientSession";
import { useClientTodayLabel } from "@/hooks/useClientTodayLabel";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";

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
  pending_deposits: number;
  approved_today: number;
  amount_today: string | number;
  commission_today: string | number;
  rejected_today: number;
  online_agents?: number;
  trend: TrendDay[];
  recent: RecentDeposit[];
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
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

type StatIcon = "pending" | "check" | "card" | "chart" | "x" | "online";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [hours, setHours] = useState<HourSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const { ready, username, isAdmin } = useClientSession();
  const todayLabel = useClientTodayLabel();

  useEffect(() => {
    if (!ready) return;
    const load = async () => {
      try {
        const endpoint = isAdmin ? "/admin/dashboard" : "/cashier/stats";
        const [dash, hourly] = await Promise.all([
          API.get<DashboardData>(endpoint),
          API.get<{ hours: HourSlot[] }>("/cashier/hourly_stats").catch(() => ({ hours: [] })),
        ]);
        setData(dash);
        setHours(hourly.hours ?? []);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [isAdmin, ready]);

  const maxTrend = useMemo(() => {
    if (!data?.trend.length) return 1;
    return Math.max(...data.trend.map((t) => t.amount), 1);
  }, [data?.trend]);

  const maxHour = useMemo(() => {
    if (!hours.length) return 1;
    return Math.max(...hours.map((h) => h.amount), 1);
  }, [hours]);

  const displayName = ready ? username || "Kullanıcı" : "Kullanıcı";

  const statCards: {
    key: string;
    label: string;
    value: string | number;
    suffix: string;
    icon: StatIcon;
    tone: string;
    href?: string;
  }[] = [
    {
      key: "pending",
      label: "Bekleyen",
      value: data?.pending_deposits ?? 0,
      suffix: "",
      icon: "pending",
      tone: "dash-stat--amber",
      href: PAGE_HREF["adm-dep"] ?? panelHref("deposit"),
    },
    {
      key: "approved",
      label: "Bugün Onay",
      value: data?.approved_today ?? 0,
      suffix: "",
      icon: "check",
      tone: "dash-stat--green",
    },
    {
      key: "amount",
      label: "Bugün Ciro",
      value: formatMoney(data?.amount_today),
      suffix: " ₺",
      icon: "card",
      tone: "dash-stat--blue",
    },
    {
      key: "commission",
      label: "Bugün Komisyon",
      value: formatMoney(data?.commission_today),
      suffix: " ₺",
      icon: "chart",
      tone: "dash-stat--purple",
      href: isAdmin ? PAGE_HREF["adm-site-mutabakat"] : undefined,
    },
    {
      key: "rejected",
      label: "Bugün Red",
      value: data?.rejected_today ?? 0,
      suffix: "",
      icon: "x",
      tone: "dash-stat--red",
    },
    ...(isAdmin
      ? [
          {
            key: "online",
            label: "Online Agent",
            value: data?.online_agents ?? 0,
            suffix: "",
            icon: "online" as StatIcon,
            tone: "dash-stat--teal",
            href: PAGE_HREF["adm-monitor"],
          },
        ]
      : []),
  ];

  const quickLinks = [
    { href: PAGE_HREF["adm-dep"], label: "Yatırımlar", desc: "Bekleyen ve onaylı", icon: "card" as StatIcon },
    { href: PAGE_HREF["adm-siteler"], label: "Siteler", desc: "Komisyon ve API", icon: "globe" as StatIcon },
    { href: PAGE_HREF["adm-site-mutabakat"], label: "Site Mutabakatı", desc: "Brüt / komisyon / net", icon: "receipt" as StatIcon },
    { href: PAGE_HREF["adm-pos"], label: "POS Ayarları", desc: "PayTR, Stripe, SumUp", icon: "bank" as StatIcon },
    { href: PAGE_HREF["adm-reconciliation"], label: "PSP Mutabakatı", desc: "Settlement eşleştirme", icon: "sync" as StatIcon },
    { href: PAGE_HREF["adm-raporlar"], label: "Raporlar", desc: "Durum özeti", icon: "report" as StatIcon },
  ];

  return (
    <div className="dash">
      <header className="dash-hero">
        <div>
          <p className="dash-greeting">Merhaba, {displayName}</p>
          <h1 className="dash-title">Genel Bakış</h1>
          {todayLabel ? <p className="dash-date">{todayLabel}</p> : <p className="dash-date">&nbsp;</p>}
        </div>
        <div className="dash-live">
          <span className="dash-live-dot" />
          Canlı · 30 sn yenileme
        </div>
      </header>

      <div className="dash-stat-grid">
        {statCards.map((card) => {
          const inner = (
            <>
              <div className={`dash-stat-icon ${card.tone}`}>
                <Icon name={card.icon} size={22} />
              </div>
              <div className="dash-stat-body">
                <div className="dash-stat-label">{card.label}</div>
                <div className="dash-stat-value">
                  {loading ? "—" : `${card.value}${card.suffix}`}
                </div>
              </div>
            </>
          );
          return card.href ? (
            <Link key={card.key} href={card.href} className={`dash-stat ${card.tone}`}>
              {inner}
            </Link>
          ) : (
            <div key={card.key} className={`dash-stat ${card.tone}`}>
              {inner}
            </div>
          );
        })}
      </div>

      <div className="dash-grid">
        <section className="dash-panel dash-panel--wide">
          <div className="dash-panel-head">
            <h2>Son 7 Gün — Onaylı Yatırım</h2>
            <span className="dash-panel-meta">Tutar (₺)</span>
          </div>
          <div className="dash-bars">
            {(data?.trend ?? []).map((day) => {
              const pct = Math.round((day.amount / maxTrend) * 100);
              const label = formatShortDate(day.date);
              const barStyle = { "--bar-fill": `${Math.max(pct, day.amount > 0 ? 4 : 0)}%` } as CSSProperties;
              return (
                <div key={day.date} className="dash-bar-col" title={`${label}: ${formatMoney(day.amount)} ₺ (${day.count} işlem)`}>
                  <div className="dash-bar-track">
                    <div className="dash-bar-fill" style={barStyle} />
                  </div>
                  <span className="dash-bar-label">{label.split(" ")[0]}</span>
                  <span className="dash-bar-count">{day.count}</span>
                </div>
              );
            })}
            {!loading && (!data?.trend.length || data.trend.every((t) => t.amount === 0)) && (
              <p className="dash-empty">Bu dönemde onaylı yatırım yok</p>
            )}
          </div>
        </section>

        <section className="dash-panel">
          <div className="dash-panel-head">
            <h2>Son 24 Saat</h2>
            <span className="dash-panel-meta">Saatlik</span>
          </div>
          <div className="dash-sparkline">
            {hours.map((h) => {
              const pct = Math.round((h.amount / maxHour) * 100);
              const sparkStyle = { "--spark-fill": `${Math.max(pct, h.amount > 0 ? 8 : 2)}%` } as CSSProperties;
              return (
                <div
                  key={h.hour}
                  className="dash-spark-col"
                  title={`${String(h.hour).padStart(2, "0")}:00 — ${formatMoney(h.amount)} ₺`}
                >
                  <div className="dash-spark-bar" style={sparkStyle} />
                </div>
              );
            })}
          </div>
          <div className="dash-spark-labels">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
        </section>
      </div>

      <div className="dash-grid dash-grid--bottom">
        <section className="dash-panel dash-panel--wide">
          <div className="dash-panel-head">
            <h2>Son İşlemler</h2>
            <Link href={PAGE_HREF["adm-dep"] ?? panelHref("deposit")} className="dash-link">
              Tümünü gör →
            </Link>
          </div>
          <div className="table-wrap dash-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Referans</th>
                  <th>Site</th>
                  <th>Kullanıcı</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                  <th>Zaman</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>Yükleniyor...</td>
                  </tr>
                ) : !data?.recent.length ? (
                  <tr>
                    <td colSpan={6}>Henüz işlem yok</td>
                  </tr>
                ) : (
                  data.recent.map((r) => (
                    <tr key={r.id}>
                      <td className="cell-mono">{r.reference}</td>
                      <td>{r.site_name}</td>
                      <td>{r.user_id}</td>
                      <td>{formatMoney(r.amount)} ₺</td>
                      <td>
                        <Badge variant={STATUS_BADGE[r.status] ?? "gray"}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                      </td>
                      <td className="cell-muted">{formatTime(r.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {isAdmin && (
          <section className="dash-panel">
            <div className="dash-panel-head">
              <h2>Hızlı Erişim</h2>
            </div>
            <nav className="dash-quick">
              {quickLinks.map((item) => (
                <Link key={item.href} href={item.href ?? "#"} className="dash-quick-item">
                  <span className="dash-quick-icon">
                    <Icon name={item.icon} size={20} />
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.desc}</small>
                  </span>
                </Link>
              ))}
            </nav>
          </section>
        )}
      </div>
    </div>
  );
}
