import type { FastifyServerOptions } from "fastify";
import { config } from "./config.js";

export const DEV_QUIET_ROUTE_PATHS = new Set(["/health", "/badges"]);

export function createAppLogger(): FastifyServerOptions["logger"] {
  if (config.app.env !== "development") {
    return { level: process.env.LOG_LEVEL ?? "info" };
  }

  return {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname,reqId",
        singleLine: true,
        messageFormat: "{if req}{req.method} {req.url} → {res.statusCode} ({responseTime}ms){else}{msg}{end}",
      },
    },
  };
}
