"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../../../../shared/lib/trpc/trpc-context";
import { WeeklyReportPage } from "../../weekly/weekly-report-page";
import { WeeklyReportSkeleton } from "../../weekly/weekly-report-skeleton";

interface Props {
  readonly reportId: string;
}

// authorId only opens/highlights the lead's own section; product scope is
// server-side (group products via weeklyReport.get).
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
