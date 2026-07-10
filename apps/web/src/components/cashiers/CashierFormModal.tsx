"use client";

import { Modal } from "@/components/Modal";

export interface CashierRow {
  id: number;
  username: string;
  role: string;
  commissionRate: string;
  isActive: boolean;
  totpEnabled: boolean;
  telegramChatId: string | null;
  adminNote: string | null;
  lastLogin: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  ipLockEnabled: boolean;
  online?: boolean;
}

interface CashierFormModalProps {
  open: boolean;
  mode: "add" | "edit";
  initial?: CashierRow | null;
  onClose: () => void;
  onSubmitAdd: (form: { username: string; password: string; role: "admin" | "kasiyer"; commission_rate: string }) => void;
  onSubmitEdit: (form: {
    commission_rate: string;
    telegram_chat_id: string;
    admin_note: string;
    is_active: boolean;
  }) => void;
}

export function CashierFormModal({
  open,
  mode,
  initial,
  onClose,
  onSubmitAdd,
  onSubmitEdit,
}: CashierFormModalProps) {
  const isAdd = mode === "add";

  return (
    <Modal
      open={open}
      title={isAdd ? "Yeni Agent Ekle" : `Agent Düzenle: ${initial?.username ?? ""}`}
      subtitle={isAdd ? "Kasiyer veya admin hesabı oluşturun" : "Komisyon ve iletişim ayarları"}
      className="modal--minimal"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            İptal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const form = document.getElementById("cashier-form") as HTMLFormElement | null;
              if (!form) return;
              const data = new FormData(form);
              if (isAdd) {
                onSubmitAdd({
                  username: String(data.get("username") ?? ""),
                  password: String(data.get("password") ?? ""),
                  role: (String(data.get("role") ?? "kasiyer") as "admin" | "kasiyer"),
                  commission_rate: String(data.get("commission_rate") ?? "5"),
                });
              } else {
                onSubmitEdit({
                  commission_rate: String(data.get("commission_rate") ?? "5"),
                  telegram_chat_id: String(data.get("telegram_chat_id") ?? ""),
                  admin_note: String(data.get("admin_note") ?? ""),
                  is_active: data.get("is_active") === "on",
                });
              }
            }}
          >
            {isAdd ? "Ekle" : "Kaydet"}
          </button>
        </>
      }
    >
      <form id="cashier-form" onSubmit={(e) => e.preventDefault()}>
        {isAdd ? (
          <>
            <div className="form-group">
              <label className="form-label">Kullanıcı adı</label>
              <input className="form-input" name="username" required />
            </div>
            <div className="form-group">
              <label className="form-label">Şifre</label>
              <input className="form-input" name="password" type="password" required />
            </div>
            <div className="form-group">
              <label className="form-label">Rol</label>
              <select className="form-input" name="role" defaultValue="kasiyer">
                <option value="kasiyer">Kasiyer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </>
        ) : null}
        <div className="form-group">
          <label className="form-label">Komisyon (%)</label>
          <input
            className="form-input"
            name="commission_rate"
            type="number"
            step="0.01"
            defaultValue={initial?.commissionRate ?? "5"}
          />
        </div>
        {!isAdd ? (
          <>
            <div className="form-group">
              <label className="form-label">Telegram Chat ID</label>
              <input className="form-input" name="telegram_chat_id" defaultValue={initial?.telegramChatId ?? ""} />
            </div>
            <div className="form-group">
              <label className="form-label">Admin notu</label>
              <input className="form-input" name="admin_note" defaultValue={initial?.adminNote ?? ""} />
            </div>
            <div className="form-group">
              <label className="form-label">
                <input type="checkbox" name="is_active" defaultChecked={initial?.isActive ?? true} /> Aktif
              </label>
            </div>
          </>
        ) : null}
      </form>
    </Modal>
  );
}
