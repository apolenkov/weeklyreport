const TRACEPARENT_VERSION = "00";
const SAMPLED_TRACE_FLAGS = "01";
const PARENT_ID_HEX_LENGTH = 16;

/** Remove UUID separators to produce a 128-bit lowercase hexadecimal ID. */
function randomUuidHex(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

/** Format pre-generated trace and parent IDs as W3C trace context. */
function formatTraceparent(traceId: string, parentId: string): string {
  return `${TRACEPARENT_VERSION}-${traceId}-${parentId}-${SAMPLED_TRACE_FLAGS}`;
}

/** Generate a valid sampled W3C traceparent without a browser OTel SDK. */
export function createTraceparent(): string {
  const traceId = randomUuidHex();
  const parentId = randomUuidHex().slice(0, PARENT_ID_HEX_LENGTH);
  return formatTraceparent(traceId, parentId);
}

/** Attach a fresh trace context while preserving the request's other headers. */
export function fetchWithTraceparent(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("traceparent", createTraceparent());
  return fetch(input, { ...init, headers, credentials: "include" });
}
