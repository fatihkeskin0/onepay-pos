"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { PublicAPI, type LandingInfo } from "@/lib/public-api";

function TelegramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  );
}

function SupportCardSkeleton() {
  return (
    <div className="landing-card landing-support-card landing-support-card--loading" aria-hidden>
      <span className="landing-support-skeleton-icon" />
      <div className="landing-support-body">
        <span className="landing-support-skeleton-line landing-support-skeleton-line--sm" />
        <span className="landing-support-skeleton-line" />
        <span className="landing-support-skeleton-line landing-support-skeleton-line--lg" />
      </div>
    </div>
  );
}

export function TelegramSupportCard() {
  const [info, setInfo] = useState<LandingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    PublicAPI.getLandingInfo()
      .then(setInfo)
      .catch(() => setInfo({ telegram_support_username: null, telegram_url: null }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <SupportCardSkeleton />;
  }

  const telegramUrl = info?.telegram_url;
  const username = info?.telegram_support_username;

  if (!telegramUrl || !username) {
    return (
      <div className="landing-card landing-support-card landing-support-card--empty">
        <div className="landing-support-icon" aria-hidden>
          <TelegramIcon />
        </div>
        <div className="landing-support-body">
          <span className="landing-support-kicker">Destek</span>
          <strong className="landing-support-title">Telegram kanalı</strong>
          <p className="landing-support-text">Destek kanalı henüz yapılandırılmadı.</p>
        </div>
      </div>
    );
  }

  return (
    <a
      href={telegramUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="landing-card landing-support-card"
      aria-label="Telegram destek kanalına git"
    >
      <div className="landing-support-icon" aria-hidden>
        <TelegramIcon />
      </div>
      <div className="landing-support-body">
        <span className="landing-support-kicker">Destek</span>
        <strong className="landing-support-title">@{username}</strong>
        <p className="landing-support-text">
          Entegrasyon ve operasyon sorularınız için doğrudan ekibimize ulaşın.
        </p>
      </div>
      <span className="landing-support-arrow" aria-hidden>
        <Icon name="chevron-down" size={16} className="landing-support-arrow-icon" />
      </span>
    </a>
  );
}
