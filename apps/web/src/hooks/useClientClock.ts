"use client";

import { useEffect, useState } from "react";

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
};

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

export function useClientClock(locale = "tr-TR") {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return { dateLabel: "", timeLabel: "", combinedLabel: "" };
  }

  const dateLabel = now.toLocaleDateString(locale, DATE_FORMAT);
  const timeLabel = now.toLocaleTimeString(locale, TIME_FORMAT);
  return {
    dateLabel,
    timeLabel,
    combinedLabel: `${dateLabel} · ${timeLabel}`,
  };
}
