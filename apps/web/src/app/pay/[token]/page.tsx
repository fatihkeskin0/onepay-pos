"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { StripePaymentPanel } from "@/components/pay/StripePaymentPanel";
import { resolveBrandLogoUrl } from "@/lib/brand-logo";
import { PayAPI, PayApiError, type PayLimits, type PaySessionInfo, type PspRenderMode } from "@/lib/pay-api";

type PayState = "entry" | "ready" | "pending" | "success" | "rejected" | "expired";
type PayTheme = "light" | "dark";

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
  const [session, setSession] = useState<PaySessionInfo | null>(null);
  const [paymentReady, setPaymentReady] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [limits, setLimits] = useState<PayLimits | null>(null);
  const [amount, setAmount] = useState(0);
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

  const brand = session?.brand ?? {
    color: "#2563EB",
    bg: "#F4F7FC",
    theme: "light" as PayTheme,
    logo: null,
    name: "OnePOS",
  };
  const brandLogoSrc = resolveBrandLogoUrl(brand.logo);
  const payTheme = brand.theme === "dark" ? "dark" : "light";

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
        const data = await PayAPI.getPosMethods(token);
        setSession(data.session);
        setPaymentReady(data.payment_ready);
        setLimits(data.limits);
        setUnavailableReason(data.unavailable_reason ?? null);
        setAmount(data.session.amount);
      } catch (e) {
        if (e instanceof PayApiError && e.payState === "expired") {
          setPayError(e.message);
          setState("expired");
          setProgress(100);
          return;
        }
        setPayError(e instanceof Error ? e.message : "Oturum yüklenemedi");
        setState("expired");
        setProgress(100);
      } finally {
        setLoadingInit(false);
      }
    };
    load();
  }, [token]);

  const pollStatus = useCallback(async (ref: string, tok: string) => {
    try {
      const data = await PayAPI.getDepositStatus(ref, tok);
      if (data.status === "approved") {
        setState("success");
        setProgress(100);
      } else if (data.status === "rejected") {
        setState("rejected");
        setRejectReason(data.reject_reason ?? "");
        setProgress(100);
      } else if (data.status === "cancelled") {
        setState("expired");
        setPayError("Ödeme oturumunun süresi doldu veya iptal edildi.");
        setProgress(100);
      }
    } catch {
      /* ignore polling errors */
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
    if (amount <= 0) return false;
    if (!limits) return paymentReady;
    return amount >= limits.min && amount <= limits.max;
  }, [amount, limits, paymentReady]);

  const startPayment = async () => {
    if (!paymentReady) {
      setPayError(unavailableReason ?? "Ödeme altyapısı şu an kullanılamıyor");
      return;
    }
    if (!amount || amount <= 0) {
      setPayError("Geçerli tutar girin");
      return;
    }

    setState("ready");
    setProgress(55);
    setPayError("");

    try {
      const data = await PayAPI.createDeposit(token, amount);
      const mode = data.render_mode ?? (data.redirect_url ? "redirect" : "iframe");
      setDepositRef(data.reference);
      setDepositToken(data.token);
      setRenderMode(mode);
      setIframeUrl(data.iframe_url ?? null);
      setRedirectUrl(data.redirect_url ?? null);
      setClientSecret(data.client_secret ?? null);
      setPublishableKey(data.publishable_key ?? null);
      setProvider(data.provider ?? null);
      setState("pending");
      setProgress(78);

      if (mode === "redirect" && data.redirect_url) {
        window.location.href = data.redirect_url;
      }
    } catch (e) {
      if (e instanceof PayApiError) {
        setPayError(e.message);
        if (e.payState === "expired") {
          setState("expired");
          setProgress(100);
          return;
        }
        if (e.payState === "pending") {
          setState("entry");
          setProgress(33);
          return;
        }
      } else {
        setPayError(e instanceof Error ? e.message : "Bir hata oluştu");
      }
      setState("entry");
      setProgress(33);
    }
  };

  const stripeReturnUrl =
    typeof window !== "undefined" && depositRef && depositToken
      ? `${window.location.origin}/pay/${token}?dref=${encodeURIComponent(depositRef)}&dtoken=${encodeURIComponent(depositToken)}`
      : "";

  const displayAmount = useMemo(() => formatAmount(amount || 0), [amount]);

  return (
    <div
      className="pay-page"
      data-pay-theme={payTheme}
      style={
        {
          "--pay-accent": brand.color,
          "--pay-accent-dark": brandDarken(brand.color),
          "--pay-bg": brand.bg,
          "--pay-progress": `${progress}%`,
        } as CSSProperties
      }
    >
      <div className="pay-shell">
        <article className="pay-card">
          <header className="pay-card-header">
            <div className="pay-header-bar">
              <span className="pay-secure-badge">
                <Icon name="shield" size={12} />
                Güvenli
              </span>
            </div>
            <div className={`pay-brand-center${brandLogoSrc ? " pay-brand-center--logo" : ""}`}>
              {brandLogoSrc ? (
                <>
                  <img className="pay-brand-logo" src={brandLogoSrc} alt={brand.name} />
                  <div className="pay-brand-meta">Kredi kartı yatırım</div>
                </>
              ) : (
                <>
                  <div className="pay-brand-fallback">{brand.name.slice(0, 2).toUpperCase()}</div>
                  <div className="pay-brand-name">{brand.name}</div>
                  <div className="pay-brand-meta">Kredi kartı yatırım</div>
                </>
              )}
            </div>
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

                {!paymentReady ? (
                  <div className="pay-alert pay-alert-error">
                    {unavailableReason ?? "Ödeme altyapısı aktif değil. Lütfen daha sonra tekrar deneyin."}
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
