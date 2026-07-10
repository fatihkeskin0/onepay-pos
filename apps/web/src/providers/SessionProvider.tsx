"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LS_KEYS } from "@onepara/shared";

export interface SessionState {
  ready: boolean;
  token: string | null;
  role: string | null;
  username: string;
  isAdmin: boolean;
  isKasiyer: boolean;
  badges: Record<string, number>;
}

interface SessionContextValue extends SessionState {
  setBadges: (badges: Record<string, number>) => void;
  refreshSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function readSessionFromStorage(): Omit<SessionState, "ready" | "badges"> {
  if (typeof window === "undefined") {
    return { token: null, role: null, username: "", isAdmin: false, isKasiyer: false };
  }
  const role = localStorage.getItem(LS_KEYS.role);
  return {
    token: localStorage.getItem(LS_KEYS.token),
    role,
    username: localStorage.getItem(LS_KEYS.username) ?? "",
    isAdmin: role === "admin",
    isKasiyer: role === "kasiyer",
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState>({
    ready: false,
    token: null,
    role: null,
    username: "",
    isAdmin: false,
    isKasiyer: false,
    badges: {},
  });

  const refreshSession = useCallback(() => {
    const stored = readSessionFromStorage();
    setSession((prev) => ({ ...prev, ...stored, ready: true }));
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const setBadges = useCallback((badges: Record<string, number>) => {
    setSession((prev) => ({ ...prev, badges }));
  }, []);

  const value = useMemo(
    () => ({
      ...session,
      setBadges,
      refreshSession,
    }),
    [session, setBadges, refreshSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSessionContext must be used within SessionProvider");
  }
  return ctx;
}
