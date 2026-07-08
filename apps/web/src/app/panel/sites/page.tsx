"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/Modal";
import { SiteLogoUpload, uploadPendingSiteLogo } from "@/components/admin/SiteLogoUpload";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";

interface Site {
  id: number;
  name: string;
  apiKey: string;
  minDeposit: string;
  depCommissionRate: string;
  isActive: boolean;
  brandColor: string;
  brandBgColor: string;
  brandTheme: string;
  brandLogoUrl: string | null;
  callbackUrlDeposit: string | null;
}

interface SiteForm {
  name: string;
  min_deposit: string;
  dep_commission_rate: string;
  brand_color: string;
  brand_bg_color: string;
  brand_theme: "light" | "dark";
  brand_logo_url: string;
  callback_url_deposit: string;
}

const emptyForm = (): SiteForm => ({
  name: "",
  min_deposit: "100",
  dep_commission_rate: "0",
  brand_color: "#2563EB",
  brand_bg_color: "#F4F7FC",
  brand_theme: "light",
  brand_logo_url: "",
  callback_url_deposit: "",
});

function siteInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••••••";
  const visibleStart = key.slice(0, 6);
  const visibleEnd = key.slice(-4);
  return `${visibleStart}${"•".repeat(10)}${visibleEnd}`;
}

interface ApiKeyCellProps {
  apiKey: string;
  revealed: boolean;
  onToggle: () => void;
  onCopy: () => void;
}

function ApiKeyCell({ apiKey, revealed, onToggle, onCopy }: ApiKeyCellProps) {
  return (
    <div className="sites-key">
      <div className={`sites-key-code${revealed ? " is-revealed" : ""}`}>
        <code>{revealed ? apiKey : maskApiKey(apiKey)}</code>
      </div>
      <div className="sites-key-actions">
        <button
          type="button"
          className="sites-icon-btn"
          onClick={onToggle}
          aria-label={revealed ? "API key gizle" : "API key göster"}
          title={revealed ? "Gizle" : "Göster"}
        >
          <Icon name={revealed ? "eye-off" : "eye"} size={14} />
        </button>
        <button
          type="button"
          className="sites-icon-btn sites-icon-btn--copy"
          onClick={onCopy}
          aria-label="API key kopyala"
          title="Kopyala"
        >
          <Icon name="copy" size={14} />
        </button>
      </div>
    </div>
  );
}

