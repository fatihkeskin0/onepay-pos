export function normalizeTelegramUsername(raw: string | null | undefined): string {
  const trimmed = String(raw ?? "").trim().replace(/^@+/, "");
  return trimmed.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 64);
}

export function isValidTelegramUsername(raw: string | null | undefined): boolean {
  const username = normalizeTelegramUsername(raw);
  return username.length >= 3 && username.length <= 32;
}
