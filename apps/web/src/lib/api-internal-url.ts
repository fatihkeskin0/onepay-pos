/**
 * Server-side upstream for /api/backend/* pay proxy.
 *
 * Coolify runs web + api in one Compose app on the default network.
 * The web container reaches the api service at http://api:80 (container port).
 * No per-service env split is required in Coolify.
 */
const DOCKER_COMPOSE_API_UPSTREAM = "http://api:80";
const LOCAL_DEV_API_UPSTREAM = "http://localhost:4105";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function resolveApiInternalUrl(): string {
  const override = process.env.API_INTERNAL_URL?.trim();
  if (override) return stripTrailingSlash(override);

  if (process.env.NODE_ENV === "production") {
    return DOCKER_COMPOSE_API_UPSTREAM;
  }

  return LOCAL_DEV_API_UPSTREAM;
}
