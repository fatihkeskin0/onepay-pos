"use client";

import { useEffect, useState } from "react";
import type { ProxyMode } from "@onepara/shared";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/Modal";
import { StepUpModal } from "@/components/auth/StepUpModal";
import { useStepUp } from "@/hooks/useStepUp";
import { ProxyConfigModal } from "@/components/pos/ProxyConfigModal";

interface PosMethod {
  id: number;
  provider: string;
  label: string;
  enabled: boolean;
  isDefault: boolean;
  minAmount: string;
  maxAmount: string;
  sortOrder: number;
  configured: boolean;
  proxyEnabled: boolean;
  proxyMode: ProxyMode;
  proxyEntryIds: number[] | null;
}

interface ProxyPoolEntry {
  id: number;
  label: string;
  host: string;
  port: number;
  is_active: boolean;
}

interface EditForm {
  label: string;
  enabled: boolean;
  min_amount: string;
  max_amount: string;
  sort_order: string;
}

export default function PosSettingsPage() {
  const [items, setItems] = useState<PosMethod[]>([]);
  const [poolEntries, setPoolEntries] = useState<ProxyPoolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<PosMethod | null>(null);
  const [proxyTarget, setProxyTarget] = useState<PosMethod | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    label: "",
    enabled: false,
    min_amount: "50",
    max_amount: "100000",
    sort_order: "0",
  });
  const { notify } = useToast();
  const {
    stepUpOpen,
    stepUpTitle,
    stepUpLoading,
    requestStepUp,
    closeStepUp,
    confirmStepUp,
  } = useStepUp((msg) => notify(msg, "error"));

  const load = async () => {
    setLoading(true);
    try {
      const [posData, poolData] = await Promise.all([
        API.get<{ items: PosMethod[] }>("/admin/pos_methods"),
        API.get<{ items: ProxyPoolEntry[] }>("/admin/proxy_pool"),
      ]);
      setItems(
        posData.items.map((m) => ({
          ...m,
          proxyMode: (m.proxyMode ?? "off") as ProxyMode,
          proxyEntryIds: Array.isArray(m.proxyEntryIds) ? m.proxyEntryIds : [],
        })),
      );
      setPoolEntries(poolData.items);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (m: PosMethod) => {
    setEditTarget(m);
    setEditForm({
      label: m.label,
      enabled: m.enabled,
      min_amount: String(m.minAmount),
      max_amount: String(m.maxAmount),
      sort_order: String(m.sortOrder),
    });
  };

  const requestSave = () => {
    if (!editTarget) return;
    const target = editTarget;
    requestStepUp({
      title: "POS ayarlarını kaydet",
      closeParent: () => setEditTarget(null),
      run: async (totpCode) => {
        await API.post("/admin/save_pos_method", {
          provider: target.provider,
          label: editForm.label,
          enabled: editForm.enabled,
          min_amount: Number(editForm.min_amount),
          max_amount: Number(editForm.max_amount),
          sort_order: Number(editForm.sort_order),
          totp_code: totpCode,
        });
        notify("Kaydedildi", "success");
        load();
      },
    });
  };

  const requestToggle = (provider: string) => {
    requestStepUp({
      title: "POS durumunu değiştir",
      run: async (totpCode) => {
        await API.post("/admin/toggle_pos_method", { provider, totp_code: totpCode });
        notify("Durum güncellendi", "success");
        load();
      },
    });
  };

  const requestProxySave = (config: {
    proxy_enabled: boolean;
    proxy_mode: ProxyMode;
    proxy_entry_ids: number[];
  }) => {
    if (!proxyTarget) return;
    const target = proxyTarget;
    requestStepUp({
      title: "Proxy ayarlarını kaydet",
      closeParent: () => setProxyTarget(null),
      run: async (totpCode) => {
        await API.post("/admin/save_pos_method", {
          provider: target.provider,
          proxy_enabled: config.proxy_enabled,
          proxy_mode: config.proxy_mode,
          proxy_entry_ids: config.proxy_entry_ids,
          totp_code: totpCode,
        });
        notify("Proxy ayarları kaydedildi", "success");
        load();
      },
    });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">POS Ayarları</div>
          <div className="page-sub">Aynı anda yalnızca 1 ödeme altyapısı aktif olabilir</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sağlayıcı</th>
              <th>Etiket</th>
              <th>Min–Max (₺)</th>
              <th>Durum</th>
              <th>Credentials</th>
              <th>Proxy</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>Yükleniyor...</td>
              </tr>
            ) : (
              items.map((m) => (
                <tr key={m.id}>
                  <td className="cell-mono">{m.provider}</td>
                  <td>{m.label}</td>
                  <td>
                    {m.minAmount} – {m.maxAmount}
                  </td>
                  <td>
                    <span className={`badge ${m.enabled ? "badge-approved" : "badge-cancelled"}`}>
                      {m.enabled ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${m.configured ? "badge-blue" : "badge-yellow"}`}>
                      {m.configured ? "Yapılandırıldı" : "Eksik"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${m.proxyEnabled ? "badge-blue" : "badge-cancelled"}`}>
                      {m.proxyEnabled ? m.proxyMode : "Kapalı"}
                    </span>
                  </td>
                  <td className="table-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>
                      Düzenle
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setProxyTarget(m)}>
                      Proxy
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => requestToggle(m.provider)}>
                      {m.enabled ? "Pasif yap" : "Aktif yap"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={editTarget !== null}
        title={editTarget ? `POS Düzenle: ${editTarget.provider}` : ""}
        onClose={() => setEditTarget(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setEditTarget(null)}>
              İptal
            </button>
            <button type="button" className="btn btn-primary" onClick={requestSave}>
              Kaydet
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Etiket</label>
          <input
            className="form-input"
            value={editForm.label}
            onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
          />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Min Tutar (₺)</label>
            <input
              className="form-input"
              type="number"
              value={editForm.min_amount}
              onChange={(e) => setEditForm({ ...editForm, min_amount: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Max Tutar (₺)</label>
            <input
              className="form-input"
              type="number"
              value={editForm.max_amount}
              onChange={(e) => setEditForm({ ...editForm, max_amount: e.target.value })}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Sıra</label>
          <input
            className="form-input"
            type="number"
            value={editForm.sort_order}
            onChange={(e) => setEditForm({ ...editForm, sort_order: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">
            <input
              type="checkbox"
              checked={editForm.enabled}
              onChange={(e) => setEditForm({ ...editForm, enabled: e.target.checked })}
            />{" "}
            Aktif (diğer yöntemler otomatik kapanır)
          </label>
        </div>
        {editTarget && !editTarget.configured && (
          <p className="text-xs text-muted">
            Bu sağlayıcı için env credentials eksik. Aktif etmeden önce .env dosyasını doldurun.
          </p>
        )}
      </Modal>

      <ProxyConfigModal
        open={proxyTarget !== null}
        provider={proxyTarget?.provider ?? ""}
        proxyEnabled={proxyTarget?.proxyEnabled ?? false}
        proxyMode={proxyTarget?.proxyMode ?? "off"}
        proxyEntryIds={proxyTarget?.proxyEntryIds ?? []}
        poolEntries={poolEntries}
        onClose={() => setProxyTarget(null)}
        onSave={requestProxySave}
      />

      <StepUpModal
        open={stepUpOpen}
        title={stepUpTitle}
        loading={stepUpLoading}
        onClose={closeStepUp}
        onConfirm={confirmStepUp}
      />
    </>
  );
}
