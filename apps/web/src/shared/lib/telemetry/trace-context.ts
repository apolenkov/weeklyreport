const TRACEPARENT_VERSION = "00";
const SAMPLED_TRACE_FLAGS = "01";
const PARENT_ID_HEX_LENGTH = 16;

function randomUuidHex(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

function formatTraceparent(traceId: string, parentId: string): string {
  return `${TRACEPARENT_VERSION}-${traceId}-${parentId}-${SAMPLED_TRACE_FLAGS}`;
}

export function createTraceparent(): string {
  const traceId = randomUuidHex();
  const parentId = randomUuidHex().slice(0, PARENT_ID_HEX_LENGTH);
  return formatTraceparent(traceId, parentId);
}
