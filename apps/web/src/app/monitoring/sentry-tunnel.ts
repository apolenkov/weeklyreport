const BYTES_PER_KIBIBYTE = 1024;
const MAX_BODY_KIBIBYTES = 1024;
const MILLISECONDS_PER_SECOND = 1000;
export const SENTRY_TUNNEL_MAX_BODY_BYTES =
  MAX_BODY_KIBIBYTES * BYTES_PER_KIBIBYTE;
export const SENTRY_TUNNEL_WINDOW_MS = 60_000;
export const SENTRY_TUNNEL_RETRY_AFTER_SECONDS =
  SENTRY_TUNNEL_WINDOW_MS / MILLISECONDS_PER_SECOND;
export const SENTRY_TUNNEL_MAX_REQUESTS_PER_WINDOW = 30;
export const SENTRY_TUNNEL_MAX_CLIENT_BUCKETS = 1024;
const MAX_CLIENT_KEY_LENGTH = 128;

interface ClientQuotaBucket {
  windowStartedAt: number;
  requests: number;
}

const clientQuotaBuckets = new Map<string, ClientQuotaBucket>();

/**
 * Resolves the edge-provided client identity for the process-local quota.
 * Caddy overwrites X-Forwarded-For with the remote address at the edge.
 */
export function resolveSentryTunnelClientKey(req: Request): string {
  const realAddress = req.headers.get("x-real-ip")?.trim();
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (realAddress || forwarded || "anonymous").slice(
    0,
    MAX_CLIENT_KEY_LENGTH,
  );
}

/**
 * Applies a bounded, process-local quota to the browser telemetry tunnel.
 * External edge-wide rate limiting remains a deployment concern.
 */
export function consumeSentryTunnelQuota(
  clientKey: string,
  now = Date.now(),
): boolean {
  const normalizedKey =
    clientKey.trim().slice(0, MAX_CLIENT_KEY_LENGTH) || "anonymous";
  const current = clientQuotaBuckets.get(normalizedKey);

  if (current && now - current.windowStartedAt < SENTRY_TUNNEL_WINDOW_MS) {
    if (current.requests >= SENTRY_TUNNEL_MAX_REQUESTS_PER_WINDOW) {
      return false;
    }
    current.requests += 1;
    return true;
  }

  for (const [key, bucket] of clientQuotaBuckets) {
    if (now - bucket.windowStartedAt >= SENTRY_TUNNEL_WINDOW_MS) {
      clientQuotaBuckets.delete(key);
    }
  }

  if (!current && clientQuotaBuckets.size >= SENTRY_TUNNEL_MAX_CLIENT_BUCKETS) {
    return false;
  }

  clientQuotaBuckets.set(normalizedKey, {
    windowStartedAt: now,
    requests: 1,
  });
  return true;
}

/** Clears process-local quota state between isolated route tests. */
export function resetSentryTunnelQuota(): void {
  clientQuotaBuckets.clear();
}

function configuredDsn(): string | undefined {
  const serverDsn = process.env.SENTRY_DSN?.trim();
  if (serverDsn) return serverDsn;

  const publicDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return publicDsn || undefined;
}

/**
 * Resolves the configured DSN to the Sentry envelope endpoint without
 * allowing request input to select an upstream host.
 */
export function resolveSentryEnvelopeEndpoint(
  dsn: string | undefined = configuredDsn(),
): URL | undefined {
  if (!dsn) return undefined;

  try {
    const parsed = new URL(dsn);
    if (!/^https?:$/.test(parsed.protocol) || !parsed.username) {
      return undefined;
    }

    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    const projectId = pathSegments.pop();
    if (!projectId || !/^[A-Za-z0-9_-]+$/.test(projectId)) {
      return undefined;
    }

    const publicKey = decodePublicKey(parsed.username);
    if (!publicKey) return undefined;

    const basePath =
      pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "";
    const endpoint = new URL(
      `${parsed.origin}${basePath}/api/${projectId}/envelope/`,
    );
    endpoint.search = new URLSearchParams({
      sentry_version: "7",
      sentry_key: publicKey,
    }).toString();
    return endpoint;
  } catch {
    return undefined;
  }
}

function decodePublicKey(username: string): string | undefined {
  try {
    const publicKey = decodeURIComponent(username);
    return publicKey || undefined;
  } catch {
    return undefined;
  }
}
