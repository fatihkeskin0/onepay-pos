"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/Modal";
import { StepUpModal } from "@/components/auth/StepUpModal";

interface ProxyPoolEntry {
  id: number;
  label: string;
  host: string;
  port: number;
  protocol: string;
  username: string | null;
  hasPassword: boolean;
  is_active: boolean;
  fail_count: number;
  last_error: string | null;
}

interface ProxyForm {
  label: string;
  host: string;
  port: string;
  protocol: "http" | "https";
  username: string;
  password: string;
}

const emptyForm = (): ProxyForm => ({
  label: "",
  host: "",
  port: "8080",
  protocol: "http",
  username: "",
  password: "",
});

export default function ProxyPoolPage() {
  const { notify } = useToast();
  const [items, setItems] = useState<ProxyPoolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [form, setForm] = useState<ProxyForm>(emptyForm());
  const [stepUp, setStepUp] = useState<{
    title: string;
    run: (totpCode: string) => Promise<void>;
  } | null>(null);
  const [stepUpLoading, setStepUpLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await API.get<{ items: ProxyPoolEntry[] }>("/admin/proxy_pool");
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

  const executeStepUp = async (totpCode: string) => {
    if (!stepUp) return;
    setStepUpLoading(true);
    try {
      await stepUp.run(totpCode);
      setStepUp(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    } finally {
      setStepUpLoading(false);
    }
  };

  const requestAdd = () => {
    setStepUp({
      title: "Proxy ekle",
      run: async (totpCode) => {
        await API.post("/admin/proxy_pool", {
          ...form,
          port: Number(form.port),
          totp_code: totpCode,
        });
        notify("Proxy eklendi", "success");
        setAddOpen(false);
        setForm(emptyForm());
        load();
      },
    });
  };

  const requestImport = () => {
    setStepUp({
      title: "Proxy havuzu import",
      run: async (totpCode) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(importText);
        } catch {
          throw new Error("Geçersiz JSON");
        }
        if (!Array.isArray(parsed)) throw new Error("JSON bir dizi olmalı");
        const result = await API.post<{ created: number; skipped: number }>("/admin/proxy_pool/import", {
          items: parsed,
          totp_code: totpCode,
        });
        notify(`${result.created} eklendi, ${result.skipped} atlandı`, "success");
        setImportOpen(false);
        setImportText("");
        load();
      },
    });
  };

  const requestToggle = (item: ProxyPoolEntry) => {
    setStepUp({
      title: item.is_active ? "Proxy pasifleştir" : "Proxy aktifleştir",
      run: async (totpCode) => {
        await API.put(`/admin/proxy_pool/${item.id}`, {
          is_active: !item.is_active,
          totp_code: totpCode,
        });
        notify("Güncellendi", "success");
        load();
      },
    });
  };

  const requestDelete = (item: ProxyPoolEntry) => {
    if (!window.confirm(`${item.label} silinsin mi?`)) return;
    setStepUp({
      title: "Proxy sil",
      run: async (totpCode) => {
        await API.delete(`/admin/proxy_pool/${item.id}`, { totp_code: totpCode });
        notify("Silindi", "success");
        load();
      },
    });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Proxy Havuzu</div>
          <div className="page-sub">PSP çıkış trafiği için HTTP/HTTPS proxy listesi</div>
        </div>
        <div className="flex-row">
          <button type="button" className="btn btn-ghost" onClick={() => setImportOpen(true)}>
            JSON Import
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
            Proxy Ekle
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Etiket</th>
              <th>Endpoint</th>
              <th>Auth</th>
              <th>Durum</th>
              <th>Hata</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>Yükleniyor…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6}>Kayıt yok</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.label}</td>
                  <td className="cell-mono">
                    {item.protocol}://{item.host}:{item.port}
                  </td>
                  <td>{item.username ? (item.hasPassword ? "Kullanıcı + şifre" : "Kullanıcı") : "—"}</td>
                  <td>
                    <span className={`badge ${item.is_active ? "badge-approved" : "badge-cancelled"}`}>
                      {item.is_active ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="text-xs text-muted">
                    {item.fail_count > 0 ? `${item.fail_count} — ${item.last_error ?? ""}` : "—"}
                  </td>
                  <td className="table-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => requestToggle(item)}>
                      {item.is_active ? "Pasif" : "Aktif"}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => requestDelete(item)}>
                      Sil
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={addOpen}
        title="Proxy Ekle"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)}>
              İptal
            </button>
            <button type="button" className="btn btn-primary" onClick={requestAdd}>
              Kaydet
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Etiket</label>
          <input className="form-input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Host</label>
            <input className="form-input" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Port</label>
            <input className="form-input" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Protokol</label>
          <select className="form-input" value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value as "http" | "https" })}>
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Kullanıcı (opsiyonel)</label>
            <input className="form-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Şifre (opsiyonel)</label>
            <input className="form-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        title="JSON Import"
        onClose={() => setImportOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setImportOpen(false)}>
              İptal
            </button>
            <button type="button" className="btn btn-primary" onClick={requestImport}>
              Import
            </button>
          </>
        }
      >
        <p className="settings-note mb-3">
          Örnek: [{"{"}&quot;label&quot;:&quot;TR-1&quot;,&quot;host&quot;:&quot;1.2.3.4&quot;,&quot;port&quot;:8080{"}"}]
        </p>
        <textarea
          className="form-input"
          rows={8}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder='[{"label":"TR-1","host":"1.2.3.4","port":8080}]'
        />
      </Modal>

      <StepUpModal
        open={stepUp !== null}
        title={stepUp?.title}
        loading={stepUpLoading}
        onClose={() => setStepUp(null)}
        onConfirm={executeStepUp}
      />
    </>
  );
}
