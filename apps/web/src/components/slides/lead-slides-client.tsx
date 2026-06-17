"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { type RefObject, useContext, useMemo, useRef, useState } from "react";

import { SessionContext } from "../../lib/session-provider";
import { useTRPC } from "../../lib/trpc-context";
import { useQueryErrorHandler } from "../../lib/use-query-error-handler";
import { AgentReviewComingSoon } from "../report-shell/agent-review-coming-soon";
import { ScopeToggle, type ScopeValue } from "../report-shell/scope-toggle";
import { LeadProductGrid } from "./lead-product-grid";
import { LeadSlideHero } from "./lead-slide-hero";
import {
  buildLeadSlidePeriodOptions,
  resolveLeadSlideReportId,
} from "./lead-slide-periods";
import { ReportSlides } from "./report-slides";
import {
  applyForeignProductHealth,
  buildSectionSlideModel,
  paginateSectionSlides,
} from "./section-slide-utils";
import { SlideFullscreenButton } from "./slide-fullscreen-button";
import { SlideSkeleton } from "./slide-skeleton";

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

interface LeadSlidesClientProps {
  readonly initialReportId?: string | null;
  readonly chrome?: "full" | "content";
  /** W9.A: when provided, this ref is applied to the deck root div so the
   *  caller (lead-form header) can host the fullscreen button. */
  readonly deckRef?: RefObject<HTMLDivElement | null>;
}

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
  const inReportMode = pathname.startsWith("/lead/report/");
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

  // scope-lead-report-to-own-contribution: slides carry only own records, but
  // a co-owned product's health must stay honest. crossAuthors returns the
  // anonymized, risk-derived per-stage status (no foreign text/counts/names);
  // we fold its worst stage into each product badge below.
  const crossAuthorsQ = useQuery({
    ...trpc.leadForm.crossAuthors.queryOptions({
      reportId: targetReportId,
    }),
    enabled: targetReportId !== "",
  });

  useQueryErrorHandler(activeQ, {
    event: "leadSlides.getActive.load_failed",
    component: "LeadSlidesClient",
    procedure: "reports.getActive",
  });

  useQueryErrorHandler(byPeriodQ, {
    event: "leadSlides.byPeriod.load_failed",
    component: "LeadSlidesClient",
    procedure: "leadForm.byPeriod",
    context: { reportId: targetReportId || null },
  });

  const sectionModel = useMemo(() => {
    if (!byPeriodQ.data?.section) return null;
    const base = buildSectionSlideModel(byPeriodQ.data.section);
    const foreign = crossAuthorsQ.data ?? [];
    if (foreign.length === 0) return base;
    return {
      ...base,
      productSlides: applyForeignProductHealth(base.productSlides, foreign),
    };
  }, [byPeriodQ.data, crossAuthorsQ.data]);

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
    <ScopeToggle
      value={scope}
      onChange={(s) => {
        setScope(s);
        setSelectedIndex(0);
      }}
      allowedScopes={["own", "product"]}
    />
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
            <div className="mt-4 flex items-center justify-end gap-2">
              <AgentReviewComingSoon />
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
        sourceHref={`/lead/report/${encodeURIComponent(targetReportId)}`}
        sourceLabel="Open source section"
        hideSourceLink={inReportMode}
        heroControls={
          <div className="flex flex-wrap items-center gap-2">
            {scopeControls}
          </div>
        }
        toolbar={
          !inReportMode ? (
            <div className="flex items-center gap-2">
              <AgentReviewComingSoon />
              <SlideFullscreenButton targetRef={deckRef} />
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
