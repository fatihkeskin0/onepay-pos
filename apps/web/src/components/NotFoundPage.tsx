"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LS_KEYS } from "@onepara/shared";

interface NotFoundPageProps {
  variant?: "marketing" | "panel";
}

export function NotFoundPage({ variant = "marketing" }: NotFoundPageProps) {
  const [homeHref, setHomeHref] = useState(variant === "panel" ? "/login" : "/");

  useEffect(() => {
    if (variant !== "panel") return;
    const hasToken = Boolean(localStorage.getItem(LS_KEYS.token));
    setHomeHref(hasToken ? "/dashboard" : "/login");
  }, [variant]);

  const homeLabel = variant === "panel" ? "Panele dön" : "Ana sayfaya dön";

  return (
    <div className={`error-page ${variant === "panel" ? "error-page--panel" : ""}`.trim()}>
      <div className="error-card">
        <div className="error-code">404</div>
        <h1 className="error-title">Sayfa bulunamadı</h1>
        <p className="error-desc">
          Aradığınız adres mevcut değil veya taşınmış olabilir.
        </p>
        <Link href={homeHref} className="btn btn-primary">
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
