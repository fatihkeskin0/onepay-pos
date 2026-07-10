"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/Modal";
import { StepUpModal } from "@/components/auth/StepUpModal";

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
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<PosMethod | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    label: "",
    enabled: false,
    min_amount: "50",
    max_amount: "100000",
    sort_order: "0",
  });
  const { notify } = useToast();

  const [stepUp, setStepUp] = useState<{
    title: string;
    run: (totpCode: string) => Promise<void>;
  } | null>(null);
  const [stepUpLoading, setStepUpLoading] = useState(false);

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

  const load = async () => {
    setLoading(true);
    try {
      const data = await API.get<{ items: PosMethod[] }>("/admin/pos_methods");
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
    setStepUp({
      title: "POS ayarlarını kaydet",
      run: async (totpCode) => {
        await API.post("/admin/save_pos_method", {
          provider: editTarget.provider,
          label: editForm.label,
          enabled: editForm.enabled,
          min_amount: Number(editForm.min_amount),
          max_amount: Number(editForm.max_amount),
          sort_order: Number(editForm.sort_order),
          totp_code: totpCode,
        });
        notify("Kaydedildi", "success");
        setEditTarget(null);
        load();
      },
    });
  };

  const requestToggle = (provider: string) => {
    setStepUp({
      title: "POS durumunu değiştir",
      run: async (totpCode) => {
        await API.post("/admin/toggle_pos_method", { provider, totp_code: totpCode });
        notify("Durum güncellendi", "success");
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
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>Yükleniyor...</td>
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
                  <td className="table-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>
                      Düzenle
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
