import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import { isAdmin } from "../../../lib/role-predicates";
import { getServerSession } from "../../../lib/server/get-server-session";

// Admin-only cache invalidation; reject cross-origin browser requests while
// allowing session-gated server-to-server calls without an Origin header.
export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
