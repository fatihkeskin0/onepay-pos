import type { FastifyRequest } from "fastify";
import { prisma } from "@onepara/db";
import { error } from "./response.js";

export async function requireSite(request: FastifyRequest, reply: Parameters<typeof error>[0]) {
  const headerKey =
    (request.headers["x-api-key"] as string | undefined) ??
    (request.headers["x-apikey"] as string | undefined);

  const body = (request.body ?? {}) as Record<string, string>;
  const query = request.query as Record<string, string>;
  const apiKey = headerKey ?? body.site ?? body.api_key ?? query.site;

  if (!apiKey) {
    error(reply, "API key gerekli", 401);
    return null;
  }

  const site = await prisma.site.findFirst({
    where: { apiKey, isActive: true },
  });

  if (!site) {
    error(reply, "Geçersiz API key", 401);
    return null;
  }

  return site;
}

export async function findSiteByKey(apiKey: string) {
  return prisma.site.findFirst({ where: { apiKey, isActive: true } });
}
