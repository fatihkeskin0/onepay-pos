export function normalizeCidr(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!trimmed.includes("/")) {
    return ipToLong(trimmed) !== null ? trimmed : null;
  }

  const [ipPart, bitsPart] = trimmed.split("/");
  if (!ipPart || !bitsPart) return null;
  const bits = Number(bitsPart);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  if (ipToLong(ipPart) === null) return null;
  return `${ipPart}/${bits}`;
}

function ipToLong(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return null;
  if (parts.some((p) => p === undefined || !Number.isInteger(p) || p < 0 || p > 255)) return null;
  const a = parts[0] as number;
  const b = parts[1] as number;
  const c = parts[2] as number;
  const d = parts[3] as number;
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

export function ipMatchesCidr(clientIp: string, cidr: string): boolean {
  const normalized = normalizeCidr(cidr);
  if (!normalized) return false;

  if (!normalized.includes("/")) {
    return clientIp === normalized;
  }

  const [rangeIp, bitsStr] = normalized.split("/");
  const bits = Number(bitsStr);
  const ipLong = ipToLong(clientIp);
  const rangeLong = ipToLong(rangeIp ?? "");
  if (ipLong === null || rangeLong === null) return false;

  const mask = bits === 0 ? 0 : ((0xffffffff << (32 - bits)) >>> 0);
  return (ipLong & mask) === (rangeLong & mask);
}
