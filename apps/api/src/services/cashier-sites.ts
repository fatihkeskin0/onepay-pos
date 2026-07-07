import { prisma } from "@onepara/db";
import type { TokenPayload } from "@onepara/shared";

export async function getCashierSiteIds(user: TokenPayload): Promise<number[] | "all"> {
  if (user.role === "admin") return "all";

  const links = await prisma.cashierSite.findMany({
    where: { cashierId: user.id },
    select: { siteId: true },
  });

  if (links.length > 0) {
    return links.map((l) => l.siteId);
  }

  if (user.site_id) return [user.site_id];
  return [];
}

export async function cashierCanAccessSite(
  user: TokenPayload,
  siteId: number | null | undefined,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (!siteId) return false;

  const allowed = await getCashierSiteIds(user);
  if (allowed === "all") return true;
  return allowed.includes(siteId);
}
