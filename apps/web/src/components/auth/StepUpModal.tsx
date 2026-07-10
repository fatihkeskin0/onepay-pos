"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!open) setCode("");
  }, [open]);

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
      layer="step-up"
      className="step-up-modal"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={loading}>
            İptal
          </button>
          <button
            type="button"
            className={`btn btn-primary${loading ? " btn-loading" : ""}`}
            onClick={handleConfirm}
            disabled={loading || code.length !== 6}
          >
            {loading ? (
              <>
                <span className="btn-spinner" aria-hidden />
                Doğrulanıyor…
              </>
            ) : (
              "Onayla"
            )}
          </button>
        </>
      }
    >
      <p className="step-up-message">{message}</p>
      <AuthField
        label="6 haneli kod"
        fieldType="otp"
        name="totp_code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        maxLength={6}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        required
        disabled={loading}
      />
    </Modal>
  );
}
