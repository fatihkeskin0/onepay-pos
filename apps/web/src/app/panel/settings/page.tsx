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

  interface CfRecordStatus {
    hostname: string;
    recordName: string;
    exists: boolean;
    type?: string;
    content?: string;
    proxied?: boolean;
    matchesOrigin: boolean;
    proxiedOk: boolean;
  }

  interface CfZoneStatus {
    id: string;
    domain: string;
    sslMode: string | null;
    sslOk: boolean;
    alwaysHttps: boolean | null;
    alwaysHttpsOk: boolean;
    records: CfRecordStatus[];
  }

  interface CfStatus {
    configured: boolean;
    tokenValid: boolean;
    originIp: string;
    autoSync: boolean;
    zones: CfZoneStatus[];
    errors: string[];
  }

  const [cfStatus, setCfStatus] = useState<CfStatus | null>(null);
  const [cfLoading, setCfLoading] = useState(false);
  const [cfSyncing, setCfSyncing] = useState(false);

  const loadCloudflareStatus = async () => {
    setCfLoading(true);
    try {
      const data = await API.get<CfStatus>("/admin/cloudflare/status");
      setCfStatus(data);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Cloudflare durumu alınamadı", "error");
    } finally {
      setCfLoading(false);
    }
  };

  const syncCloudflare = async (opts: { dns?: boolean; ssl?: boolean }) => {
    setCfSyncing(true);
    try {
      const result = await API.post<{
        dns: { created: number; updated: number; skipped: number; errors: string[] };
        ssl: { updated: number; errors: string[] };
      }>("/admin/cloudflare/sync", opts);
      const parts: string[] = [];
      if (opts.dns !== false) parts.push(`DNS: ${result.dns.created} yeni, ${result.dns.updated} güncellendi`);
      if (opts.ssl !== false) parts.push(`SSL: ${result.ssl.updated} ayar güncellendi`);
      const allErrors = [...(result.dns?.errors ?? []), ...(result.ssl?.errors ?? [])];
      if (allErrors.length > 0) {
        notify(`${parts.join(" · ")} — ${allErrors.length} hata`, "error");
      } else {
        notify(parts.join(" · ") || "Senkron tamamlandı", "success");
      }
      await loadCloudflareStatus();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Senkron başarısız", "error");
    } finally {
      setCfSyncing(false);
    }
  };

  useEffect(() => {
    if (!ready || !isAdmin) return;
    setSettingsLoading(true);
    API.get<{ settings: Record<string, string> }>("/admin/settings")
      .then((d) => setTelegramUsername(d.settings.telegram_support_username ?? ""))
      .catch(() => undefined)
      .finally(() => setSettingsLoading(false));
    loadCloudflareStatus();
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
          <div className="card mb-4">
            <div className="flex-row flex-end mb-3">
              <h3 className="card-title-sm" style={{ flex: 1 }}>Cloudflare</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={loadCloudflareStatus}
                disabled={cfLoading || cfSyncing}
              >
                {cfLoading ? "Yükleniyor…" : "Yenile"}
              </button>
            </div>
            <p className="settings-note mb-3">
              DNS kayıtları turuncu bulut (proxied) ile origin IP&apos;ye yönlendirilir. SSL: Full (strict) + Always HTTPS.
            </p>
            {cfStatus && (
              <>
                <div className="settings-note mb-3">
                  Token: {cfStatus.tokenValid ? "geçerli" : "geçersiz veya eksik"}
                  {" · "}
                  Yapılandırma: {cfStatus.configured ? "tamam" : "eksik"}
                  {cfStatus.originIp ? ` · Origin: ${cfStatus.originIp}` : ""}
                  {cfStatus.autoSync ? " · Otomatik senkron: açık" : ""}
                </div>
                {cfStatus.errors.length > 0 && (
                  <div className="settings-note mb-3" style={{ color: "var(--danger, #c0392b)" }}>
                    {cfStatus.errors.join(" · ")}
                  </div>
                )}
                {cfStatus.zones.map((zone) => (
                  <div key={zone.id} className="mb-4">
                    <div className="font-medium mb-2">
                      {zone.domain}
                      {" — SSL: "}
                      {zone.sslMode ?? "?"}
                      {zone.sslOk ? " ✓" : " (strict bekleniyor)"}
                      {" · HTTPS: "}
                      {zone.alwaysHttpsOk ? "açık ✓" : "kapalı"}
                    </div>
                    {zone.records.length === 0 ? (
                      <p className="settings-note">Bu zone için beklenen kayıt yok.</p>
                    ) : (
                      <div className="table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Host</th>
                              <th>Tip</th>
                              <th>Hedef</th>
                              <th>Proxy</th>
                              <th>Durum</th>
                            </tr>
                          </thead>
                          <tbody>
                            {zone.records.map((rec) => (
                              <tr key={rec.hostname}>
                                <td>{rec.hostname}</td>
                                <td>{rec.exists ? rec.type : "—"}</td>
                                <td>{rec.content ?? "—"}</td>
                                <td>{rec.proxiedOk ? "Proxied" : rec.exists ? "DNS only" : "—"}</td>
                                <td>
                                  {!rec.exists
                                    ? "Eksik"
                                    : rec.matchesOrigin && rec.proxiedOk
                                      ? "OK"
                                      : "Güncelleme gerekli"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
            <div className="flex-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => syncCloudflare({ dns: true, ssl: true })}
                disabled={cfLoading || cfSyncing || !cfStatus?.configured}
              >
                {cfSyncing ? "Senkronize…" : "Tam Senkron"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => syncCloudflare({ dns: true, ssl: false })}
                disabled={cfLoading || cfSyncing || !cfStatus?.configured}
              >
                Sadece DNS
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => syncCloudflare({ dns: false, ssl: true })}
                disabled={cfLoading || cfSyncing || !cfStatus?.configured}
              >
                Sadece SSL
              </button>
            </div>
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
