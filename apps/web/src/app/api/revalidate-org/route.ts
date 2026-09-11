import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import { isAdmin } from "../../../shared/lib/auth/role-predicates";
import { getServerSession } from "../../../shared/server/auth/get-server-session";
import { requirePublicWebOrigin } from "../../../shared/server/transport/public-web-origin";

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

  // CSRF: compare against the configured browser origin. Next may construct
  // nextUrl from its internal listener, which can differ from the public host.
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== requirePublicWebOrigin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  revalidatePath("/", "layout");
  return NextResponse.json({ revalidated: true });
}
