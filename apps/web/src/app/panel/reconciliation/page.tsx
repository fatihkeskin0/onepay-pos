"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/Modal";

interface Settlement {
  id: number;
  provider: string;
  grossAmount: string;
  feeAmount: string;
  netAmount: string;
  matchedCount: number;
  status: string;
  periodStart: string;
  periodEnd: string;
}

export default function ReconciliationPage() {
  const [items, setItems] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const { notify } = useToast();

  const [form, setForm] = useState({
    provider: "stripe",
    period_start: "",
    period_end: "",
    gross_amount: "",
    fee_amount: "",
    net_amount: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await API.get<{ items: Settlement[] }>("/admin/reconciliation");
      setItems(data.items);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitImport = async () => {
    try {
      await API.post("/admin/reconciliation/import", {
        provider: form.provider,
        period_start: form.period_start,
        period_end: form.period_end,
        gross_amount: Number(form.gross_amount),
        fee_amount: Number(form.fee_amount),
        net_amount: Number(form.net_amount),
      });
      notify("Settlement içe aktarıldı", "success");
      setImportOpen(false);
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">PSP Mutabakatı</div>
          <div className="page-sub">Settlement rapor eşleştirme</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setImportOpen(true)}>
          İçe Aktar
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sağlayıcı</th>
              <th>Dönem</th>
              <th>Brüt</th>
              <th>Komisyon</th>
              <th>Net</th>
              <th>Eşleşen</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>Yükleniyor...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7}>Kayıt yok</td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id}>
                  <td>{s.provider}</td>
                  <td className="text-xs">
                    {new Date(s.periodStart).toLocaleDateString("tr-TR")} –{" "}
                    {new Date(s.periodEnd).toLocaleDateString("tr-TR")}
                  </td>
                  <td>{s.grossAmount}</td>
                  <td>{s.feeAmount}</td>
                  <td>{s.netAmount}</td>
                  <td>{s.matchedCount}</td>
                  <td>{s.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={importOpen}
        title="Settlement İçe Aktar"
        onClose={() => setImportOpen(false)}
        wide
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setImportOpen(false)}>
              İptal
            </button>
            <button type="button" className="btn btn-primary" onClick={submitImport}>
              İçe Aktar
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Sağlayıcı</label>
          <select
            className="form-input"
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
          >
            <option value="paytr">PayTR</option>
            <option value="stripe">Stripe</option>
            <option value="sumup">SumUp</option>
          </select>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Dönem Başlangıç</label>
            <input
              className="form-input"
              type="datetime-local"
              value={form.period_start}
              onChange={(e) => setForm({ ...form, period_start: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Dönem Bitiş</label>
            <input
              className="form-input"
              type="datetime-local"
              value={form.period_end}
              onChange={(e) => setForm({ ...form, period_end: e.target.value })}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Brüt Tutar</label>
          <input
            className="form-input"
            type="number"
            value={form.gross_amount}
            onChange={(e) => setForm({ ...form, gross_amount: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Komisyon</label>
          <input
            className="form-input"
            type="number"
            value={form.fee_amount}
            onChange={(e) => setForm({ ...form, fee_amount: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Net Tutar</label>
          <input
            className="form-input"
            type="number"
            value={form.net_amount}
            onChange={(e) => setForm({ ...form, net_amount: e.target.value })}
          />
        </div>
      </Modal>
    </>
  );
}
