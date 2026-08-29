import {
  resolveSentryEnvelopeEndpoint,
  SENTRY_TUNNEL_MAX_BODY_BYTES,
} from "./sentry-tunnel";

function declaredBodyIsOversized(req: Request): boolean {
  const contentLength = req.headers.get("content-length");
  if (contentLength === null) return false;
  const parsedLength = Number(contentLength);
  return (
    Number.isFinite(parsedLength) && parsedLength > SENTRY_TUNNEL_MAX_BODY_BYTES
  );
}

export async function POST(req: Request): Promise<Response> {
  if (declaredBodyIsOversized(req)) {
    return new Response(null, { status: 413 });
  }

  const endpoint = resolveSentryEnvelopeEndpoint();
  if (!endpoint) return new Response(null, { status: 204 });

  try {
    const body = await req.arrayBuffer();
    if (body.byteLength > SENTRY_TUNNEL_MAX_BODY_BYTES) {
      return new Response(null, { status: 413 });
    }

    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type":
          req.headers.get("content-type") ?? "application/x-sentry-envelope",
      },
      body,
    });
    return new Response(null, { status: upstream.status });
  } catch {
    // Telemetry must never turn a browser-side reporting failure into an app
    // failure; the SDK will apply its normal retry/drop behavior.
    return new Response(null, { status: 204 });
  }
}
