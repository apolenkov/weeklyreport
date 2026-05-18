"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { logClientError } from "../../lib/client-error-reporting";
import { SessionContext } from "../../lib/session-provider";
import { useTRPC } from "../../lib/trpc-context";
import {
  buildLeadSlidePeriodOptions,
  resolveLeadSlideReportId,
} from "./lead-slide-periods";
import { SlideSkeleton } from "./slide-skeleton";
import { StatusSlideDeck } from "./status-slide-deck";
import { buildSectionSlideModel } from "./section-slide-utils";

function SlideEmptyState({
  title,
  message,
}: {
  readonly title: string;
  readonly message: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
      <p className="text-base font-semibold text-[var(--color-foreground)]">
        {title}
      </p>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        {message}
      </p>
    </div>
  );
}

type LeadSlidesClientProps = {
  readonly initialReportId?: string | null;
  readonly chrome?: "full" | "content";
};

export function LeadSlidesClient({
  initialReportId = null,
}: LeadSlidesClientProps) {
  const trpc = useTRPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const session = useContext(SessionContext);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const activeQ = useQuery(trpc.reports.getActive.queryOptions());
  const historyQ = useQuery(trpc.reports.myHistory.queryOptions());
  const activeReportId = activeQ.data?.reportId ?? null;
  const inReportMode = pathname?.startsWith("/lead/report/");
  const requestedReportId = inReportMode
    ? initialReportId
    : searchParams.get("reportId");
  const periodOptions = useMemo(
    () => buildLeadSlidePeriodOptions(historyQ.data ?? [], activeReportId),
    [historyQ.data, activeReportId],
  );
  const targetReportId = useMemo(
    () =>
      resolveLeadSlideReportId({
        options: periodOptions,
        requestedReportId,
        activeReportId,
      }),
    [periodOptions, requestedReportId, activeReportId],
  );
  const byPeriodQ = useQuery({
    ...trpc.leadForm.byPeriod.queryOptions({ reportId: targetReportId }),
    enabled: targetReportId !== "",
  });

  useEffect(() => {
    if (!activeQ.isError) return;
    logClientError("leadSlides.getActive.load_failed", activeQ.error, {
      component: "LeadSlidesClient",
      procedure: "reports.getActive",
    });
  }, [activeQ.isError, activeQ.error]);

  useEffect(() => {
    if (!byPeriodQ.isError) return;
    logClientError("leadSlides.byPeriod.load_failed", byPeriodQ.error, {
      component: "LeadSlidesClient",
      procedure: "leadForm.byPeriod",
      reportId: targetReportId || null,
    });
  }, [byPeriodQ.isError, byPeriodQ.error, targetReportId]);

  const slides = useMemo(() => {
    if (!byPeriodQ.data?.section) return [];
    return [buildSectionSlideModel(byPeriodQ.data.section)];
  }, [byPeriodQ.data]);

  if (activeQ.isLoading || byPeriodQ.isLoading || historyQ.isLoading) {
    return <SlideSkeleton />;
  }

  if (activeQ.isError || byPeriodQ.isError || historyQ.isError) {
    return (
      <SlideEmptyState
        title="Slides could not load"
        message="Refresh the page after the report data is available."
      />
    );
  }

  if (!targetReportId) {
    return (
      <SlideEmptyState
        title="No active slide"
        message="There is no report section available for this session."
      />
    );
  }

  return (
    <StatusSlideDeck
      slides={slides}
      selectedIndex={selectedIndex}
      onSelect={setSelectedIndex}
      title={inReportMode ? "Report slides" : "My Status Slides"}
      subtitle={
        inReportMode
          ? "Report sections grouped by product and SDLC stage."
          : "Current section grouped by product and SDLC stage."
      }
      groupLabel={
        inReportMode ? null : (session?.user?.reportingGroupName ?? null)
      }
      sourceHref={"/lead/report/" + encodeURIComponent(targetReportId)}
      sourceLabel="Open source section"
      hideSourceLink={inReportMode}
      mode="lead"
      showChrome={false}
    />
  );
}
