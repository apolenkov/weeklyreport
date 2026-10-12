import type { Role } from "@weeklyreport/shared";
import { redirect } from "next/navigation";

import {
  getPdfExportRender,
  getPrintRouteContext,
} from "../../../features/pdf-export/server";
import { ErrorShell } from "./print-report-shell";
import { PrintReportTemplate } from "./print-report-template";

interface Props {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ jobId?: string | string[] }>;
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

export default async function PrintReportPage({ params, searchParams }: Props) {
  const [{ reportId }, { jobId }, ctx] = await Promise.all([
    params,
    searchParams,
    getPrintRouteContext(),
  ]);

  // Worker check must come first: a worker token otherwise looks like a human
  // session. These redirects are UX only; pdfExportGuard is the data boundary.
  if (
    ctx.isPdfExport &&
    ctx.pdfReportId === reportId &&
    typeof jobId === "string" &&
    ctx.pdfJobId === jobId
  ) {
    // The render read happens on the server so the ready marker lands in SSR
    // markup — the renderer's wait must not rely on client hydration. A null
    // read renders the error shell, which keeps the wait falsy until the
    // renderer's own bounded timeout fails the attempt.
    const data = await getPdfExportRender(jobId, reportId);
    return data === null ? (
      <ErrorShell reportId={reportId} />
    ) : (
      <PrintReportTemplate data={data} />
    );
  }

  // Destination varies by session role, so this must stay a temporary (307)
  // redirect — a permanent one lets a shared cache serve one role's target
  // to another.
  if (ctx.session) {
    redirect(humanRedirectPath(ctx.session.role, reportId));
  }

  // This route sits outside the proxy matcher, so the no-session bounce to
  // login is gated here instead (mirrors proxy.ts).
  const nextPath = `/print/${reportId}`;
  redirect(`/?next=${encodeURIComponent(nextPath)}`);
}
