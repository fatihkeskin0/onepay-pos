"use client";

import { useSessionContext } from "@/providers/SessionProvider";

/**
 * Panel session from SessionProvider (single source of truth after mount).
 */
export function useClientSession() {
  const { ready, role, username, isAdmin, isKasiyer, token, badges } = useSessionContext();

  return {
    ready,
    role,
    username,
    isAdmin,
    isKasiyer,
    token,
    badges,
  };
}
