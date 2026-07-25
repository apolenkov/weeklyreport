/**
 * Explicit body-size bounds for the public HTTP ingress surfaces on the api
 * bootstrap. Kept as named constants so each cap is auditable at its mount site
 * rather than resolving to an implicit framework default.
 */

const BYTES_PER_KIB = 1024;

// tRPC mutation bodies (e.g. a full section save with items, risks, decisions)
// are the largest legitimate payloads; 1 MiB covers them with headroom while
// rejecting anything that could only be an attempt to exhaust the parser.
export const TRPC_MAX_BODY_BYTES = BYTES_PER_KIB * BYTES_PER_KIB;

// 128 KiB bounds a public beacon while covering a burst flush; shared with
// the ingress integration test so a drifted limit fails there, not in prod.
export const CLIENT_LOGS_JSON_LIMIT = "128kb";

// Load-bearing order: limiter before JSON parse/handler so unauthenticated
// flood cannot hit the parser or app.log. main.ts and the integration test
// both mount through this helper — order cannot drift in one place alone.
export function mountClientLogsIngress(
  app: {
    use: (
      route: string,
      ...handlers: readonly import("express").RequestHandler[]
    ) => unknown;
  },
  route: string,
  limiter: import("express").RequestHandler,
  jsonParser: import("express").RequestHandler,
  handler: import("express").RequestHandler,
): void {
  app.use(route, limiter, jsonParser, handler);
}
