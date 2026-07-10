const PUBLIC_AUTH_PATHS = new Set([
  "/cashier/login",
  "/cashier/verify_2fa",
  "/cashier/onboarding/setup",
  "/cashier/onboarding/verify",
]);

export function isPublicAuthPath(path: string): boolean {
  return PUBLIC_AUTH_PATHS.has(path);
}
