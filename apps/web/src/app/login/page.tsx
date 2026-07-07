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
      <div className="login-brand">
        <div className="login-brand-glow" aria-hidden />
        <div className="login-brand-content">
          <div className="login-logo">OP</div>
          <h1 className="login-brand-title">OnePOS</h1>
          <p className="login-brand-sub">Güvenli ödeme yönetim paneli</p>
          <ul className="login-trust">
            {TRUST.map((item) => (
              <li key={item.label}>
                <Icon name={item.icon} size={16} />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <div className="login-steps" aria-hidden>
            <span className={`login-step ${step === "password" ? "login-step--active" : "login-step--done"}`} />
            <span className={`login-step ${step === "2fa" ? "login-step--active" : ""}`} />
          </div>

          <div className="login-card-header">
            <p className="login-card-kicker">OnePOS Panel</p>
            <h2 className="login-panel-title">
              {step === "password" ? "Hesabınıza giriş yapın" : "İki adımlı doğrulama"}
            </h2>
            <p className="login-panel-hint">
              {step === "password"
                ? "Yönetim paneline erişmek için kullanıcı bilgilerinizi girin."
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
                Giriş yap
              </Button>
            </form>
          ) : (
            <form onSubmit={handle2fa} className="login-form" noValidate>
              <AuthField
                label="Doğrulama kodu"
                fieldType="otp"
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                hint="Google Authenticator veya benzeri uygulamadan alın."
                required
                disabled={loading}
              />
              <Button type="submit" variant="primary" loading={loading} className="login-submit">
                Doğrula ve devam et
              </Button>
              <Button type="button" variant="ghost" className="login-back" onClick={backToPassword} disabled={loading}>
                Farklı hesapla giriş yap
              </Button>
            </form>
          )}

          <p className="login-footer-note">
            Bu alan yalnızca yetkili kullanıcılar içindir. Tüm giriş denemeleri kayıt altına alınır.
          </p>
        </div>
      </div>
    </div>
  );
}
