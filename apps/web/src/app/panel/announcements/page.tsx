"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Modal, ConfirmModal } from "@/components/Modal";
import { useClientSession } from "@/hooks/useClientSession";

interface Announcement {
  id: number;
  title: string;
  body: string;
  type: string;
  isActive: boolean;
}

export default function AnnouncementsPage() {
  const { ready, isAdmin } = useClientSession();
  const { notify } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", body: "", type: "info" });

  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const endpoint = isAdmin ? "/admin/announcements" : "/cashier/announcements";
      const data = await API.get<{ items: Announcement[] }>(endpoint);
      setItems(data.items);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    load();
  }, [isAdmin, ready]);

  const openAdd = () => {
    setEditId(null);
    setForm({ title: "", body: "", type: "info" });
    setFormOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditId(a.id);
    setForm({ title: a.title, body: a.body, type: a.type });
    setFormOpen(true);
  };

  const submitForm = async () => {
    try {
      await API.post("/admin/save_announcement", {
        id: editId ?? undefined,
        title: form.title,
        body: form.body,
        type: form.type,
      });
      notify(editId ? "Güncellendi" : "Eklendi", "success");
      setFormOpen(false);
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const toggleActive = async (a: Announcement) => {
    try {
      await API.post("/admin/save_announcement", {
        id: a.id,
        title: a.title,
        body: a.body,
        type: a.type,
        is_active: !a.isActive,
      });
      notify("Durum güncellendi", "success");
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    try {
      await API.post("/admin/delete_announcement", { id: deleteTarget.id });
      notify("Silindi", "success");
      setDeleteTarget(null);
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Duyurular</div>
          <div className="page-sub">Panel duyuruları</div>
        </div>
        {isAdmin && (
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            + Duyuru Ekle
          </button>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Başlık</th>
              <th>Tip</th>
              <th>Aktif</th>
              {isAdmin && <th>İşlem</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isAdmin ? 4 : 3}>Yükleniyor...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 4 : 3}>Kayıt yok</td>
              </tr>
            ) : (
              items.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td>{a.type}</td>
                  <td>{a.isActive ? "Evet" : "Hayır"}</td>
                  {isAdmin && (
                    <td className="table-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>
                        Düzenle
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(a)}>
                        {a.isActive ? "Pasif" : "Aktif"}
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(a)}>
                        Sil
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <>
          <Modal
            open={formOpen}
            title={editId ? "Duyuru Düzenle" : "Yeni Duyuru"}
            onClose={() => setFormOpen(false)}
            footer={
              <>
                <button type="button" className="btn btn-ghost" onClick={() => setFormOpen(false)}>
                  İptal
                </button>
                <button type="button" className="btn btn-primary" onClick={submitForm}>
                  Kaydet
                </button>
              </>
            }
          >
            <div className="form-group">
              <label className="form-label">Başlık</label>
              <input
                className="form-input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">İçerik</label>
              <textarea
                className="form-input"
                rows={4}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tip</label>
              <select
                className="form-input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="info">Bilgi</option>
                <option value="warning">Uyarı</option>
                <option value="success">Başarı</option>
              </select>
            </div>
          </Modal>

          <ConfirmModal
            open={deleteTarget !== null}
            title="Duyuruyu Sil"
            message={`"${deleteTarget?.title}" silinsin mi?`}
            confirmLabel="Sil"
            danger
            onConfirm={submitDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        </>
      )}
    </>
  );
}
