"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendChartPoint {
  label: string;
  amount: number;
  count: number;
}

export interface HourChartPoint {
  label: string;
  amount: number;
  count: number;
}

function moneyLabel(value: number): string {
  return `${value.toLocaleString("tr-TR")} ₺`;
}

function WeeklyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const amount = payload.find((p) => p.name === "Tutar")?.value ?? 0;
  const count = payload.find((p) => p.name === "İşlem")?.value ?? 0;
  return (
    <div className="dash-chart-tooltip">
      <strong>{label}</strong>
      <span>{moneyLabel(Number(amount))}</span>
      <span>{count} işlem</span>
    </div>
  );
}

function HourlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const amount = Number(payload[0]?.value ?? 0);
  return (
    <div className="dash-chart-tooltip">
      <strong>{label}</strong>
      <span>{moneyLabel(amount)}</span>
    </div>
  );
}

export function WeeklyTrendChart({ data }: { data: TrendChartPoint[] }) {
  if (!data.length || !data.some((d) => d.amount > 0)) {
    return <p className="dash-empty">Bu dönemde onaylı yatırım yok</p>;
  }

  return (
    <div className="dash-rechart">
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dashAmountGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#2563EB" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="amount"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <YAxis
            yAxisId="count"
            orientation="right"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<WeeklyTooltip />} />
          <Legend
            verticalAlign="top"
            height={28}
            formatter={(value: string) => <span className="dash-chart-legend">{value}</span>}
          />
          <Bar
            yAxisId="amount"
            dataKey="amount"
            name="Tutar"
            fill="url(#dashAmountGrad)"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="count"
            name="İşlem"
            stroke="#16A34A"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#16A34A", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HourlyTrendChart({ data }: { data: HourChartPoint[] }) {
  if (!data.length) {
    return <p className="dash-empty">Saatlik veri yok</p>;
  }

  return (
    <div className="dash-rechart dash-rechart--compact">
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dashHourGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            interval={5}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            width={36}
          />
          <Tooltip content={<HourlyTooltip />} />
          <Area
            type="monotone"
            dataKey="amount"
            fill="url(#dashHourGrad)"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#2563EB" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
