"use client";

import { Modal } from "@/components/Modal";
import type { CashierRow } from "./CashierFormModal";

interface CashierResetModalProps {
  open: boolean;
  target: CashierRow | null;
  onClose: () => void;
  onSubmit: (password: string) => void;
}

export function CashierResetModal({ open, target, onClose, onSubmit }: CashierResetModalProps) {
  return (
    <Modal
      open={open}
      title={target ? `Şifre sıfırla: ${target.username}` : "Şifre sıfırla"}
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
              const input = document.getElementById("cashier-reset-password") as HTMLInputElement | null;
              if (input?.value) onSubmit(input.value);
            }}
          >
            Sıfırla
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Yeni şifre</label>
        <input id="cashier-reset-password" className="form-input" type="password" required />
      </div>
    </Modal>
  );
}
