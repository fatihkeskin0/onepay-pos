import type { FastifyRequest } from "fastify";
import { error } from "../response.js";
import { getClientIp } from "../rate-limit.js";
import { isPanelAccessEnabled, isPanelIpAllowed } from "./panel-whitelist.js";

export async function enforcePanelAccess(
  request: FastifyRequest,
  reply: Parameters<typeof error>[0],
): Promise<boolean> {
  try {
    if (!(await isPanelAccessEnabled())) return true;
    const ip = getClientIp(request);
    if (await isPanelIpAllowed(ip)) return true;
    error(reply, "Bu IP adresinden panele erişim izni yok", 403, null, "PANEL_IP_BLOCKED");
    return false;
  } catch {
    error(reply, "Erişim kontrolü başarısız", 503, null, "UPSTREAM_UNAVAILABLE");
    return false;
  }
}
