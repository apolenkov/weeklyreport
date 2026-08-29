import {
  consumeSentryTunnelQuota,
  resolveSentryEnvelopeEndpoint,
  resolveSentryTunnelClientKey,
  SENTRY_TUNNEL_MAX_BODY_BYTES,
  SENTRY_TUNNEL_RETRY_AFTER_SECONDS,
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

  // This is an admission quota, deliberately charged before reading a stream:
  // otherwise oversized/chunked bodies could consume memory and sockets while
  // bypassing the abuse bound. A declared oversized body is rejected above
  // without a charge because it is known before any bytes are read.
  if (!consumeSentryTunnelQuota(resolveSentryTunnelClientKey(req))) {
    return new Response(null, {
      status: 429,
      headers: {
        "retry-after": String(SENTRY_TUNNEL_RETRY_AFTER_SECONDS),
      },
    });
  }

  try {
    const body = await readBoundedBody(req);
    if (body === null) {
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

async function readBoundedBody(req: Request): Promise<ArrayBuffer | null> {
  if (req.body === null) return new ArrayBuffer(0);

  return readBoundedChunks(req.body.getReader(), []);
}

async function readBoundedChunks(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  chunks: Uint8Array[],
): Promise<ArrayBuffer | null> {
  const totalBytes = { value: 0 };

  while (totalBytes.value <= SENTRY_TUNNEL_MAX_BODY_BYTES) {
    const result = await reader.read();
    if (result.done) return joinChunks(chunks, totalBytes.value);

    const nextTotalBytes = totalBytes.value + result.value.byteLength;
    if (nextTotalBytes > SENTRY_TUNNEL_MAX_BODY_BYTES) {
      return rejectOversizedReader(reader);
    }

    chunks.push(result.value);
    totalBytes.value = nextTotalBytes;
  }

  return null;
}

async function rejectOversizedReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<null> {
  try {
    await reader.cancel("Sentry envelope exceeds the request limit");
  } catch {
    // The request is already rejected; cancellation is best effort.
  }
  return null;
}

function joinChunks(chunks: Uint8Array[], totalBytes: number): ArrayBuffer {
  const output = chunks.reduce(
    (state, chunk) => {
      state.output.set(chunk, state.offset);
      return {
        output: state.output,
        offset: state.offset + chunk.byteLength,
      };
    },
    { output: new Uint8Array(totalBytes), offset: 0 },
  ).output;
  return output.buffer;
}
