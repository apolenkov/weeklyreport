// Explicit body-size bounds for the public HTTP ingress surfaces. Named
// constants keep each cap auditable at its mount site, not an implicit default.
const BYTES_PER_KIB = 1024;

// tRPC mutation bodies (e.g. a full section save with items, risks, decisions)
// are the largest legitimate payloads; 1 MiB covers them with headroom while
// rejecting anything that could only be an attempt to exhaust the parser.
export const TRPC_MAX_BODY_BYTES = BYTES_PER_KIB * BYTES_PER_KIB;

// 128 KiB bounds a public beacon while covering a burst flush; shared with
// the ingress integration test so a drifted limit fails there, not in prod.
export const CLIENT_LOGS_JSON_LIMIT = "128kb";
// Keep the other small, unauthenticated browser and ACS payloads on the same
// explicit budget instead of relying on body-parser's 100 KiB default.
export const WEB_VITALS_JSON_LIMIT = CLIENT_LOGS_JSON_LIMIT;
export const SAML_CALLBACK_URLENCODED_LIMIT = CLIENT_LOGS_JSON_LIMIT;
// Agentation context can include bounded DOM/source metadata. 512 KiB leaves
// headroom for that contract without accepting screenshot-sized JSON bodies.
export const PRODUCT_FEEDBACK_JSON_LIMIT = "512kb";

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
