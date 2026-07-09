/** @type {import('next').NextConfig} */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "../..");

function loadRootEnv() {
  const envPath = path.join(monorepoRoot, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadRootEnv();

const nextConfig = {
  transpilePackages: ["@onepara/shared"],
  outputFileTracingRoot: monorepoRoot,
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  env: {
    APP_MARKETING_URL: process.env.APP_MARKETING_URL ?? "",
    APP_BASE_URL: process.env.APP_BASE_URL ?? "",
    APP_PAYMENT_URL: process.env.APP_PAYMENT_URL ?? "",
    API_PUBLIC_URL: process.env.API_PUBLIC_URL ?? "",
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
  },
  async rewrites() {
    const upstream =
      process.env.DOCKER_BUILD === "1"
        ? "http://api:80"
        : (process.env.API_INTERNAL_URL?.replace(/\/+$/, "") || "http://localhost:4105");
    return [{ source: "/api/backend/:path*", destination: `${upstream}/:path*` }];
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...(Array.isArray(config.watchOptions?.ignored)
            ? config.watchOptions.ignored
            : config.watchOptions?.ignored
              ? [config.watchOptions.ignored]
              : []),
          "**/packages/shared/dist/**",
          "**/packages/db/dist/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
