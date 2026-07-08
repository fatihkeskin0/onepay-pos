"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/Modal";

interface TrustedIp {
  id: number;
  cidr: string;
  label: string;
  category: string;
  skip_rate_limit: boolean;
  sync_cloudflare: boolean;
  is_active: boolean;
  note: string | null;
}

interface IpForm {
  cidr: string;
  label: string;
  category: string;
  skip_rate_limit: boolean;
  sync_cloudflare: boolean;
  note: string;
}

const emptyForm = (): IpForm => ({
  cidr: "",
  label: "",
  category: "betconstruct",
  skip_rate_limit: true,
  sync_cloudflare: true,
  note: "",
});

export default function SecurityPage() {
  const { notify } = useToast();
  const [items, setItems] = useState<TrustedIp[]>([]);
  const [fail2banFile, setFail2banFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<IpForm>(emptyForm());

  const load = async () => {
    setLoading(true);
    try {
      const data = await API.get<{ items: TrustedIp[]; fail2ban_file: string | null }>("/admin/trusted_ips");
      setItems(data.items);
      setFail2banFile(data.fail2ban_file);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitAdd = async () => {
    try {
      await API.post("/admin/add_trusted_ip", { ...form, sync_now: true });
      notify("IP eklendi ve senkron edildi", "success");
      setAddOpen(false);
      setForm(emptyForm());
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Eklenemedi", "error");
    }
  };

  const toggleActive = async (item: TrustedIp) => {
    try {
      await API.post("/admin/update_trusted_ip", {
        id: item.id,
        is_active: !item.is_active,
        sync_now: true,
      });
      notify(item.is_active ? "IP pasifleştirildi" : "IP aktifleştirildi", "success");
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Güncellenemedi", "error");
    }
  };

  const removeIp = async (item: TrustedIp) => {
    if (!window.confirm(`${item.cidr} silinsin mi?`)) return;
    try {
      await API.post("/admin/delete_trusted_ip", { id: item.id });
      notify("IP silindi", "success");
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Silinemedi", "error");
    }
  };

  const syncAll = async () => {
    setSyncing(true);
    try {
      const result = await API.post<{
        cloudflare: { synced: number; errors: string[] };
        fail2ban: { path: string | null; count: number; error: string | null };
      }>("/admin/sync_trusted_ips", {});
      const parts = [`Cloudflare: ${result.cloudflare.synced} kural`];
      if (result.fail2ban.path) parts.push(`fail2ban dosyası: ${result.fail2ban.count} IP`);
      const errors = [...result.cloudflare.errors, ...(result.fail2ban.error ? [result.fail2ban.error] : [])];
      if (errors.length > 0) notify(`${parts.join(" · ")} — ${errors.length} hata`, "error");
      else notify(parts.join(" · "), "success");
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Senkron başarısız", "error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Güvenlik</div>
          <div className="page-sub">Güvenilir IP listesi, Cloudflare ve fail2ban entegrasyonu</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
          IP Ekle
        </button>
      </div>

      <div className="card mb-4">
        <h3 className="card-title-sm">Güvenilir IP&apos;ler</h3>
        <p className="settings-note mb-3">
          BetConstruct ve diğer partner sunucuları buraya ekleyin. Bu IP&apos;ler API rate limit&apos;ine takılmaz;
          Cloudflare&apos;de allow kuralı oluşturulur; fail2ban ignore dosyası güncellenir.
        </p>
        <div className="settings-note mb-3">
          fail2ban dosyası: {fail2banFile || "FAIL2BAN_IGNORE_FILE tanımlı değil (Coolify bind-mount gerekir)"}
        </div>
        <div className="flex-row mb-3">
          <button type="button" className="btn btn-ghost" onClick={syncAll} disabled={syncing || loading}>
            {syncing ? "Senkronize…" : "Cloudflare + fail2ban Senkron"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            Yenile
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>IP / CIDR</th>
                <th>Etiket</th>
                <th>Kategori</th>
                <th>Rate limit</th>
                <th>Cloudflare</th>
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>Yükleniyor…</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7}>Henüz IP eklenmedi.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td><code>{item.cidr}</code></td>
                    <td>{item.label}</td>
                    <td>{item.category}</td>
                    <td>{item.skip_rate_limit ? "Bypass" : "Limitli"}</td>
                    <td>{item.sync_cloudflare ? "Sync" : "Kapalı"}</td>
                    <td>{item.is_active ? "Aktif" : "Pasif"}</td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(item)}>
                        {item.is_active ? "Pasif" : "Aktif"}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeIp(item)}>
                        Sil
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="card-title-sm">fail2ban (sunucu)</h3>
        <p className="settings-note">
          API container SSH veya fail2ban-client çalıştıramaz. Coolify&apos;da host dosyasına bind-mount yapın;
          panel sadece ignore dosyasını yazar. Host&apos;ta jail.local içine include edin veya cron ile{" "}
          <code>fail2ban-client reload</code> çalıştırın. Detay: ops/coolify/README.md
        </p>
      </div>

      <Modal
        open={addOpen}
        title="Güvenilir IP Ekle"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)}>İptal</button>
            <button type="button" className="btn btn-primary" onClick={submitAdd}>Ekle ve Senkron</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">IP veya CIDR</label>
          <input
            className="form-input"
            value={form.cidr}
            onChange={(e) => setForm((f) => ({ ...f, cidr: e.target.value }))}
            placeholder="1.2.3.4 veya 10.0.0.0/24"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Etiket</label>
          <input
            className="form-input"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="BetConstruct prod #1"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Kategori</label>
          <select
            className="form-input"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="betconstruct">betconstruct</option>
            <option value="merchant">merchant</option>
            <option value="partner">partner</option>
            <option value="internal">internal</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">
            <input
              type="checkbox"
              checked={form.skip_rate_limit}
              onChange={(e) => setForm((f) => ({ ...f, skip_rate_limit: e.target.checked }))}
            />
            {" "}API rate limit bypass
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">
            <input
              type="checkbox"
              checked={form.sync_cloudflare}
              onChange={(e) => setForm((f) => ({ ...f, sync_cloudflare: e.target.checked }))}
            />
            {" "}Cloudflare allow kuralı oluştur
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">Not (opsiyonel)</label>
          <input
            className="form-input"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>
      </Modal>
    </>
  );
}
