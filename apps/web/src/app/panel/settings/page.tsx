"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/Modal";
import { useClientSession } from "@/hooks/useClientSession";

export default function SettingsPage() {
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

  const [telegramUsername, setTelegramUsername] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    setSettingsLoading(true);
    API.get<{ settings: Record<string, string> }>("/admin/settings")
      .then((d) => setTelegramUsername(d.settings.telegram_support_username ?? ""))
      .catch(() => undefined)
      .finally(() => setSettingsLoading(false));
  }, [isAdmin, ready]);

  const saveSiteSettings = async () => {
    setSettingsSaving(true);
    try {
      await API.post("/admin/update_settings", {
        telegram_support_username: telegramUsername,
      });
      notify("Site ayarları kaydedildi", "success");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Kaydedilemedi", "error");
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    if (!ready || isAdmin) return;
    API.get<{ enabled: boolean }>("/cashier/get_2fa_status")
      .then((d) => setTwoFaEnabled(d.enabled))
      .catch(() => undefined);
  }, [isAdmin, ready]);

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
            <h3 className="card-title-sm">Site & Destek</h3>
            <p className="settings-note mb-3">
              Landing destek sayfasında gösterilecek Telegram kullanıcı adı. @ işareti olmadan yazın.
            </p>
            <div className="form-group">
              <label className="form-label">Telegram destek kullanıcı adı</label>
              <div className="input-affix">
                <span className="input-affix-slot">@</span>
                <input
                  className="form-input"
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value.replace(/^@+/, ""))}
                  disabled={settingsLoading || settingsSaving}
                  autoComplete="off"
                />
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveSiteSettings}
              disabled={settingsLoading || settingsSaving}
            >
              {settingsSaving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
          <div className="card mb-4">
            <h3 className="card-title-sm">POS Sağlayıcıları</h3>
            <p className="settings-note">
              Aktif yöntemler, min/max tutarlar ve varsayılan sağlayıcı POS Ayarları sayfasından yönetilir.
            </p>
            <Link href="/pos" className="btn btn-ghost">
              POS Ayarları →
            </Link>
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
