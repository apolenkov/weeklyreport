"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../../lib/trpc-context";
import { WeeklyReportPage } from "./weekly-report-page";
import { WeeklyReportSkeleton } from "./weekly-report-skeleton";

interface Props {
  readonly reportId: string;
}

// authorId only opens/highlights the lead's own section; product scope is
// server-side (group products via weeklyReport.get).
/**
 * Lead Section Preview Auth.
 * @param props - The props argument.
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
