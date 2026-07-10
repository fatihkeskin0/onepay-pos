"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  registerLoginRedirect,
  resetLoginRedirectGuard,
  unregisterLoginRedirect,
} from "@/lib/auth-redirect";

export function AuthRedirectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    registerLoginRedirect(() => {
      router.replace("/login");
    });
    resetLoginRedirectGuard();

    return () => {
      unregisterLoginRedirect();
    };
  }, [router]);

  return <>{children}</>;
}
