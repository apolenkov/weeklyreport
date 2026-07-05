import { type NextRequest, NextResponse } from "next/server";

import { requireApiUrl } from "../../../lib/server/api-url";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Outside the try: a missing API URL is a deployment misconfiguration and
  // must fail loud, not be swallowed into the fire-and-forget 204.
  const apiUrl = requireApiUrl();
  try {
    const body = await req.text();
    const res = await fetch(`${apiUrl}/api/client-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return new NextResponse(null, { status: res.status });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
