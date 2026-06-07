"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc-context";
import { WeeklyReportPage } from "../weekly-report/weekly-report-page";
import { WeeklyReportSkeleton } from "../weekly-report/weekly-report-skeleton";

interface Props {
  readonly reportId: string;
}

/**
 * UFB-NEW-A34: resolves the current lead's userId from auth.me and
 * renders WeeklyReportPage filtered to their section.
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
