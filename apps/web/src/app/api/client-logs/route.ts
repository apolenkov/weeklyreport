import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3002";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.text();
    const res = await fetch(`${API_URL}/api/client-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return new NextResponse(null, { status: res.status });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
