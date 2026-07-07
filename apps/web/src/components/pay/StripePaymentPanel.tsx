"use client";

import { FormEvent, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";

interface StripeCheckoutFormProps {
  returnUrl: string;
  onError: (message: string) => void;
  onProcessing?: () => void;
}

function StripeCheckoutForm({ returnUrl, onError, onProcessing }: StripeCheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });
      if (error) {
        onError(error.message ?? "Ödeme tamamlanamadı");
      } else {
        onProcessing?.();
      }
    } catch {
      onError("Ödeme işlenemedi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="pay-stripe-form" onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit" className="pay-btn" disabled={!stripe || submitting}>
        {submitting ? (
          <>
            <Spinner size="md" />
            İşleniyor…
          </>
        ) : (
          <>
            <Icon name="lock" size={16} />
            Ödemeyi tamamla
          </>
        )}
      </button>
    </form>
  );
}

interface StripePaymentPanelProps {
  clientSecret: string;
  publishableKey: string;
  returnUrl: string;
  onError: (message: string) => void;
  onProcessing?: () => void;
}

export function StripePaymentPanel({
  clientSecret,
  publishableKey,
  returnUrl,
  onError,
  onProcessing,
}: StripePaymentPanelProps) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  if (!stripePromise) {
    return <div className="pay-alert pay-alert-error">Stripe yüklenemedi</div>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripeCheckoutForm returnUrl={returnUrl} onError={onError} onProcessing={onProcessing} />
    </Elements>
  );
}
