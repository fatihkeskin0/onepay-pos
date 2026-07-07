export function parseOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

/** Hostname only (no port) — matches middleware requestHost(). */
export function parseHost(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const DEV_MARKETING_HOST = "localhost";
const DEV_PANEL_HOST = "app.localhost";
const DEV_MARKETING_ORIGIN = "http://localhost:3105";
const DEV_PANEL_ORIGIN = "http://app.localhost:3105";

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

export function resolvePanelOrigin(): string | null {
  return (
    parseOrigin(process.env.APP_BASE_URL) ??
    parseOrigin(process.env.SERVICE_URL_WEB) ??
    (isDev() ? DEV_PANEL_ORIGIN : null)
  );
}

export function resolveMarketingOrigin(): string | null {
  return (
    parseOrigin(process.env.APP_MARKETING_URL) ??
    parseOrigin(process.env.SERVICE_URL_MARKETING) ??
    (isDev() ? DEV_MARKETING_ORIGIN : null)
  );
}

export function resolvePaymentOrigin(): string | null {
  return (
    parseOrigin(process.env.APP_PAYMENT_URL) ??
    parseOrigin(process.env.SERVICE_URL_PAYMENT) ??
    resolvePanelOrigin()
  );
}

export function resolvePanelHost(): string | null {
  return (
    parseHost(process.env.APP_BASE_URL) ??
    parseHost(process.env.SERVICE_URL_WEB) ??
    (isDev() ? DEV_PANEL_HOST : null)
  );
}

export function resolveMarketingHost(): string | null {
  return (
    parseHost(process.env.APP_MARKETING_URL) ??
    parseHost(process.env.SERVICE_URL_MARKETING) ??
    (isDev() ? DEV_MARKETING_HOST : null)
  );
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

export function usesMarketingDomain(): boolean {
  const marketingHost = resolveMarketingHost();
  const panelHost = resolvePanelHost();
  return Boolean(marketingHost && panelHost && marketingHost !== panelHost);
}

/** Request hostname is the panel app (app.onekart.info / app.localhost). */
export function isPanelRequestHost(host: string): boolean {
  const panelHost = resolvePanelHost();
  if (panelHost && host === panelHost) return true;
  if (isDev() && (host === DEV_PANEL_HOST || host.startsWith("app."))) return true;
  return false;
}

/** Marketing and panel are separate — panel URLs always belong on APP_BASE_URL. */
export function shouldRedirectPanelRoutesToAppOrigin(): boolean {
  return usesMarketingDomain();
}

/** Request hostname is marketing (onekart.info / localhost). */
export function isMarketingRequestHost(host: string): boolean {
  const marketingHost = resolveMarketingHost();
  if (marketingHost && host === marketingHost) return true;
  if (isDev() && (host === DEV_MARKETING_HOST || host === "127.0.0.1")) return true;
  return false;
}
