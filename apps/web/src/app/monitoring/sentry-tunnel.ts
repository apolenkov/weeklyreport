const BYTES_PER_KIBIBYTE = 1024;
const MAX_BODY_KIBIBYTES = 1024;
export const SENTRY_TUNNEL_MAX_BODY_BYTES =
  MAX_BODY_KIBIBYTES * BYTES_PER_KIBIBYTE;

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
