"use client";

import { useEffect, useState } from "react";
import type { SubPermission } from "@onepara/shared";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Modal, ConfirmModal } from "@/components/Modal";
import { SUB_PERM_KEYS, SUB_PERM_LABELS } from "@/lib/sub-perms";
import { useClientSession } from "@/hooks/useClientSession";

interface SubUser {
  id: number;
  username: string;
  displayName: string | null;
  isActive: boolean;
  permissions: Record<string, boolean> | null;
  cashier?: { username: string };
}

export default function PersonelPage() {
  const { ready, isAdmin } = useClientSession();
  const prefix = isAdmin ? "/admin" : "/cashier";
  const { notify } = useToast();

  const [items, setItems] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    username: "",
    password: "",
    display_name: "",
    permissions: {} as Record<string, boolean>,
  });

  const [editTarget, setEditTarget] = useState<SubUser | null>(null);
  const [editForm, setEditForm] = useState({ display_name: "", permissions: {} as Record<string, boolean> });

  const [resetTarget, setResetTarget] = useState<SubUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<SubUser | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const endpoint = isAdmin ? "/admin/all_sub_users" : "/cashier/sub_users";
      const data = await API.get<{ items: SubUser[] }>(endpoint);
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

  const submitAdd = async () => {
    try {
      await API.post("/cashier/add_sub_user", {
        username: addForm.username,
        password: addForm.password,
        display_name: addForm.display_name || null,
        permissions: addForm.permissions,
      });
      notify("Personel eklendi", "success");
      setAddOpen(false);
      setAddForm({ username: "", password: "", display_name: "", permissions: {} });
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const openEdit = (s: SubUser) => {
    setEditTarget(s);
    setEditForm({
      display_name: s.displayName ?? "",
      permissions: (s.permissions as Record<string, boolean>) ?? {},
    });
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    try {
      await API.post("/cashier/update_sub_user", {
        id: editTarget.id,
        display_name: editForm.display_name || null,
        permissions: editForm.permissions,
      });
      notify("Güncellendi", "success");
      setEditTarget(null);
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const toggleActive = async (s: SubUser) => {
    try {
      await API.post(`${prefix}/toggle_sub_user`, { id: s.id });
      notify("Durum güncellendi", "success");
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const submitResetPassword = async () => {
    if (!resetTarget) return;
    try {
      await API.post(`${prefix}/reset_sub_password`, { id: resetTarget.id, new_password: newPassword });
      notify("Şifre sıfırlandı", "success");
      setResetTarget(null);
      setNewPassword("");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    try {
      await API.post(`${prefix}/delete_sub_user`, { id: deleteTarget.id });
      notify("Silindi", "success");
      setDeleteTarget(null);
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const permCheckboxes = (perms: Record<string, boolean>, setPerms: (p: Record<string, boolean>) => void) => (
    <div className="form-group">
      <label className="form-label">Yetkiler</label>
      {SUB_PERM_KEYS.map((key: SubPermission) => (
        <label key={key} className="perm-label">
          <input
            type="checkbox"
            checked={perms[key] !== false}
            onChange={(e) => setPerms({ ...perms, [key]: e.target.checked })}
          />{" "}
          {SUB_PERM_LABELS[key]}
        </label>
      ))}
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Personel</div>
          <div className="page-sub">Alt kullanıcı yönetimi</div>
        </div>
        {!isAdmin && (
          <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
            + Personel Ekle
          </button>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kullanıcı</th>
              <th>Ad</th>
              {isAdmin && <th>Agent</th>}
              <th>Aktif</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4}>Yükleniyor...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4}>Kayıt yok</td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id}>
                  <td>{s.username}</td>
                  <td>{s.displayName ?? "—"}</td>
                  {isAdmin && <td>{s.cashier?.username ?? "—"}</td>}
                  <td>{s.isActive ? "Evet" : "Hayır"}</td>
                  <td className="table-actions">
                    {!isAdmin && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>
                        Düzenle
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(s)}>
                      {s.isActive ? "Pasif" : "Aktif"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setResetTarget(s);
                        setNewPassword("");
                      }}
                    >
                      Şifre
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(s)}>
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
        title="Yeni Personel Ekle"
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
        <div className="form-group">
          <label className="form-label">Kullanıcı Adı</label>
          <input
            className="form-input"
            value={addForm.username}
            onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Şifre</label>
          <input
            className="form-input"
            type="password"
            value={addForm.password}
            onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Görünen Ad (opsiyonel)</label>
          <input
            className="form-input"
            value={addForm.display_name}
            onChange={(e) => setAddForm({ ...addForm, display_name: e.target.value })}
          />
        </div>
        {permCheckboxes(addForm.permissions, (p) => setAddForm({ ...addForm, permissions: p }))}
      </Modal>

      <Modal
        open={editTarget !== null}
        title={editTarget ? `Düzenle: ${editTarget.username}` : ""}
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
        <div className="form-group">
          <label className="form-label">Görünen Ad</label>
          <input
            className="form-input"
            value={editForm.display_name}
            onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
          />
        </div>
        {permCheckboxes(editForm.permissions, (p) => setEditForm({ ...editForm, permissions: p }))}
      </Modal>

      <Modal
        open={resetTarget !== null}
        title={resetTarget ? `Şifre Sıfırla: ${resetTarget.username}` : ""}
        onClose={() => setResetTarget(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setResetTarget(null)}>
              İptal
            </button>
            <button type="button" className="btn btn-primary" onClick={submitResetPassword}>
              Sıfırla
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Yeni Şifre</label>
          <input
            className="form-input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Personeli Sil"
        message={`${deleteTarget?.username} silinsin mi? Bu işlem geri alınamaz.`}
        confirmLabel="Sil"
        danger
        onConfirm={submitDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
