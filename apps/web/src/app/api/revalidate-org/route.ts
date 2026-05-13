import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import { getServerSession } from "../../../lib/server/get-server-session";

/**
 * A9: Invalidate the landing page org-public cache after admin settings update.
 * Auth-guarded — only authenticated users may trigger ISR revalidation.
 * CSRF-guarded — Origin header must match the server's own origin when present.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // CSRF: reject cross-origin browser requests. Server-to-server calls (no
  // Origin header) are already session-gated above, so they pass through.
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  revalidatePath("/", "layout");
  return NextResponse.json({ revalidated: true });
}
