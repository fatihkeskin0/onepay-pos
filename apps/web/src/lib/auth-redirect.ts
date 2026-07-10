let redirecting = false;
let loginRedirectHandler: (() => void) | null = null;

export function registerLoginRedirect(handler: () => void): void {
  loginRedirectHandler = handler;
}

export function unregisterLoginRedirect(): void {
  loginRedirectHandler = null;
}

export function redirectToLogin(): void {
  if (typeof window === "undefined" || redirecting) return;
  redirecting = true;

  if (loginRedirectHandler) {
    loginRedirectHandler();
    return;
  }

  window.location.replace("/login");
}

export function resetLoginRedirectGuard(): void {
  redirecting = false;
}
