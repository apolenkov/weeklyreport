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
