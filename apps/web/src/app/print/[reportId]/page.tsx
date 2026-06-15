import type { Role } from "@customreport/shared";
import { permanentRedirect, redirect } from "next/navigation";

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
/*    authenticated human                              → 308 redirect  */
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
 * The spec's "FORBIDDEN if the report is not the lead's" nuance has no cheap
 * web-side ownership signal (a `/print/[reportId]` id maps to a lead's own
 * report only via their server-side `reportingGroupId`). Per design (the API
 * pdfExportGuard is the real boundary), the lead is sent to `/lead/report`
 * rather than building a new ownership-resolution path.
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

  // 2. Authenticated human without worker context → role-specific 308.
  if (ctx.session) {
    permanentRedirect(humanRedirectPath(ctx.session.role, reportId));
  }

  // 3. No session → 307 to login, preserving the original path (mirrors
  //    proxy.ts; login is not a permanent redirect).
  const nextPath = `/print/${reportId}`;
  redirect(`/?next=${encodeURIComponent(nextPath)}`);
}
