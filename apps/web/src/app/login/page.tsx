"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LS_KEYS } from "@onepara/shared";
import { API } from "@/lib/api";
import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const TRUST = [
  { icon: "lock" as const, label: "256-bit SSL" },
  { icon: "shield" as const, label: "3D Secure" },
  { icon: "card" as const, label: "Kart ödemesi" },
];

type LoginStep = "password" | "2fa" | "setup";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<LoginStep>("password");
  const [partialToken, setPartialToken] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [setupQr, setSetupQr] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(LS_KEYS.token);
    if (token) {
      router.replace("/dashboard");
    }
  }, [router]);

  const finishLogin = (data: {
    token: string;
    role: string;
    username: string;
    theme?: string;
    log_id?: number;
  }) => {
    localStorage.setItem(LS_KEYS.token, data.token);
    localStorage.setItem(LS_KEYS.role, data.role);
    localStorage.setItem(LS_KEYS.username, data.username);
    if (data.log_id) localStorage.setItem(LS_KEYS.logId, String(data.log_id));
    const theme = data.theme ?? "light";
    localStorage.setItem(LS_KEYS.theme, theme);
    document.documentElement.setAttribute("data-theme", theme);
    router.push("/dashboard");
  };

  const loadSetup = async (token: string) => {
    const data = await API.post<{ secret: string; qr: string }>("/cashier/onboarding/setup", {
      partial_token: token,
    });
    setSetupSecret(data.secret);
    setSetupQr(data.qr);
    setCode("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await API.post<{
        token?: string;
        role?: string;
        username?: string;
        theme?: string;
        log_id?: number;
        requires_2fa?: boolean;
        requires_2fa_setup?: boolean;
        partial_token?: string;
      }>("/cashier/login", { username: username.trim(), password });

      if (data.requires_2fa_setup && data.partial_token) {
        setPartialToken(data.partial_token);
        setStep("setup");
        await loadSetup(data.partial_token);
        return;
      }

      if (data.requires_2fa && data.partial_token) {
        setPartialToken(data.partial_token);
        setStep("2fa");
        setCode("");
        return;
      }

      setError("Giriş tamamlanamadı. Lütfen tekrar deneyin.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  const handle2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await API.post<{
        token: string;
        role: string;
        username: string;
        theme?: string;
        log_id?: number;
      }>("/cashier/verify_2fa", { partial_token: partialToken, code: code.trim() });
      finishLogin(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Doğrulama kodu geçersiz");
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await API.post<{
        token: string;
        role: string;
        username: string;
        theme?: string;
        log_id?: number;
      }>("/cashier/onboarding/verify", { partial_token: partialToken, code: code.trim() });
      finishLogin(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Doğrulama kodu geçersiz");
    } finally {
      setLoading(false);
    }
  };

  const backToPassword = () => {
    setStep("password");
    setCode("");
    setPartialToken("");
    setSetupSecret("");
    setSetupQr("");
    setError("");
  };

  const stepTitle =
    step === "password" ? "Giriş yap" : step === "2fa" ? "Doğrulama kodu" : "2FA kurulumu";

  const stepLead =
    step === "password"
      ? "Panel erişimi için hesap bilgilerinizi girin."
      : step === "2fa"
        ? "Authenticator uygulamanızdaki 6 haneli kodu girin."
        : "Google Authenticator veya benzeri bir uygulama ile QR kodu tarayın, ardından kodu girin.";

  return (
    <div className="login-page">
      <div className="login-bg" aria-hidden>
        <div className="login-bg-glow login-bg-glow--a" />
        <div className="login-bg-glow login-bg-glow--b" />
      </div>

      <main className="login-shell">
        <header className="login-head">
          <div className="login-mark">OP</div>
          <div>
            <p className="login-head-title">OnePOS</p>
            <p className="login-head-sub">Ödeme yönetim paneli</p>
          </div>
        </header>

        <section className="login-card" aria-labelledby="login-heading">
          <div className="login-card-top">
            <div className="login-step-dots" aria-hidden>
              <span className={step === "password" ? "is-active" : "is-done"} />
              <span className={step !== "password" ? "is-active" : ""} />
            </div>
            <h1 id="login-heading" className="login-title">
              {stepTitle}
            </h1>
            <p className="login-lead">{stepLead}</p>
          </div>

          {error ? <AuthAlert message={error} /> : null}

          {step === "password" ? (
            <form onSubmit={handleLogin} className="login-form" noValidate>
              <AuthField
                label="Kullanıcı adı"
                fieldType="text"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                disabled={loading}
              />
              <AuthField
                label="Şifre"
                fieldType="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
              <Button type="submit" variant="primary" loading={loading} className="login-submit">
                Devam et
              </Button>
            </form>
          ) : step === "2fa" ? (
            <form onSubmit={handle2fa} className="login-form" noValidate>
              <AuthField
                label="6 haneli kod"
                fieldType="otp"
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                disabled={loading}
              />
              <Button type="submit" variant="primary" loading={loading} className="login-submit">
                Doğrula
              </Button>
              <button type="button" className="login-link-btn" onClick={backToPassword} disabled={loading}>
                ← Farklı hesap
              </button>
            </form>
          ) : (
            <form onSubmit={handleSetup} className="login-form" noValidate>
              {setupQr ? (
                <div className="qr-wrap">
                  <img src={setupQr} alt="2FA QR" width={180} height={180} />
                </div>
              ) : null}
              {setupSecret ? (
                <p className="settings-secret">Secret: {setupSecret}</p>
              ) : null}
              <AuthField
                label="6 haneli kod"
                fieldType="otp"
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                disabled={loading}
              />
              <Button type="submit" variant="primary" loading={loading} className="login-submit">
                Kurulumu tamamla
              </Button>
              <button type="button" className="login-link-btn" onClick={backToPassword} disabled={loading}>
                ← Farklı hesap
              </button>
            </form>
          )}
        </section>

        <ul className="login-trust">
          {TRUST.map((item) => (
            <li key={item.label}>
              <Icon name={item.icon} size={14} />
              {item.label}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
