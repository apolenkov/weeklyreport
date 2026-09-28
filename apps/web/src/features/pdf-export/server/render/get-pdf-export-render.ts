import "server-only";

import {
  AUTH_COOKIE_NAME,
  type WeeklyReportReadModel,
  weeklyReportReadModelSchema,
} from "@customreport/shared";
import { cookies } from "next/headers";

import {
  decodeTrpcBatchPayload,
  requireApiUrl,
} from "../../../../shared/server/transport/api-url";

// The print page must reach data-print-state="ready" from SSR markup alone —
// the renderer's wait expression cannot depend on client hydration completing
// in the embedded Chromium lane. The worker JWT cookie authorizes this
// requester-scoped read exactly like the retired in-page query did.
const encodeRenderInput = (jobId: string, reportId: string): string =>
  encodeURIComponent(JSON.stringify({ "0": { json: { jobId, reportId } } }));

// Fail-closed: any transport or decode failure resolves to null so the route
// renders the error shell, which never satisfies the renderer's ready wait.
export async function getPdfExportRender(
  jobId: string,
  reportId: string,
): Promise<WeeklyReportReadModel | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const url = `${requireApiUrl()}/trpc/pdfExport.render?batch=1&input=${encodeRenderInput(jobId, reportId)}`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const parsed = weeklyReportReadModelSchema.safeParse(
      decodeTrpcBatchPayload(await response.json()),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
