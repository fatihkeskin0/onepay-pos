"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { StepUpModal } from "@/components/auth/StepUpModal";
import { useClientSession } from "@/hooks/useClientSession";

export default function SettingsPage() {
  const { notify } = useToast();
  const { ready, isAdmin } = useClientSession();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpLoading, setStepUpLoading] = useState(false);

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

  const requestPasswordChange = () => {
    if (newPassword !== confirmPassword) {
      notify("Şifreler eşleşmiyor", "error");
      return;
    }
    setStepUpOpen(true);
  };

  const confirmPasswordChange = async (totpCode: string) => {
    setStepUpLoading(true);
    try {
      await API.post("/cashier/change_password", {
        old_password: oldPassword,
        new_password: newPassword,
        totp_code: totpCode,
      });
      notify("Şifre değiştirildi", "success");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStepUpOpen(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    } finally {
      setStepUpLoading(false);
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
              Landing ana sayfasında gösterilecek Telegram kullanıcı adı. @ işareti olmadan yazın.
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
          <div className="card mb-4">
            <h3 className="card-title-sm">Güvenlik & Cloudflare</h3>
            <p className="settings-note mb-3">
              Güvenilir IP listesi, Cloudflare allow kuralları ve fail2ban export IP Yönetimi sayfasından yapılır.
            </p>
            <Link href="/security" className="btn btn-ghost">
              IP Yönetimi →
            </Link>
          </div>
        </>
      ) : (
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
          <button type="button" className="btn btn-primary" onClick={requestPasswordChange}>
            Şifreyi Güncelle
          </button>
        </div>
      )}

      <StepUpModal
        open={stepUpOpen}
        title="Şifre değiştir"
        loading={stepUpLoading}
        onClose={() => setStepUpOpen(false)}
        onConfirm={confirmPasswordChange}
      />
    </>
  );
}
