"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";

interface ClientSession {
  role: string | null;
  username: string;
}

/**
 * Reads localStorage session after mount so SSR and the first client render match.
 */
export function useClientSession() {
  const [session, setSession] = useState<ClientSession | null>(null);

  useEffect(() => {
    setSession({
      role: API.role(),
      username: API.username() ?? "",
    });
  }, []);

  return {
    /** Session has been read from localStorage (post-mount). */
    ready: session !== null,
    role: session?.role ?? null,
    username: session?.username ?? "",
    isAdmin: session?.role === "admin",
    isKasiyer: session?.role === "kasiyer",
  };
}
