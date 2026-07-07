"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LS_KEYS } from "@onepara/shared";
import { API } from "@/lib/api";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
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
    if (typeof window !== "undefined" && localStorage.getItem(LS_KEYS.token)) {
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
      }>("/cashier/login", { username, password });

      if (data.requires_2fa && data.partial_token) {
        setPartialToken(data.partial_token);
        setStep("2fa");
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

      setError("Giriş tamamlanamadı. Tekrar deneyin.");
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
      }>("/cashier/verify_2fa", { partial_token: partialToken, code });
      finishLogin(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Geçersiz kod");
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
          <div className="login-card-header">
            <p className="login-card-kicker">OnePOS Panel</p>
            <h2 className="login-panel-title">{step === "password" ? "Giriş yapın" : "Doğrulama kodu"}</h2>
            <p className="login-panel-hint">
              {step === "password"
                ? "Hesabınıza erişmek için bilgilerinizi girin."
                : "Authenticator uygulamanızdaki 6 haneli kodu girin."}
            </p>
          </div>

          {error ? <div className="login-error">{error}</div> : null}

          {step === "password" ? (
            <form onSubmit={handleLogin} className="login-form">
              <FormField label="Kullanıcı adı">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="kullaniciadi"
                  className="login-input"
                  required
                />
              </FormField>
              <FormField label="Şifre">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="login-input"
                  required
                />
              </FormField>
              <Button type="submit" variant="primary" loading={loading} className="login-submit">
                Giriş Yap
              </Button>
            </form>
          ) : (
            <form onSubmit={handle2fa} className="login-form">
              <FormField label="2FA kodu">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  className="login-input login-input--code"
                  required
                />
              </FormField>
              <Button type="submit" variant="primary" loading={loading} className="login-submit">
                Doğrula
              </Button>
              <Button type="button" variant="ghost" className="login-back" onClick={backToPassword}>
                Geri dön
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
