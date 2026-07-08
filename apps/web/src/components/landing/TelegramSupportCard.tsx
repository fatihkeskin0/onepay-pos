"use client";

import { useEffect, useState } from "react";
import { PublicAPI, type LandingInfo } from "@/lib/public-api";

interface TelegramSupportCardProps {
  variant?: "default" | "banner";
}

export function TelegramSupportCard({ variant = "default" }: TelegramSupportCardProps) {
  const [info, setInfo] = useState<LandingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    PublicAPI.getLandingInfo()
      .then(setInfo)
      .catch(() => setInfo({ telegram_support_username: null, telegram_url: null }))
      .finally(() => setLoading(false));
  }, []);

  const username = info?.telegram_support_username;
  const telegramUrl = info?.telegram_url;
  const isBanner = variant === "banner";

  return (
    <div className={`landing-support-card${isBanner ? " landing-support-card--banner" : ""}`}>
      <div className="landing-support-card-bg" aria-hidden>
        <span className="landing-support-card-orb landing-support-card-orb--1" />
        <span className="landing-support-card-orb landing-support-card-orb--2" />
        {isBanner ? <span className="landing-support-card-orb landing-support-card-orb--3" /> : null}
      </div>

      <div className="landing-support-card-content">
        <div className="landing-support-card-icon" aria-hidden>
          <svg width={isBanner ? 30 : 26} height={isBanner ? 30 : 26} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.022c.242-.213-.054-.334-.373-.121l-6.869 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.566-4.458c.538-.196 1.006.128.832.948z" />
          </svg>
        </div>

        <div className="landing-support-card-body">
          <span className="landing-support-card-badge">7/24 Aktif</span>
          <h3>Telegram Desteği</h3>
          <p>
            {isBanner
              ? "Genel sorgulamalar, işlem takibi ve teknik destek için anında yanıt alın."
              : "Genel sorgulamalar ve işlem takibi için anında yanıt."}
          </p>
        </div>

        <div className="landing-support-card-action">
          {loading ? (
            <span className="landing-support-card-muted">Yükleniyor…</span>
          ) : username && telegramUrl ? (
            <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="landing-support-card-cta">
              <span>@{username}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ) : (
            <span className="landing-support-card-muted">Destek kanalı henüz yapılandırılmadı.</span>
          )}
        </div>
      </div>
    </div>
  );
}
