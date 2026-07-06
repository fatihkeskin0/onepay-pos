"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/Modal";
import { useClientSession } from "@/hooks/useClientSession";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const { notify } = useToast();
  const { ready, isAdmin } = useClientSession();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaModal, setTwoFaModal] = useState(false);
  const [twoFaSecret, setTwoFaSecret] = useState("");
  const [twoFaQr, setTwoFaQr] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (isAdmin) {
      API.get<{ settings: Record<string, string> }>("/admin/settings")
        .then((d) => setSettings(d.settings))
        .catch(() => undefined);
    } else {
      API.get<{ enabled: boolean }>("/cashier/get_2fa_status")
        .then((d) => setTwoFaEnabled(d.enabled))
        .catch(() => undefined);
    }
  }, [isAdmin, ready]);

  const saveAdmin = async () => {
    try {
      await API.post("/admin/update_settings", settings);
      notify("Kaydedildi", "success");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      notify("Şifreler eşleşmiyor", "error");
      return;
    }
    try {
      await API.post("/cashier/change_password", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      notify("Şifre değiştirildi", "success");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const start2faSetup = async () => {
    try {
      const data = await API.post<{ secret: string; qr: string }>("/cashier/setup_2fa", {});
      setTwoFaSecret(data.secret);
      setTwoFaQr(data.qr);
      setTwoFaCode("");
      setTwoFaModal(true);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const enable2fa = async () => {
    try {
      await API.post("/cashier/enable_2fa", { code: twoFaCode });
      notify("2FA etkinleştirildi", "success");
      setTwoFaEnabled(true);
      setTwoFaModal(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Geçersiz kod", "error");
    }
  };

  const disable2fa = async () => {
    try {
      await API.post("/cashier/disable_2fa", { password: disablePassword });
      notify("2FA kapatıldı", "success");
      setTwoFaEnabled(false);
      setDisablePassword("");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Ayarlar</div>
          <div className="page-sub">Sistem ve hesap ayarları</div>
        </div>
      </div>
      {!ready ? null : isAdmin ? (
        <>
          <div className="card mb-4">
            <h3 className="card-title-sm">POS Sağlayıcıları</h3>
            <p className="settings-note">
              Aktif yöntemler, min/max tutarlar ve varsayılan sağlayıcı POS Ayarları sayfasından yönetilir.
            </p>
            <Link href="/panel/pos" className="btn btn-ghost">
              POS Ayarları →
            </Link>
          </div>
          <div className="card">
            <div className="form-group">
              <label className="form-label">Chat Aktif</label>
              <select
                className="form-input"
                value={settings.chat_enabled ?? "1"}
                onChange={(e) => setSettings({ ...settings, chat_enabled: e.target.value })}
              >
                <option value="1">Evet</option>
                <option value="0">Hayır</option>
              </select>
            </div>
            <button type="button" className="btn btn-primary" onClick={saveAdmin}>
              Kaydet
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="card mb-4">
            <h3 className="card-title-sm">Şifre Değiştir</h3>
            <div className="form-group">
              <label className="form-label">Mevcut Şifre</label>
              <input
                className="form-input"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Yeni Şifre</label>
              <input
                className="form-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Yeni Şifre (Tekrar)</label>
              <input
                className="form-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={changePassword}>
              Şifreyi Güncelle
            </button>
          </div>

          <div className="card">
            <h3 className="card-title-sm mb-4">İki Faktörlü Doğrulama (2FA)</h3>
            <p className="settings-note mb-3">
              Durum: {twoFaEnabled ? "Aktif" : "Kapalı"}
            </p>
            {!twoFaEnabled ? (
              <button type="button" className="btn btn-primary" onClick={start2faSetup}>
                2FA Kur
              </button>
            ) : (
              <div>
                <div className="form-group">
                  <label className="form-label">Şifreniz (2FA kapatmak için)</label>
                  <input
                    className="form-input"
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                  />
                </div>
                <button type="button" className="btn btn-danger" onClick={disable2fa}>
                  2FA Kapat
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        open={twoFaModal}
        title="2FA Kurulumu"
        onClose={() => setTwoFaModal(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setTwoFaModal(false)}>
              İptal
            </button>
            <button type="button" className="btn btn-primary" onClick={enable2fa}>
              Etkinleştir
            </button>
          </>
        }
      >
        {twoFaQr && (
          <div className="qr-wrap">
            <img src={twoFaQr} alt="2FA QR" width={180} height={180} />
          </div>
        )}
        <p className="settings-secret">
          Secret: {twoFaSecret}
        </p>
        <div className="form-group">
          <label className="form-label">Doğrulama Kodu</label>
          <input
            className="form-input"
            value={twoFaCode}
            onChange={(e) => setTwoFaCode(e.target.value)}
            maxLength={6}
            placeholder="6 haneli kod"
          />
        </div>
      </Modal>
    </>
  );
}
