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

  // Render the same skeleton as the page Suspense fallback uses. A bespoke inline
  // skeleton here can diverge from server-streamed output on preview and trigger
  // hydration issues. isPending, not isLoading: a retry paused offline or in a
  // background tab is still unresolved and must not open the page authorless.
  if (meQ.isPending) {
    return <WeeklyReportSkeleton />;
  }

  return <WeeklyReportPage reportId={reportId} authorId={authorId} />;
}
