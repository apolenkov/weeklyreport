"use client";

import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
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
import { ReportSlides } from "./report-slides";
import {
  buildSectionSlideModel,
  paginateSectionSlides,
} from "./section-slide-utils";
import { AgentReviewComingSoon } from "../report-shell/agent-review-coming-soon";
import { ScopeToggle, type ScopeValue } from "../report-shell/scope-toggle";
import { SlideFullscreenButton } from "./slide-fullscreen-button";
import { LeadProductGrid } from "./lead-product-grid";
import { LeadSlideHero } from "./lead-slide-hero";

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
  /** W9.A: when provided, this ref is applied to the deck root div so the
   *  caller (lead-form header) can host the fullscreen button. */
  readonly deckRef?: RefObject<HTMLDivElement | null>;
};


export function LeadSlidesClient({
  initialReportId = null,
  deckRef: externalDeckRef,
}: LeadSlidesClientProps) {
  const trpc = useTRPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const session = useContext(SessionContext);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scope, setScope] = useState<ScopeValue>("own");
  const internalDeckRef = useRef<HTMLDivElement>(null);
  const deckRef = externalDeckRef ?? internalDeckRef;

  const activeQ = useQuery(trpc.reports.getActive.queryOptions());
  const historyQ = useQuery(trpc.reports.myHistory.queryOptions());
  const activeReportId = activeQ.data?.reportId ?? null;
  const inReportMode = pathname?.startsWith("/lead/report/");
  const requestedReportId = inReportMode
    ? initialReportId
    : searchParams.get("reportId");
  const authorId = searchParams.get("authorId") ?? undefined;
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
    ...trpc.leadForm.byPeriod.queryOptions({
      reportId: targetReportId,
      authorId,
    }),
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

  const sectionModel = useMemo(
    () =>
      byPeriodQ.data?.section
        ? buildSectionSlideModel(byPeriodQ.data.section)
        : null,
    [byPeriodQ.data],
  );

  const slides = useMemo(
    () => (sectionModel ? paginateSectionSlides(sectionModel) : []),
    [sectionModel],
  );

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

  const scopeControls = (
    <>
      <ScopeToggle
        value={scope}
        onChange={(s) => {
          setScope(s);
          setSelectedIndex(0);
        }}
        allowedScopes={["own", "product"]}
      />
      <AgentReviewComingSoon />
    </>
  );

  if (scope === "product") {
    return (
      <div ref={deckRef}>
        <article className="slide-frame rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[var(--color-card)] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          {sectionModel ? (
            <LeadSlideHero
              slide={sectionModel}
              heroControls={
                <div className="flex flex-wrap items-center gap-2">
                  {scopeControls}
                </div>
              }
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(0,0,0,0.08)] pb-4">
              {scopeControls}
            </div>
          )}
          <div className="mt-5">
            <LeadProductGrid products={sectionModel?.productSlides ?? []} />
          </div>
          {!inReportMode && (
            <div className="mt-4 flex justify-end">
              <SlideFullscreenButton targetRef={deckRef} />
            </div>
          )}
        </article>
      </div>
    );
  }

  return (
    <div ref={deckRef}>
      <ReportSlides
        slides={slides}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        variant="lead"
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
        heroControls={
          <div className="flex flex-wrap items-center gap-2">{scopeControls}</div>
        }
        toolbar={
          !inReportMode ? (
            <SlideFullscreenButton targetRef={deckRef} />
          ) : undefined
        }
      />
    </div>
  );
}
