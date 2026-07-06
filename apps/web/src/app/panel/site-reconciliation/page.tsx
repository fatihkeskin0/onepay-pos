"use client";

import { useCallback, useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { DateRangePicker } from "@/components/ui/DateRangePicker";

interface ReconRow {
  site_id: number | null;
  site_name: string;
  count: number;
  gross: number;
  commission: number;
  net: number;
}

interface ReconTotals {
  count: number;
  gross: number;
  commission: number;
  net: number;
}

function formatMoney(val: number) {
  return val.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function defaultFromDate() {
  const d = new Date(Date.now() - 30 * 86400000);
  return d.toISOString().slice(0, 10);
}

function defaultToDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function SiteReconciliationPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<ReconRow[]>([]);
  const [totals, setTotals] = useState<ReconTotals | null>(null);
  const [loading, setLoading] = useState(false);
  const { notify } = useToast();

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const data = await API.get<{ rows: ReconRow[]; totals: ReconTotals }>(
        `/admin/site_reconciliation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      setRows(data.rows);
      setTotals(data.totals);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  }, [from, to, notify]);

  useEffect(() => {
    setFrom(defaultFromDate());
    setTo(defaultToDate());
  }, []);

  useEffect(() => {
    if (from && to) load();
  }, [load, from, to]);

  return (
    <>
      <PageHeader
        title="Site Mutabakatı"
        subtitle="Onaylı yatırımlara göre site bazlı komisyon özeti"
      />

      <DateRangePicker
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={load}
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Site</th>
              <th>Onaylı Adet</th>
              <th>Brüt Yatırım (₺)</th>
              <th>Komisyon (₺)</th>
              <th>Net — Site (₺)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="table-loading">
                <td colSpan={5}>Yükleniyor...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr className="table-empty">
                <td colSpan={5}>Seçili dönemde onaylı yatırım yok</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.site_id ?? r.site_name}>
                  <td>{r.site_name}</td>
                  <td>{r.count}</td>
                  <td>{formatMoney(r.gross)}</td>
                  <td>{formatMoney(r.commission)}</td>
                  <td>{formatMoney(r.net)}</td>
                </tr>
              ))
            )}
          </tbody>
          {totals && rows.length > 0 ? (
            <tfoot>
              <tr>
                <td>Toplam</td>
                <td>{totals.count}</td>
                <td>{formatMoney(totals.gross)}</td>
                <td>{formatMoney(totals.commission)}</td>
                <td>{formatMoney(totals.net)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </>
  );
}
