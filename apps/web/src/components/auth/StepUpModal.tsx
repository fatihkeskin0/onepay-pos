"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { AuthField } from "@/components/auth/AuthField";

interface StepUpModalProps {
  open: boolean;
  title?: string;
  message?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (totpCode: string) => void | Promise<void>;
}

export function StepUpModal({
  open,
  title = "2FA Doğrulama",
  message = "Bu işlem için authenticator uygulamanızdaki 6 haneli kodu girin.",
  loading = false,
  onClose,
  onConfirm,
}: StepUpModalProps) {
  const [code, setCode] = useState("");

  const handleClose = () => {
    if (loading) return;
    setCode("");
    onClose();
  };

  const handleConfirm = async () => {
    if (code.length !== 6 || loading) return;
    await onConfirm(code);
    setCode("");
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={handleClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={loading}>
            İptal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={loading || code.length !== 6}
          >
            {loading ? "Doğrulanıyor…" : "Onayla"}
          </button>
        </>
      }
    >
      <p className="settings-note mb-3">{message}</p>
      <AuthField
        label="6 haneli kod"
        fieldType="otp"
        name="totp_code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        maxLength={6}
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        disabled={loading}
      />
    </Modal>
  );
}
