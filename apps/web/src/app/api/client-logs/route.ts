import { type NextRequest, NextResponse } from "next/server";

import { CLIENT_LOGS_MAX_BODY_BYTES } from "../../../features/telemetry/server";
import {
  requireApiUrl,
  SERVER_FETCH_TIMEOUT_MS,
} from "../../../shared/server/transport/api-url";

function declaredBodyIsOversized(req: NextRequest): boolean {
  const contentLength = req.headers.get("content-length");
  if (contentLength === null) return false;
  const parsedLength = Number(contentLength);
  return (
    Number.isFinite(parsedLength) && parsedLength > CLIENT_LOGS_MAX_BODY_BYTES
  );
}

// Content-Length is only a hint, so the stream itself is read under the same
// byte budget: the moment accumulated chunks cross it the reader is cancelled
// and the rest of the body is never pulled into memory.
async function readBoundedBody(req: NextRequest): Promise<Uint8Array | null> {
  const stream = req.body;
  if (stream === null) return new Uint8Array(0);
  const reader = stream.getReader();
  try {
    return await readBoundedChunks(reader, []);
  } finally {
    reader.releaseLock();
  }
}

async function readBoundedChunks(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  chunks: Uint8Array[],
): Promise<Uint8Array | null> {
  const totalBytes = { value: 0 };

  while (totalBytes.value <= CLIENT_LOGS_MAX_BODY_BYTES) {
    const result = await reader.read();
    if (result.done) return joinChunks(chunks, totalBytes.value);

    const nextTotalBytes = totalBytes.value + result.value.byteLength;
    if (nextTotalBytes > CLIENT_LOGS_MAX_BODY_BYTES) {
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
    await reader.cancel("client-logs body exceeds the request limit");
  } catch {
    // The request is already rejected; cancellation is best effort.
  }
  return null;
}

function joinChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  return chunks.reduce(
    (state, chunk) => {
      state.output.set(chunk, state.offset);
      return {
        output: state.output,
        offset: state.offset + chunk.byteLength,
      };
    },
    { output: new Uint8Array(totalBytes), offset: 0 },
  ).output;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Outside the try: a missing API URL is a deployment misconfiguration and
  // must fail loud, not be swallowed into the fire-and-forget 204.
  const apiUrl = requireApiUrl();
  try {
    if (declaredBodyIsOversized(req)) {
      return new NextResponse(null, { status: 413 });
    }
    const bytes = await readBoundedBody(req);
    if (bytes === null) {
      return new NextResponse(null, { status: 413 });
    }
    // Decode the complete bounded body once; slicing a partially received
    // stream could split a multi-byte UTF-8 sequence.
    const body = new TextDecoder().decode(bytes);
    // Pass the edge proxy's client-IP chain through to the API: its
    // per-IP client-logs limiter (trust proxy: 1) keys on X-Forwarded-For,
    // and without this hop-through every browser lands in one shared bucket
    // keyed by this server's address — one noisy client would 429 everyone.
    const forwardedFor = req.headers.get("x-forwarded-for");
    const res = await fetch(`${apiUrl}/api/client-logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(forwardedFor === null ? {} : { "X-Forwarded-For": forwardedFor }),
      },
      body,
      signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),
    });
    return new NextResponse(null, { status: res.status });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
