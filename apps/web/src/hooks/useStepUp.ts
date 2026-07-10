"use client";

import { useCallback, useState } from "react";

export interface StepUpRequest {
  title: string;
  run: (totpCode: string) => Promise<void>;
  closeParent?: () => void;
}

export function useStepUp(onError?: (message: string) => void) {
  const [stepUp, setStepUp] = useState<StepUpRequest | null>(null);
  const [loading, setLoading] = useState(false);

  const requestStepUp = useCallback((req: StepUpRequest) => {
    req.closeParent?.();
    setStepUp({ title: req.title, run: req.run });
  }, []);

  const closeStepUp = useCallback(() => {
    if (loading) return;
    setStepUp(null);
  }, [loading]);

  const confirmStepUp = useCallback(
    async (totpCode: string) => {
      if (!stepUp) return;
      setLoading(true);
      try {
        await stepUp.run(totpCode);
        setStepUp(null);
      } catch (e) {
        onError?.(e instanceof Error ? e.message : "Hata");
      } finally {
        setLoading(false);
      }
    },
    [stepUp, onError],
  );

  return {
    stepUpOpen: stepUp !== null,
    stepUpTitle: stepUp?.title,
    stepUpLoading: loading,
    requestStepUp,
    closeStepUp,
    confirmStepUp,
  };
}
