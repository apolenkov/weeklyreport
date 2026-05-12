import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * A9: Invalidate the landing page org-public cache after admin settings update.
 *
 * After `appSettings.update` or `org.update` succeeds on the API, POST to this
 * route to invalidate the ISR cache. This eliminates the 60s delay when
 * shortName/fullName are changed in admin/settings.
 */
export async function POST() {
  revalidatePath('/', 'layout');
  return NextResponse.json({ revalidated: true });
}
