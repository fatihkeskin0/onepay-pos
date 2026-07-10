"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Modal, ConfirmModal } from "@/components/Modal";
import { StepUpModal } from "@/components/auth/StepUpModal";

interface Cashier {
  id: number;
  username: string;
  role: string;
  commissionRate: string;
  isActive: boolean;
  telegramChatId: string | null;
  adminNote: string | null;
}

interface AddForm {
  username: string;
  password: string;
  role: "admin" | "kasiyer";
  commission_rate: string;
}

interface EditForm {
  commission_rate: string;
  telegram_chat_id: string;
  admin_note: string;
  is_active: boolean;
}

export default function CashiersPage() {
  const [items, setItems] = useState<Cashier[]>([]);
  const [loading, setLoading] = useState(true);
  const { notify } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    username: "",
    password: "",
    role: "kasiyer",
    commission_rate: "5",
  });

  const [editTarget, setEditTarget] = useState<Cashier | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    commission_rate: "5",
    telegram_chat_id: "",
    admin_note: "",
    is_active: true,
  });

  const [resetTarget, setResetTarget] = useState<Cashier | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

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
      const data = await API.get<{ items: Cashier[] }>("/admin/cashiers");
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

  const requestAdd = () => {
    setStepUp({
      title: "Agent ekle",
      run: async (totpCode) => {
        await API.post("/admin/add_cashier", {
          username: addForm.username,
          password: addForm.password,
          role: addForm.role,
          commission_rate: Number(addForm.commission_rate),
          totp_code: totpCode,
        });
        notify("Agent eklendi", "success");
        setAddOpen(false);
        setAddForm({ username: "", password: "", role: "kasiyer", commission_rate: "5" });
        load();
      },
    });
  };

  const openEdit = (c: Cashier) => {
    setEditTarget(c);
    setEditForm({
      commission_rate: String(c.commissionRate),
      telegram_chat_id: c.telegramChatId ?? "",
      admin_note: c.adminNote ?? "",
      is_active: c.isActive,
    });
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    try {
      await API.post("/admin/update_cashier", {
        id: editTarget.id,
        commission_rate: Number(editForm.commission_rate),
        telegram_chat_id: editForm.telegram_chat_id,
        admin_note: editForm.admin_note,
        is_active: editForm.is_active,
      });
      notify("Güncellendi", "success");
      setEditTarget(null);
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const toggleActive = (c: Cashier) => {
    setConfirmAction({
      title: c.isActive ? "Pasife Al" : "Aktifleştir",
      message: `${c.username} hesabını ${c.isActive ? "pasife almak" : "aktifleştirmek"} istiyor musunuz?`,
      onConfirm: () => {
        setConfirmAction(null);
        setStepUp({
          title: c.isActive ? "Pasife al" : "Aktifleştir",
          run: async (totpCode) => {
            await API.post("/admin/toggle_cashier", { id: c.id, totp_code: totpCode });
            notify("Durum güncellendi", "success");
            load();
          },
        });
      },
    });
  };

  const requestResetPassword = () => {
    if (!resetTarget) return;
    setStepUp({
      title: "Şifre sıfırla",
      run: async (totpCode) => {
        await API.post("/admin/update_cashier", {
          id: resetTarget.id,
          password: newPassword,
          totp_code: totpCode,
        });
        notify("Şifre sıfırlandı", "success");
        setResetTarget(null);
        setNewPassword("");
      },
    });
  };

  const forceLogout = (c: Cashier) => {
    setConfirmAction({
      title: "Çıkış Yaptır",
      message: `${c.username} oturumunu sonlandırmak istiyor musunuz?`,
      onConfirm: () => {
        setConfirmAction(null);
        setStepUp({
          title: "Oturumu sonlandır",
          run: async (totpCode) => {
            await API.post("/admin/force_logout", { id: c.id, totp_code: totpCode });
            notify("Oturum sonlandırıldı", "success");
          },
        });
      },
    });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Agentler</div>
          <div className="page-sub">Kasiyer hesapları</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
          + Agent Ekle
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kullanıcı</th>
              <th>Rol</th>
              <th>Komisyon %</th>
              <th>Aktif</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>Yükleniyor...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5}>Kayıt yok</td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id}>
                  <td>{c.username}</td>
                  <td>{c.role}</td>
                  <td>{c.commissionRate}</td>
                  <td>{c.isActive ? "Evet" : "Hayır"}</td>
                  <td className="table-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>
                      Düzenle
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(c)}>
                      {c.isActive ? "Pasif" : "Aktif"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setResetTarget(c);
                        setNewPassword("");
                      }}
                    >
                      Şifre
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => forceLogout(c)}>
                      Çıkış
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
        title="Yeni Agent Ekle"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)}>
              İptal
            </button>
            <button type="button" className="btn btn-primary" onClick={requestAdd}>
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
          <label className="form-label">Rol</label>
          <select
            className="form-input"
            value={addForm.role}
            onChange={(e) => setAddForm({ ...addForm, role: e.target.value as "admin" | "kasiyer" })}
          >
            <option value="kasiyer">Agent</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {addForm.role === "kasiyer" && (
          <div className="form-group">
            <label className="form-label">Komisyon Oranı (%)</label>
            <input
              className="form-input"
              type="number"
              value={addForm.commission_rate}
              onChange={(e) => setAddForm({ ...addForm, commission_rate: e.target.value })}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={editTarget !== null}
        title={editTarget ? `Düzenle: ${editTarget.username}` : ""}
        onClose={() => setEditTarget(null)}
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
          <label className="form-label">Komisyon Oranı (%)</label>
          <input
            className="form-input"
            type="number"
            value={editForm.commission_rate}
            onChange={(e) => setEditForm({ ...editForm, commission_rate: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Telegram Grup ID</label>
          <input
            className="form-input"
            value={editForm.telegram_chat_id}
            onChange={(e) => setEditForm({ ...editForm, telegram_chat_id: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Admin Notu</label>
          <textarea
            className="form-input"
            rows={3}
            value={editForm.admin_note}
            onChange={(e) => setEditForm({ ...editForm, admin_note: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">
            <input
              type="checkbox"
              checked={editForm.is_active}
              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
            />{" "}
            Aktif
          </label>
        </div>
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
            <button type="button" className="btn btn-primary" onClick={requestResetPassword}>
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
        open={confirmAction !== null}
        title={confirmAction?.title ?? ""}
        message={confirmAction?.message ?? ""}
        onConfirm={() => confirmAction?.onConfirm()}
        onCancel={() => setConfirmAction(null)}
      />

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
