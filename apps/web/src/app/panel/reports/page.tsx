"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

interface ReportRow {
  status: string;
  _count: number;
  _sum: { amount: string | number | null };
}

export default function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { notify } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await API.get<{ deposits: ReportRow[] }>("/admin/reports");
        setRows(data.deposits);
      } catch (e) {
        notify(e instanceof Error ? e.message : "Yüklenemedi", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [notify]);

  const formatAmount = (val: string | number | null | undefined) => {
    if (val == null) return "0";
    const n = Number(val);
    return Number.isFinite(n) ? n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) : "0";
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Raporlar</div>
          <div className="page-sub">Yatırım rapor özeti (son 7 gün)</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Durum</th>
              <th>Adet</th>
              <th>Toplam (₺)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3}>Yükleniyor...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3}>Kayıt yok</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.status}>
                  <td>{r.status}</td>
                  <td>{r._count}</td>
                  <td>{formatAmount(r._sum?.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
