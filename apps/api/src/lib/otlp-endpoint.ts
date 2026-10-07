// Shared optional OTLP endpoint contract: the environment schema and the
// early OTel bootstrap must accept and reject the same forms, so both use
// this parser. Whitespace-only means "unset" (no exporter); a nonblank value
// must be a valid HTTP(S) URL — a malformed endpoint is a configuration
// error, never silently disabled telemetry. No DNS/reachability probing.
export const OTLP_ENDPOINT_INVALID_MESSAGE =
  "OTEL_EXPORTER_OTLP_ENDPOINT must be an http(s) URL or empty";

export const parseOtlpEndpoint = (
  raw: string | undefined,
): string | undefined => {
  const trimmed = raw?.trim() ?? "";
  if (trimmed === "") return undefined;
  const url = URL.parse(trimmed);
  if (url === null || (url.protocol !== "http:" && url.protocol !== "https:")) {
    throw new Error(OTLP_ENDPOINT_INVALID_MESSAGE);
  }
  return trimmed;
};

export const isOtlpEndpoint = (value: string | undefined): boolean => {
  try {
    parseOtlpEndpoint(value);
    return true;
  } catch {
    return false;
  }
};