export default function SitesPage() {
  const [items, setItems] = useState<Site[]>([]);
  const [revealedKeys, setRevealedKeys] = useState<Record<number, boolean>>({});
  const { notify } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<SiteForm>(emptyForm());

  const [editTarget, setEditTarget] = useState<Site | null>(null);
  const [editForm, setEditForm] = useState<SiteForm>(emptyForm());
  const [addLogoFile, setAddLogoFile] = useState<File | null>(null);

  const load = async () => {
    try {
      const data = await API.get<{ items: Site[] }>("/admin/sites");
      setItems(data.items);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitAdd = async () => {
    try {
      const data = await API.post<{ site: { id: number } }>("/admin/add_site", {
        name: addForm.name,
        min_deposit: Number(addForm.min_deposit),
        dep_commission_rate: Number(addForm.dep_commission_rate),
        brand_color: addForm.brand_color,
        brand_bg_color: addForm.brand_bg_color,
        brand_theme: addForm.brand_theme,
        brand_logo_url: addLogoFile ? null : addForm.brand_logo_url || null,
        callback_url_deposit: addForm.callback_url_deposit || null,
      });
      if (addLogoFile) {
        await uploadPendingSiteLogo(data.site.id, addLogoFile);
      }
      notify("Site eklendi", "success");
      setAddOpen(false);
      setAddForm(emptyForm());
      setAddLogoFile(null);
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const openEdit = (s: Site) => {
    setEditTarget(s);
    setEditForm({
      name: s.name,
      min_deposit: String(s.minDeposit),
      dep_commission_rate: String(s.depCommissionRate),
      brand_color: s.brandColor,
      brand_bg_color: s.brandBgColor,
      brand_theme: s.brandTheme === "dark" ? "dark" : "light",
      brand_logo_url: s.brandLogoUrl ?? "",
      callback_url_deposit: s.callbackUrlDeposit ?? "",
    });
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    try {
      await API.post("/admin/update_site", {
        id: editTarget.id,
        name: editForm.name,
        min_deposit: Number(editForm.min_deposit),
        dep_commission_rate: Number(editForm.dep_commission_rate),
        brand_color: editForm.brand_color,
        brand_bg_color: editForm.brand_bg_color,
        brand_theme: editForm.brand_theme,
        brand_logo_url: editForm.brand_logo_url || null,
        callback_url_deposit: editForm.callback_url_deposit || null,
      });
      notify("Site güncellendi", "success");
      setEditTarget(null);
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const toggleSite = async (id: number) => {
    try {
      await API.post("/admin/toggle_site", { id });
      notify("Durum güncellendi", "success");
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      notify("API key kopyalandı", "success");
    } catch {
      notify("Kopyalanamadı", "error");
    }
  };

  const renderSiteForm = (
    form: SiteForm,
    setForm: (f: SiteForm) => void,
    options?: { siteId?: number; onPendingFile?: (file: File | null) => void },
  ) => (
    <div className="sites-form">
      <div className="form-group">
        <label className="form-label">Site adı</label>
        <input
          className="form-input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Örn. Acme Casino"
        />
      </div>

      <div className="sites-form-grid">
        <div className="form-group">
          <label className="form-label">Min. yatırım (₺)</label>
          <input
            className="form-input"
            type="number"
            value={form.min_deposit}
            onChange={(e) => setForm({ ...form, min_deposit: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Komisyon (%)</label>
          <input
            className="form-input"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.dep_commission_rate}
            onChange={(e) => setForm({ ...form, dep_commission_rate: e.target.value })}
          />
        </div>
      </div>

      <div className="sites-form-divider" />

      <div className="sites-form-grid">
        <div className="form-group">
          <label className="form-label">Ana renk</label>
          <div className="sites-color-field">
            <input
              type="color"
              value={form.brand_color}
              onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
              aria-label="Ana renk"
            />
            <input
              className="form-input"
              value={form.brand_color}
              onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Arka plan</label>
          <div className="sites-color-field">
            <input
              type="color"
              value={form.brand_bg_color}
              onChange={(e) => setForm({ ...form, brand_bg_color: e.target.value })}
              aria-label="Arka plan rengi"
            />
            <input
              className="form-input"
              value={form.brand_bg_color}
              onChange={(e) => setForm({ ...form, brand_bg_color: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Ödeme sayfası teması</label>
        <select
          className="form-input"
          value={form.brand_theme}
          onChange={(e) =>
            setForm({ ...form, brand_theme: e.target.value === "dark" ? "dark" : "light" })
          }
        >
          <option value="light">Açık</option>
          <option value="dark">Koyu</option>
        </select>
      </div>

      <SiteLogoUpload
        siteId={options?.siteId}
        value={form.brand_logo_url}
        onChange={(url) => setForm({ ...form, brand_logo_url: url })}
        onPendingFile={options?.onPendingFile}
      />

      <div className="sites-form-divider" />

      <div className="form-group">
        <label className="form-label">Callback URL</label>
        <input
          className="form-input"
          value={form.callback_url_deposit}
          onChange={(e) => setForm({ ...form, callback_url_deposit: e.target.value })}
          placeholder="https://..."
        />
      </div>
    </div>
  );

  const modalFooter = (onCancel: () => void, onSubmit: () => void, submitLabel: string) => (
    <div className="sites-modal-footer">
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        İptal
      </button>
      <button type="button" className="btn btn-primary" onClick={onSubmit}>
        {submitLabel}
      </button>
    </div>
  );

  return (
    <div className="sites-page">
      <div className="page-header">
        <div>
          <div className="page-title">Siteler</div>
          <div className="page-sub">Entegratör site yönetimi ve API erişimi</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <Icon name="plus" size={16} />
          Site Ekle
        </button>
      </div>

      <div className="sites-card">
        {items.length === 0 ? (
          <p className="sites-empty">Henüz site eklenmemiş.</p>
        ) : (
          <div className="sites-table-wrap">
            <table className="sites-table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>API Key</th>
                  <th>Min. Yatırım</th>
                  <th>Komisyon</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="sites-site-cell">
                        <span
                          className="sites-site-avatar"
                          style={{ background: s.brandColor || "var(--accent)" }}
                        >
                          {siteInitial(s.name)}
                        </span>
                        <div>
                          <div className="sites-site-name">{s.name}</div>
                          <div className="sites-site-id">ID {s.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="sites-key-cell">
                      <ApiKeyCell
                        apiKey={s.apiKey}
                        revealed={Boolean(revealedKeys[s.id])}
                        onToggle={() =>
                          setRevealedKeys((prev) => ({ ...prev, [s.id]: !prev[s.id] }))
                        }
                        onCopy={() => copyKey(s.apiKey)}
                      />
                    </td>
                    <td className="sites-metric">
                      <strong>{Number(s.minDeposit).toLocaleString("tr-TR")}</strong>
                      <span>₺</span>
                    </td>
                    <td className="sites-metric">
                      <strong>{Number(s.depCommissionRate).toLocaleString("tr-TR")}</strong>
                      <span>%</span>
                    </td>
                    <td>
                      <Badge variant={s.isActive ? "green" : "gray"}>
                        {s.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </td>
                    <td>
                      <div className="sites-actions">
                        <button
                          type="button"
                          className="sites-icon-btn sites-icon-btn--edit"
                          onClick={() => openEdit(s)}
                          aria-label="Düzenle"
                          title="Düzenle"
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          className={`sites-icon-btn ${s.isActive ? "sites-icon-btn--off" : "sites-icon-btn--on"}`}
                          onClick={() => toggleSite(s.id)}
                          aria-label={s.isActive ? "Pasif yap" : "Aktif yap"}
                          title={s.isActive ? "Pasif yap" : "Aktif yap"}
                        >
                          <Icon name="power" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={addOpen}
        title="Yeni site"
        subtitle="Temel bilgiler ve marka ayarları"
        onClose={() => setAddOpen(false)}
        className="modal--minimal"
        overlayClassName="modal-overlay--minimal"
        footer={modalFooter(() => setAddOpen(false), submitAdd, "Ekle")}
      >
        {renderSiteForm(addForm, setAddForm, { onPendingFile: setAddLogoFile })}
      </Modal>

      <Modal
        open={editTarget !== null}
        title={editTarget ? editTarget.name : "Site"}
        subtitle="Site ayarlarını güncelle"
        onClose={() => setEditTarget(null)}
        className="modal--minimal"
        overlayClassName="modal-overlay--minimal"
        footer={modalFooter(() => setEditTarget(null), submitEdit, "Kaydet")}
      >
        {editTarget ? renderSiteForm(editForm, setEditForm, { siteId: editTarget.id }) : null}
      </Modal>
    </div>
  );
}
