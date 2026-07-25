const TRACEPARENT_VERSION = "00";
const SAMPLED_TRACE_FLAGS = "01";
const PARENT_ID_HEX_LENGTH = 16;

function randomUuidHex(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

function formatTraceparent(traceId: string, parentId: string): string {
  return `${TRACEPARENT_VERSION}-${traceId}-${parentId}-${SAMPLED_TRACE_FLAGS}`;
}

/**
 * Create Traceparent.
 */
export function createTraceparent(): string {
  const traceId = randomUuidHex();
  const parentId = randomUuidHex().slice(0, PARENT_ID_HEX_LENGTH);
  return formatTraceparent(traceId, parentId);
}

/**
 * Fetch With Traceparent.
 * @param input - The input argument.
 * @param init - The init argument.
 */
export function fetchWithTraceparent(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("traceparent", createTraceparent());
  return fetch(input, { ...init, headers, credentials: "include" });
}
