"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc-context";
import { WeeklyReportPage } from "../weekly-report/weekly-report-page";

type Props = {
  readonly reportId: string;
};

/**
 * UFB-NEW-A34: resolves the current lead's userId from auth.me and
 * renders WeeklyReportPage filtered to their section.
 */
export function LeadSectionPreviewAuth({ reportId }: Props) {
  const trpc = useTRPC();
  const meQ = useQuery(trpc.auth.me.queryOptions());
  const authorId = meQ.data?.userId ?? undefined;

  if (meQ.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-[var(--color-skeleton)]" />
        <div className="h-64 w-full animate-pulse rounded-xl bg-[var(--color-skeleton)]" />
      </div>
    );
  }

  return <WeeklyReportPage reportId={reportId} authorId={authorId} />;
}
