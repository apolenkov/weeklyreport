import type { Role } from "@customreport/shared";
import { redirect } from "next/navigation";

import { getPrintRouteContext } from "../../../lib/server/get-print-route-context";
import { PrintReportTemplate } from "./print-report-template";

/* ------------------------------------------------------------------ */
/*  Print route — thin async SERVER gate (W2 task 3.3)                */
/*                                                                    */
/*  `/print/[reportId]` is the PDF worker's render template ONLY. The */
/*  route is NOT under the proxy.ts auth matcher, so this gate handles */
/*  the no-session case itself.                                       */
/*                                                                    */
/*  Discriminator order matters: verify the PDF-worker export-auth     */
/*  FIRST (a `requestedBy` worker token resolves to the requester's    */
/*  real session, so it is indistinguishable from a human by session   */
/*  alone — only `isPdfExport` + the bound `pdfReportId` tell them      */
/*  apart). THEN branch on the human session.                          */
/*                                                                    */
/*    worker (isPdfExport && pdfReportId === reportId) → render        */
/*    authenticated human                              → 307 redirect  */
/*    no session                                       → 307 login     */
/*                                                                    */
/*  The redirect is a UX gate, not the data boundary — the API's       */
/*  pdfExportGuard scopes the actual reads regardless of who reaches   */
/*  the route.                                                         */
/* ------------------------------------------------------------------ */

interface Props {
  params: Promise<{ reportId: string }>;
}

/**
 * Role-specific destination for an authenticated human who hit `/print`
 * without the worker export-auth context. head/admin → the consolidated
 * report; viewer → the published report; lead → their own active report.
 *
 * Per design ("lead → own/FORBIDDEN"), the lead takes the "own" path: they are
 * sent to their own report home (`/lead/report`). The alternative "FORBIDDEN for
 * a non-owned reportId" is deliberately NOT built: a lead human never renders
 * the print template (only the worker token does), so there is no data exposure
 * to forbid — the API pdfExportGuard is the real read boundary. Resolving
 * per-report ownership here would add an API round-trip with no security gain.
 */
function humanRedirectPath(role: Role, reportId: string): string {
  switch (role) {
    case "head":
    case "admin":
      return `/head/report/${reportId}`;
    case "viewer":
      return `/reports/${reportId}`;
    case "lead":
      return "/lead/report";
  }
}

export default async function PrintReportPage({ params }: Props) {
  const { reportId } = await params;
  const ctx = await getPrintRouteContext();

  // 1. PDF worker export-auth, bound to THIS report → render the template.
  if (ctx.isPdfExport && ctx.pdfReportId === reportId) {
    return <PrintReportTemplate reportId={reportId} />;
  }

  // 2. Authenticated human without worker context → role-specific TEMPORARY
  //    (307) redirect. The destination depends on the caller's session role, so
  //    it must NOT be a permanent (308) redirect — a shared cache/proxy could
  //    otherwise serve one role's /print → destination to another role.
  if (ctx.session) {
    redirect(humanRedirectPath(ctx.session.role, reportId));
  }

  // 3. No session → 307 to login, preserving the original path (mirrors
  //    proxy.ts; login is not a permanent redirect).
  const nextPath = `/print/${reportId}`;
  redirect(`/?next=${encodeURIComponent(nextPath)}`);
}
