import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getServerSession } from "../../../lib/server/get-server-session";

/**
 * A9: Invalidate the landing page org-public cache after admin settings update.
 * Auth-guarded — only authenticated users may trigger ISR revalidation.
 */
export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ revalidated: true });
}
