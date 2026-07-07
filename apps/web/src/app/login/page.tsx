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

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"password" | "2fa">("password");
  const [partialToken, setPartialToken] = useState("");
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
        partial_token?: string;
      }>("/cashier/login", { username: username.trim(), password });

      if (data.requires_2fa && data.partial_token) {
        setPartialToken(data.partial_token);
        setStep("2fa");
        setCode("");
        return;
      }

      if (data.token && data.role && data.username) {
        finishLogin({
          token: data.token,
          role: data.role,
          username: data.username,
          theme: data.theme,
          log_id: data.log_id,
        });
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

  const backToPassword = () => {
    setStep("password");
    setCode("");
    setPartialToken("");
    setError("");
  };

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
              <span className={step === "2fa" ? "is-active" : ""} />
            </div>
            <h1 id="login-heading" className="login-title">
              {step === "password" ? "Giriş yap" : "Doğrulama kodu"}
            </h1>
            <p className="login-lead">
              {step === "password"
                ? "Panel erişimi için hesap bilgilerinizi girin."
                : "Authenticator uygulamanızdaki 6 haneli kodu girin."}
            </p>
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
          ) : (
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
