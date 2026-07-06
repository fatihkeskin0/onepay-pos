"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

function Mock3dsInner() {
  const params = useSearchParams();
  const depositId = params.get("deposit");
  const providerRef = params.get("pref") ?? "";
  const [loading, setLoading] = useState(false);

  const complete = async (success: boolean) => {
    setLoading(true);
    try {
      if (success) {
        await fetch("/backend/psp/mock/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deposit_id: depositId, provider_ref: providerRef }),
        });
      }
      window.close();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pay-page">
      <div className="pay-shell">
        <article className="pay-card">
          <header className="pay-card-header">
            <div className="pay-brand-row">
              <div className="pay-brand-icon">3DS</div>
              <div>
                <div className="pay-brand-name">Mock 3D Secure</div>
                <div className="pay-brand-meta">Geliştirme simülasyonu</div>
              </div>
            </div>
            <span className="pay-secure-badge">
              <Icon name="shield" size={12} />
              Test
            </span>
          </header>
          <div className="pay-card-body">
            <div className="pay-state">
              <div className="pay-state-icon pay-state-icon--loading">
                <Icon name="lock" size={32} />
              </div>
              <h2 className="pay-state-title">Banka doğrulaması</h2>
              <p className="pay-state-desc">
                Gerçek ortamda bu adımda bankanızın 3D Secure ekranı açılır. Test için sonucu seçin.
              </p>
              <div className="mock-3ds-actions mt-4">
                <Button variant="success" disabled={loading} onClick={() => complete(true)}>
                  Başarılı öde
                </Button>
                <Button variant="danger" disabled={loading} onClick={() => complete(false)}>
                  Başarısız
                </Button>
              </div>
            </div>
          </div>
          <footer className="pay-card-footer">
            <span className="pay-trust-item">
              <Icon name="lock" size={12} />
              Mock PSP
            </span>
          </footer>
        </article>
      </div>
    </div>
  );
}

export default function Mock3dsPage() {
  return (
    <Suspense>
      <Mock3dsInner />
    </Suspense>
  );
}
