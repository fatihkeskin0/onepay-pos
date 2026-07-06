"use client";

import { useEffect, useState } from "react";

/** True only after the component has mounted on the client (safe for locale/date/localStorage UI). */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
