"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LS_KEYS } from "@onepara/shared";
import { API } from "@/lib/api";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"password" | "2fa">("password");
  const [partialToken, setPartialToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const finishLogin = (data: {
    token: string;
    role: string;
    username: string;
    theme?: string;
    log_id?: number;
    sub_perms?: Record<string, boolean>;
  }) => {
    localStorage.setItem(LS_KEYS.token, data.token);
    localStorage.setItem(LS_KEYS.role, data.role);
    localStorage.setItem(LS_KEYS.username, data.username);
    if (data.log_id) localStorage.setItem(LS_KEYS.logId, String(data.log_id));
    if (data.theme) localStorage.setItem(LS_KEYS.theme, data.theme);
    if (data.sub_perms) localStorage.setItem(LS_KEYS.subPerms, JSON.stringify(data.sub_perms));
    router.push("/panel/dashboard");
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
        sub_perms?: Record<string, boolean>;
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
          sub_perms: data.sub_perms,
        });
      }
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

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-head">
          <div className="login-logo">OP</div>
          <h1 className="login-title">OnePOS</h1>
          <p className="login-sub">Kredi Kartı Yönetim Paneli</p>
        </div>
        <div className="login-body">
          {error ? <div className="login-error">{error}</div> : null}
          {step === "password" ? (
            <form onSubmit={handleLogin}>
              <FormField label="Kullanıcı Adı">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </FormField>
              <FormField label="Şifre">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </FormField>
              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
              </button>
            </form>
          ) : (
            <form onSubmit={handle2fa}>
              <FormField label="2FA Kodu">
                <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} required />
              </FormField>
              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? "Doğrulanıyor..." : "Doğrula"}
              </button>
            </form>
          )}
        </div>
        <div className="login-foot">Yetkisiz erişim yasaktır.</div>
      </div>
    </div>
  );
}
