"use client";

import { useEffect, useState } from "react";

const FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
};

/** Locale date string for "today" — computed only on the client to avoid hydration mismatch. */
export function useClientTodayLabel(locale = "tr-TR"): string {
  const [label, setLabel] = useState("");

  useEffect(() => {
    setLabel(new Date().toLocaleDateString(locale, FORMAT));
  }, [locale]);

  return label;
}
