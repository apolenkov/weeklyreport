import { type NextRequest, NextResponse } from "next/server";

import { CLIENT_LOGS_MAX_BODY_BYTES } from "../../../features/telemetry/server";
import { requireApiUrl } from "../../../shared/server/transport/api-url";

function declaredBodyIsOversized(req: NextRequest): boolean {
  const contentLength = req.headers.get("content-length");
  if (contentLength === null) return false;
  const parsedLength = Number(contentLength);
  return (
    Number.isFinite(parsedLength) && parsedLength > CLIENT_LOGS_MAX_BODY_BYTES
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Outside the try: a missing API URL is a deployment misconfiguration and
  // must fail loud, not be swallowed into the fire-and-forget 204.
  const apiUrl = requireApiUrl();
  try {
    if (declaredBodyIsOversized(req)) {
      return new NextResponse(null, { status: 413 });
    }
    const body = await req.text();
    if (
      new TextEncoder().encode(body).byteLength > CLIENT_LOGS_MAX_BODY_BYTES
    ) {
      return new NextResponse(null, { status: 413 });
    }
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
    });
    return new NextResponse(null, { status: res.status });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
