import type { Role } from "@customreport/shared";
import { redirect } from "next/navigation";

import { getPrintRouteContext } from "../../../lib/server/get-print-route-context";
import { PrintReportTemplate } from "./print-report-template";

// Worker check first (isPdfExport + pdfReportId): worker token looks like a
// human session otherwise. Outside proxy matcher — gate no-session here.
// Redirect is UX only; pdfExportGuard is the data boundary.

interface Props {
  params: Promise<{ reportId: string }>;
}

// Human bounce targets; lead → own report home (no per-report ownership check).
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
