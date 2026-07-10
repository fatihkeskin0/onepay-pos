import type { FastifyRequest } from "fastify";

export interface AuthCashierContext {
  totpEnabled: boolean;
  totpSecret: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    authCashier?: AuthCashierContext;
  }
}

export function setAuthCashier(request: FastifyRequest, ctx: AuthCashierContext): void {
  request.authCashier = ctx;
}
