"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { StripePaymentPanel } from "@/components/pay/StripePaymentPanel";

type PayState = "entry" | "ready" | "pending" | "success" | "rejected" | "expired";
type PspRenderMode = "redirect" | "iframe" | "stripe_elements";

interface PayLimits {
  min: number;
  max: number;
}

interface SessionInfo {
  token: string;
  amount: number;
  amount_editable: boolean;
  user_name: string;
  site_name: string;
  brand: { color: string; bg: string; logo: string | null; name: string };
}

function brandDarken(hex: string, factor = 0.82): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function formatAmount(val: number) {
  return val.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

function PaySteps({ state }: { state: PayState }) {
  const step = state === "entry" || state === "ready" ? 1 : state === "pending" ? 2 : 3;

  const items = [
    { n: 1, label: "Tutar" },
    { n: 2, label: "Ödeme" },
    { n: 3, label: "Sonuç" },
  ];

  return (
    <div className="pay-steps" aria-label="Ödeme adımları">
      {items.map((item) => {
        const done = item.n < step;
        const active = item.n === step;
        return (
          <div key={item.n} className={`pay-step ${active ? "active" : ""} ${done ? "done" : ""}`.trim()}>
            <div className="pay-step-dot">{done ? "✓" : item.n}</div>
            <span className="pay-step-label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function PayPage() {
  const params = useParams();
  const token = String(params.token ?? "");
  const [state, setState] = useState<PayState>("entry");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [paymentReady, setPaymentReady] = useState(false);
  const [limits, setLimits] = useState<PayLimits | null>(null);
  const [amount, setAmount] = useState(0);
  const [amountInput, setAmountInput] = useState("");
  const [depositRef, setDepositRef] = useState("");
  const [depositToken, setDepositToken] = useState("");
  const [renderMode, setRenderMode] = useState<PspRenderMode | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [progress, setProgress] = useState(20);
  const [payError, setPayError] = useState("");
  const [loadingInit, setLoadingInit] = useState(true);
  const [stripeProcessing, setStripeProcessing] = useState(false);

  const brand = session?.brand ?? { color: "#2563EB", bg: "#F4F7FC", logo: null, name: "OnePOS" };

  useEffect(() => {
    document.documentElement.style.setProperty("--pay-accent", brand.color);
    document.documentElement.style.setProperty("--pay-accent-dark", brandDarken(brand.color));
    document.documentElement.style.setProperty("--pay-bg", brand.bg);
  }, [brand]);

  useEffect(() => {
    document.documentElement.style.setProperty("--pay-progress", `${progress}%`);
  }, [progress]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const dref = params.get("dref");
    const dtoken = params.get("dtoken");
    if (dref && dtoken) {
      setDepositRef(dref);
      setDepositToken(dtoken);
      setState("pending");
      setProgress(78);
      setStripeProcessing(true);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/backend/user/pos_methods?token=${encodeURIComponent(token)}`);
        const json = (await res.json()) as {
          success: boolean;
          message?: string;
          data?: { session: SessionInfo; payment_ready: boolean; limits: PayLimits | null };
        };
        if (!json.success || !json.data) {
          setPayError(json.message ?? "Oturum yüklenemedi");
          setState("expired");
          setProgress(100);
          return;
        }
        setSession(json.data.session);
        setPaymentReady(json.data.payment_ready);
        setLimits(json.data.limits);
        const fixed = json.data.session.amount;
        if (fixed > 0) {
          setAmount(fixed);
          setAmountInput(String(fixed));
        }
      } catch {
        setPayError("Sunucuya ulaşılamıyor");
        setState("expired");
      } finally {
        setLoadingInit(false);
      }
    };
    load();
  }, [token]);

  const effectiveAmount = session?.amount_editable ? Number(amountInput) || 0 : amount;

  const pollStatus = useCallback(async (ref: string, tok: string) => {
    try {
      const res = await fetch(`/backend/user/deposit_status?ref=${ref}&token=${tok}`);
      const json = (await res.json()) as {
        success: boolean;
        data: { status: string; reject_reason?: string };
      };
      if (!json.success) return;
      if (json.data.status === "approved") {
        setState("success");
        setProgress(100);
      } else if (json.data.status === "rejected") {
        setState("rejected");
        setRejectReason(json.data.reject_reason ?? "");
        setProgress(100);
      } else if (json.data.status === "cancelled") {
        setState("expired");
        setProgress(100);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (state !== "pending" || !depositRef || !depositToken) return;
    const id = setInterval(() => pollStatus(depositRef, depositToken), 5000);
    return () => clearInterval(id);
  }, [state, depositRef, depositToken, pollStatus]);

  useEffect(() => {
    if (state !== "pending" || renderMode !== "iframe" || provider !== "paytr" || !iframeUrl) return;

    const script = document.createElement("script");
    script.src = "https://www.paytr.com/js/iframeResizer.min.js";
    script.async = true;
    script.onload = () => {
      const w = window as Window & { iFrameResize?: (opts: object, selector: string) => void };
      w.iFrameResize?.({}, "#pay-psp-iframe");
    };
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [state, renderMode, provider, iframeUrl]);

  const isAmountValid = useMemo(() => {
    if (effectiveAmount <= 0) return false;
    if (!limits) return paymentReady;
    return effectiveAmount >= limits.min && effectiveAmount <= limits.max;
  }, [effectiveAmount, limits, paymentReady]);

  const startPayment = async () => {
    if (!paymentReady) {
      setPayError("Ödeme altyapısı şu an kullanılamıyor");
      return;
    }
    const payAmount = session?.amount_editable ? Number(amountInput) : amount;
    if (!payAmount || payAmount <= 0) {
      setPayError("Geçerli tutar girin");
      return;
    }

    setState("ready");
    setProgress(55);
    setPayError("");
    setAmount(payAmount);

    try {
      const res = await fetch("/backend/user/create_deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: token,
          amount: payAmount,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        data?: {
          reference: string;
          token: string;
          amount: number;
          redirect_url?: string | null;
          render_mode?: PspRenderMode;
          iframe_url?: string | null;
          client_secret?: string | null;
          publishable_key?: string | null;
          provider?: string;
        };
      };
      if (!json.success || !json.data) {
        setPayError(json.message ?? "Hata");
        setState("entry");
        setProgress(33);
        return;
      }
      const mode = json.data.render_mode ?? (json.data.redirect_url ? "redirect" : "iframe");
      setDepositRef(json.data.reference);
      setDepositToken(json.data.token);
      setRenderMode(mode);
      setIframeUrl(json.data.iframe_url ?? null);
      setRedirectUrl(json.data.redirect_url ?? null);
      setClientSecret(json.data.client_secret ?? null);
      setPublishableKey(json.data.publishable_key ?? null);
      setProvider(json.data.provider ?? null);
      setState("pending");
      setProgress(78);

      if (mode === "redirect" && json.data.redirect_url) {
        window.location.href = json.data.redirect_url;
      }
    } catch {
      setPayError("Sunucuya ulaşılamıyor");
      setState("entry");
      setProgress(33);
    }
  };

  const stripeReturnUrl =
    typeof window !== "undefined" && depositRef && depositToken
      ? `${window.location.origin}/pay/${token}?dref=${encodeURIComponent(depositRef)}&dtoken=${encodeURIComponent(depositToken)}`
      : "";

  const displayAmount = useMemo(() => formatAmount(effectiveAmount || 0), [effectiveAmount]);

  return (
    <div className="pay-page">
      <div className="pay-shell">
        <article className="pay-card">
          <header className="pay-card-header">
            <div className="pay-brand-row">
              <div className="pay-brand-icon">
                {brand.logo ? (
                  <img src={brand.logo} alt="" width={40} height={40} />
                ) : (
                  brand.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <div className="pay-brand-name">{brand.name}</div>
                <div className="pay-brand-meta">Kredi kartı yatırım</div>
              </div>
            </div>
            <span className="pay-secure-badge">
              <Icon name="shield" size={12} />
              Güvenli
            </span>
          </header>

          <PaySteps state={state} />

          <div className="pay-progress-track">
            <div className="pay-progress-bar" />
          </div>

          <div className="pay-amount-block">
            <div className="pay-amount-label">Ödenecek tutar</div>
            <div className="pay-amount-value">
              {displayAmount}
              <span className="pay-amount-currency">₺</span>
            </div>
            {session?.user_name ? (
              <div className="pay-user-chip">{session.user_name}</div>
            ) : null}
          </div>

          <div className="pay-card-body">
            {loadingInit ? (
              <div className="pay-state">
                <div className="pay-state-icon pay-state-icon--loading">
                  <Spinner size="lg" />
                </div>
                <h2 className="pay-state-title">Oturum hazırlanıyor</h2>
                <p className="pay-state-desc">Ödeme bilgileriniz yükleniyor…</p>
              </div>
            ) : null}

            {!loadingInit && state === "entry" ? (
              <>
                <p className="pay-intro">
                  Tutarınızı onaylayın ve güvenli ödeme adımına geçin.
                </p>

                {session?.amount_editable ? (
                  <div className="pay-amount-field">
                    <div className="pay-section-title">Yatırım tutarı</div>
                    <Input
                      type="number"
                      min={limits?.min ?? 0}
                      max={limits?.max}
                      step={1}
                      value={amountInput}
                      onChange={(e) => {
                        setAmountInput(e.target.value);
                        setPayError("");
                      }}
                      placeholder="0"
                      aria-label="Yatırım tutarı"
                    />
                    <span className="pay-amount-suffix">₺</span>
                    {limits ? (
                      <p className="text-xs text-muted" style={{ marginTop: 8 }}>
                        Limit: {limits.min.toLocaleString("tr-TR")} – {limits.max.toLocaleString("tr-TR")} ₺
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {!paymentReady ? (
                  <div className="pay-alert pay-alert-error">
                    Ödeme altyapısı aktif değil. Lütfen daha sonra tekrar deneyin.
                  </div>
                ) : null}

                {payError ? <div className="pay-alert pay-alert-error">{payError}</div> : null}

                <button
                  type="button"
                  className="pay-btn"
                  onClick={startPayment}
                  disabled={!paymentReady || !isAmountValid}
                >
                  <Icon name="lock" size={16} />
                  Güvenli ödemeye geç
                </button>
              </>
            ) : null}

            {state === "pending" ? (
              <>
                {renderMode === "iframe" && iframeUrl ? (
                  <div className="pay-embed">
                    <p className="pay-intro">Kart bilgilerinizi güvenli ödeme penceresinde girin.</p>
                    <iframe
                      id="pay-psp-iframe"
                      src={iframeUrl}
                      title="Güvenli ödeme"
                      className="pay-embed-iframe"
                      scrolling="no"
                    />
                  </div>
                ) : null}

                {renderMode === "stripe_elements" && stripeProcessing ? (
                  <div className="pay-state">
                    <div className="pay-state-icon pay-state-icon--loading">
                      <Spinner size="lg" />
                    </div>
                    <h2 className="pay-state-title">Ödeme işleniyor</h2>
                    <p className="pay-state-desc">Banka doğrulaması bekleniyor. Bu pencereyi kapatmayın.</p>
                  </div>
                ) : null}

                {renderMode === "stripe_elements" && !stripeProcessing && clientSecret && publishableKey ? (
                  <div className="pay-embed">
                    <p className="pay-intro">Kart bilgilerinizi aşağıdaki güvenli formda girin.</p>
                    {payError ? <div className="pay-alert pay-alert-error">{payError}</div> : null}
                    <StripePaymentPanel
                      clientSecret={clientSecret}
                      publishableKey={publishableKey}
                      returnUrl={stripeReturnUrl}
                      onError={setPayError}
                      onProcessing={() => setStripeProcessing(true)}
                    />
                  </div>
                ) : null}

                {renderMode === "redirect" || (!renderMode && !iframeUrl && !clientSecret) ? (
                  <div className="pay-state">
                    <div className="pay-state-icon pay-state-icon--loading">
                      <Spinner size="lg" />
                    </div>
                    <h2 className="pay-state-title">Ödeme işleniyor</h2>
                    <p className="pay-state-desc">
                      {redirectUrl
                        ? "3D Secure sayfasına yönlendiriliyorsunuz…"
                        : "Banka doğrulaması bekleniyor. Bu pencereyi kapatmayın."}
                    </p>
                  </div>
                ) : null}

                {renderMode === "iframe" || renderMode === "stripe_elements" ? (
                  <p className="pay-pending-note">Ödeme tamamlanana kadar bu sayfayı kapatmayın.</p>
                ) : null}
              </>
            ) : null}

            {state === "success" ? (
              <div className="pay-state pay-success">
                <div className="pay-state-icon pay-state-icon--success">
                  <Icon name="success" size={36} />
                </div>
                <h2 className="pay-state-title">Ödeme başarılı</h2>
                <p className="pay-state-desc">
                  {formatAmount(amount)} ₺ tutarındaki yatırımınız onaylandı ve hesabınıza yansıtıldı.
                </p>
              </div>
            ) : null}

            {state === "rejected" ? (
              <div className="pay-state pay-rejected">
                <div className="pay-state-icon pay-state-icon--error">
                  <Icon name="reject" size={36} />
                </div>
                <h2 className="pay-state-title">Ödeme reddedildi</h2>
                <p className="pay-state-desc">{rejectReason || "İşlem banka tarafından tamamlanamadı."}</p>
              </div>
            ) : null}

            {state === "expired" ? (
              <div className="pay-state">
                <div className="pay-state-icon pay-state-icon--warn">
                  <Icon name="pending" size={36} />
                </div>
                <h2 className="pay-state-title">Oturum sona erdi</h2>
                <p className="pay-state-desc">{payError || "Ödeme oturumunun süresi doldu veya geçersiz."}</p>
              </div>
            ) : null}
          </div>

          <footer className="pay-card-footer">
            <span className="pay-trust-item">
              <Icon name="lock" size={12} />
              256-bit SSL
            </span>
            <span className="pay-trust-item">
              <Icon name="shield" size={12} />
              3D Secure
            </span>
          </footer>
        </article>

        <p className="pay-page-footer">
          Powered by <strong>OnePOS</strong> · Güvenli kredi kartı altyapısı
        </p>
      </div>
    </div>
  );
}
