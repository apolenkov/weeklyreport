const TRACEPARENT_VERSION = "00";
const SAMPLED_TRACE_FLAGS = "01";
const TRACE_ID_BYTES = 16;
const PARENT_ID_BYTES = 8;
const HEX_RADIX = 16;

// crypto.randomUUID exists only in secure contexts, but the print page renders
// inside the internal renderer over plain http — getRandomValues is available
// everywhere and gives the same trace-id entropy the W3C format needs.
function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  do {
    crypto.getRandomValues(bytes);
  } while (bytes.every((byte) => byte === 0));

  return [...bytes]
    .map((byte) => byte.toString(HEX_RADIX).padStart(2, "0"))
    .join("");
}

function formatTraceparent(traceId: string, parentId: string): string {
  return `${TRACEPARENT_VERSION}-${traceId}-${parentId}-${SAMPLED_TRACE_FLAGS}`;
}

export function createTraceparent(): string {
  const traceId = randomHex(TRACE_ID_BYTES);
  const parentId = randomHex(PARENT_ID_BYTES);
  return formatTraceparent(traceId, parentId);
}
