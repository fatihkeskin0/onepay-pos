"use client";

import { useCallback, useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Button } from "@/components/ui/Button";

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

interface SiteOption {
  id: number;
  name: string;
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
  const [siteId, setSiteId] = useState("");
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [rows, setRows] = useState<ReconRow[]>([]);
  const [totals, setTotals] = useState<ReconTotals | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
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
    API.get<{ items: SiteOption[] }>("/admin/sites")
      .then((data) => setSites(data.items))
      .catch(() => {
        /* ignore */
      });
  }, []);

  useEffect(() => {
    if (from && to) load();
  }, [load, from, to]);

  const exportXlsx = async () => {
    if (!from || !to) {
      notify("Tarih aralığı seçin", "error");
      return;
    }

    setExporting(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (siteId) params.set("site_id", siteId);
      const suffix = siteId ? `-site${siteId}` : "";
      await API.download(
        `/admin/site_reconciliation/export?${params.toString()}`,
        `site-mutabakat${suffix}-${from}_${to}.xlsx`,
      );
      notify("XLSX indirildi", "success");
    } catch (e) {
      notify(e instanceof Error ? e.message : "İndirilemedi", "error");
    } finally {
      setExporting(false);
    }
  };

  const filteredRows = siteId
    ? rows.filter((r) => String(r.site_id ?? "") === siteId)
    : rows;

  const filteredTotals = siteId
    ? filteredRows.reduce(
        (acc, r) => ({
          count: acc.count + r.count,
          gross: acc.gross + r.gross,
          commission: acc.commission + r.commission,
          net: acc.net + r.net,
        }),
        { count: 0, gross: 0, commission: 0, net: 0 },
      )
    : totals;

  return (
    <>
      <PageHeader
        title="Site Mutabakatı"
        subtitle="Onaylı yatırımlar — özet tablo ve XLSX işlem dökümü"
      />

      <div className="recon-filters">
        <div className="recon-filters__dates">
          <DateRangePicker
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
          />
        </div>

        <div className="recon-filters__site">
          <label className="recon-filters__site-label" htmlFor="recon-site">
            Site
          </label>
          <select
            id="recon-site"
            className="recon-filters__site-select"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">Tüm siteler</option>
            {sites.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="recon-filters__actions">
          <Button variant="primary" onClick={() => void exportXlsx()} disabled={exporting || !from || !to}>
            {exporting ? "Hazırlanıyor…" : "XLSX İndir"}
          </Button>
        </div>
      </div>

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
            ) : filteredRows.length === 0 ? (
              <tr className="table-empty">
                <td colSpan={5}>Seçili dönemde onaylı yatırım yok</td>
              </tr>
            ) : (
              filteredRows.map((r) => (
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
          {filteredTotals && filteredRows.length > 0 ? (
            <tfoot>
              <tr>
                <td>Toplam</td>
                <td>{filteredTotals.count}</td>
                <td>{formatMoney(filteredTotals.gross)}</td>
                <td>{formatMoney(filteredTotals.commission)}</td>
                <td>{formatMoney(filteredTotals.net)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </>
  );
}
