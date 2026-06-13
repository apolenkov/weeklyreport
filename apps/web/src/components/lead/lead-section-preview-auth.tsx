"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc-context";
import { WeeklyReportPage } from "../weekly-report/weekly-report-page";
import { WeeklyReportSkeleton } from "../weekly-report/weekly-report-skeleton";

interface Props {
  readonly reportId: string;
}

/**
 * UFB-NEW-A34: resolves the current lead's userId from auth.me and renders
 * WeeklyReportPage.
 *
 * Scope (driver-findings-2026-06-11 finding 2): the preview shows the lead's
 * GROUP's products — those the lead's reporting group owns via GroupProduct —
 * not the whole portfolio and not only the products the lead personally
 * authors. That scoping is enforced server-side by weeklyReport.get; the
 * `authorId` passed below only drives open / highlight / scroll of the lead's
 * own section, it does not filter the product list.
 */
export function LeadSectionPreviewAuth({ reportId }: Props) {
  const trpc = useTRPC();
  const meQ = useQuery(trpc.auth.me.queryOptions());
  const authorId = meQ.data?.userId ?? undefined;

  // Render the same skeleton the page's Suspense fallback uses. A bespoke
  // inline skeleton here diverged from the server-streamed fallback and caused
  // a hydration mismatch on /lead/report/[reportId]/preview.
  if (meQ.isLoading) {
    return <WeeklyReportSkeleton />;
  }

  return <WeeklyReportPage reportId={reportId} authorId={authorId} />;
}
