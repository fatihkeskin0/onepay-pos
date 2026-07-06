"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/Modal";

interface Site {
  id: number;
  name: string;
  apiKey: string;
  minDeposit: string;
  depCommissionRate: string;
  isActive: boolean;
  brandColor: string;
  brandBgColor: string;
  brandLogoUrl: string | null;
  callbackUrlDeposit: string | null;
}

interface SiteForm {
  name: string;
  min_deposit: string;
  dep_commission_rate: string;
  brand_color: string;
  brand_bg_color: string;
  brand_logo_url: string;
  callback_url_deposit: string;
}

const emptyForm = (): SiteForm => ({
  name: "",
  min_deposit: "100",
  dep_commission_rate: "0",
  brand_color: "#2563EB",
  brand_bg_color: "#F4F7FC",
  brand_logo_url: "",
  callback_url_deposit: "",
});

export default function SitesPage() {
  const [items, setItems] = useState<Site[]>([]);
  const [revealedKeys, setRevealedKeys] = useState<Record<number, boolean>>({});
  const { notify } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<SiteForm>(emptyForm());

  const [editTarget, setEditTarget] = useState<Site | null>(null);
  const [editForm, setEditForm] = useState<SiteForm>(emptyForm());

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
      await API.post("/admin/add_site", {
        name: addForm.name,
        min_deposit: Number(addForm.min_deposit),
        dep_commission_rate: Number(addForm.dep_commission_rate),
        brand_color: addForm.brand_color,
        brand_bg_color: addForm.brand_bg_color,
        brand_logo_url: addForm.brand_logo_url || null,
        callback_url_deposit: addForm.callback_url_deposit || null,
      });
      notify("Site eklendi", "success");
      setAddOpen(false);
      setAddForm(emptyForm());
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

  const renderSiteForm = (form: SiteForm, setForm: (f: SiteForm) => void) => (
    <>
      <div className="form-group">
        <label className="form-label">Site Adı</label>
        <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Min. Yatırım (₺)</label>
        <input
          className="form-input"
          type="number"
          value={form.min_deposit}
          onChange={(e) => setForm({ ...form, min_deposit: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Komisyon Oranı (%)</label>
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
      <div className="form-row form-row-2">
        <div className="form-group">
          <label className="form-label">Ana Renk</label>
          <input
            className="form-input"
            type="color"
            value={form.brand_color}
            onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Arka Plan</label>
          <input
            className="form-input"
            type="color"
            value={form.brand_bg_color}
            onChange={(e) => setForm({ ...form, brand_bg_color: e.target.value })}
          />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Logo URL</label>
        <input
          className="form-input"
          value={form.brand_logo_url}
          onChange={(e) => setForm({ ...form, brand_logo_url: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Yatırım Callback URL</label>
        <input
          className="form-input"
          value={form.callback_url_deposit}
          onChange={(e) => setForm({ ...form, callback_url_deposit: e.target.value })}
        />
      </div>
    </>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Siteler</div>
          <div className="page-sub">Entegratör site yönetimi</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
          + Site Ekle
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ad</th>
              <th>API Key</th>
              <th>Min Yatırım</th>
              <th>Komisyon</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="cell-mono">
                  {revealedKeys[s.id] ? s.apiKey : `${s.apiKey.slice(0, 8)}...`}
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost ml-1"
                    onClick={() => setRevealedKeys({ ...revealedKeys, [s.id]: !revealedKeys[s.id] })}
                  >
                    {revealedKeys[s.id] ? "Gizle" : "Göster"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyKey(s.apiKey)}>
                    Kopyala
                  </button>
                </td>
                <td>{s.minDeposit} TL</td>
                <td>%{Number(s.depCommissionRate).toLocaleString("tr-TR")}</td>
                <td>{s.isActive ? "Aktif" : "Pasif"}</td>
                <td className="table-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>
                    Düzenle
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleSite(s.id)}>
                    {s.isActive ? "Pasif" : "Aktif"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={addOpen}
        title="Yeni Site Ekle"
        onClose={() => setAddOpen(false)}
        wide
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)}>
              İptal
            </button>
            <button type="button" className="btn btn-primary" onClick={submitAdd}>
              Ekle
            </button>
          </>
        }
      >
        {renderSiteForm(addForm, setAddForm)}
      </Modal>

      <Modal
        open={editTarget !== null}
        title={editTarget ? `Site Düzenle: ${editTarget.name}` : ""}
        onClose={() => setEditTarget(null)}
        wide
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setEditTarget(null)}>
              İptal
            </button>
            <button type="button" className="btn btn-primary" onClick={submitEdit}>
              Kaydet
            </button>
          </>
        }
      >
        {renderSiteForm(editForm, setEditForm)}
      </Modal>
    </>
  );
}
