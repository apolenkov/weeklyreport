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

// Client-log beacons are tiny batched JSON arrays; 128 KiB gives generous
// headroom for a burst flush while keeping the public endpoint cheap to
// parse. Shared with the ingress integration test so a drifted mount limit
// fails there, not in production.
export const CLIENT_LOGS_JSON_LIMIT = "128kb";

// The client-logs mount order is load-bearing: rate-limit BEFORE the JSON
// parse and the terminating handler, so an unauthenticated caller cannot
// flood the parser or the shared app.log. main.ts and the ingress
// integration test both mount through this helper — the order cannot drift
// in one without failing in the other.
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
