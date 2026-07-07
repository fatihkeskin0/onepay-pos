export function parseOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function parseHost(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).host.toLowerCase();
  } catch {
    return null;
  }
}

export function resolvePanelOrigin(): string | null {
  return parseOrigin(process.env.APP_BASE_URL) ?? parseOrigin(process.env.SERVICE_URL_WEB);
}

export function resolvePaymentOrigin(): string | null {
  return (
    parseOrigin(process.env.APP_PAYMENT_URL) ??
    parseOrigin(process.env.SERVICE_URL_PAYMENT) ??
    resolvePanelOrigin()
  );
}

export function resolvePanelHost(): string | null {
  return parseHost(process.env.APP_BASE_URL) ?? parseHost(process.env.SERVICE_URL_WEB);
}

export function resolvePaymentHost(): string | null {
  return (
    parseHost(process.env.APP_PAYMENT_URL) ??
    parseHost(process.env.SERVICE_URL_PAYMENT) ??
    resolvePanelHost()
  );
}

export function usesSplitPublicDomains(): boolean {
  const panelHost = resolvePanelHost();
  const paymentHost = resolvePaymentHost();
  return Boolean(panelHost && paymentHost && panelHost !== paymentHost);
}
