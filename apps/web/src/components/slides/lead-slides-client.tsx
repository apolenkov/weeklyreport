"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import {
  type RefObject,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { crossAuthorContentFetchEnabled } from "../../lib/cross-author-content-gate";
import type { CrossAuthorContentRow } from "../../lib/mappers/lead-cross-author";
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
  crossAuthorContentToSlideForeign,
  mergeForeignSlideContent,
  paginateSectionSlides,
  type SectionSlideModel,
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
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] px-6 py-16 text-center">
      <p className="text-base font-semibold text-[var(--color-foreground)]">
        {title}
      </p>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        {message}
      </p>
    </div>
  );
}

/**
 * Assemble the lead deck's slide model: own records, then the risk-derived
 * foreign HEALTH fold (own deck only), then the Everyone CONTENT merge. Each
 * step returns NEW objects — the input `section` (the cached read-model the
 * draft serializes) is never mutated, so Everyone stays view-only.
 */
function buildLeadDeckModel(
  section: ReportSectionReadModel,
  foreignHealth: Parameters<typeof applyForeignProductHealth>[1],
  foreignContentRows: readonly CrossAuthorContentRow[],
): SectionSlideModel {
  const base = buildSectionSlideModel(section);
  const withHealth =
    foreignHealth.length === 0
      ? base
      : {
          ...base,
          productSlides: applyForeignProductHealth(
            base.productSlides,
            foreignHealth,
          ),
        };
  if (foreignContentRows.length === 0) return withHealth;
  return mergeForeignSlideContent(
    withHealth,
    crossAuthorContentToSlideForeign(foreignContentRows),
  );
}

interface LeadSlidesClientProps {
  readonly initialReportId?: string | null;
  readonly chrome?: "full" | "content";
  /** W9.A: when provided, this ref is applied to the deck root div so the
   *  caller (lead-form header) can host the fullscreen button. */
  readonly deckRef?: RefObject<HTMLDivElement | null>;
  /**
   * slides-record-visibility: the lead-form owns the Record-visibility toggle
   * (one `useRecordVisibility` instance) and threads its state down so the deck
   * shows Mine vs Everyone. Defaults keep the deck Mine-only for any caller that
   * does not drive the toggle.
   */
  readonly visibilityMode?: "mine" | "everyone";
  readonly visibilityHydrated?: boolean;
}

export function LeadSlidesClient({
  initialReportId = null,
  deckRef: externalDeckRef,
  visibilityMode = "mine",
  visibilityHydrated = false,
}: LeadSlidesClientProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
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
  // slides-record-visibility (Decision 6 / Codex A-1): Everyone — and the
  // cross-author health fold — apply ONLY to the lead's OWN deck. When the URL
  // targets another author, this is a foreign deck: force Mine, run no
  // cross-author merge, and do not fold the current user's co-owner status onto
  // someone else's products.
  const currentUserId = session?.user?.id ?? null;
  const isOwnDeck =
    authorId === undefined ||
    (currentUserId !== null && authorId === currentUserId);
  const isEveryone = isOwnDeck && visibilityMode === "everyone";
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
  // we fold its worst stage into each product badge below. Codex A-1: this read
  // is the CURRENT user's co-ownership, so it is gated on the OWN deck — folding
  // it onto a foreign author's deck would mix two people's health.
  const crossAuthorsQ = useQuery({
    ...trpc.leadForm.crossAuthors.queryOptions({
      reportId: targetReportId,
    }),
    enabled: targetReportId !== "" && isOwnDeck,
  });

  // slides-record-visibility (Decision 4 / Codex #4): the full cross-author
  // CONTENT read mirrors the edit form — fetched ONLY after the persisted
  // visibility hydrates, only in Everyone, and only on the OWN deck. Anything
  // else keeps the deck own-only and never fires the sensitive read.
  const crossAuthorContentQ = useQuery({
    ...trpc.leadForm.crossAuthorContent.queryOptions({
      reportId: targetReportId,
    }),
    // close-slides-visibility-tails (tail 1): shared own-deck gate, identical to
    // the LeadForm toolbar host. `isEveryone` here already folds `isOwnDeck`, but
    // we pass both so the predicate's own-deck clause is explicit on every host.
    enabled: crossAuthorContentFetchEnabled({
      hasReport: targetReportId !== "",
      visibilityHydrated,
      isEveryone,
      isOwnDeck,
    }),
  });

  // Purge the fetched foreign content whenever the deck leaves Everyone, is not
  // yet hydrated, or is a foreign deck — so leaving Everyone (or switching to a
  // foreign author) drops the data and the merged model recomputes to own-only.
  useEffect(() => {
    if (isEveryone && visibilityHydrated) return;
    qc.removeQueries({
      queryKey: trpc.leadForm.crossAuthorContent.queryKey(),
    });
  }, [isEveryone, visibilityHydrated, targetReportId, qc, trpc]);

  // Identity guard (mirror lead-form): on ANY identity change drop ALL cached
  // foreign content so user B can never read user A's foreign records.
  useEffect(() => {
    qc.removeQueries({
      queryKey: trpc.leadForm.crossAuthorContent.queryKey(),
    });
  }, [currentUserId, qc, trpc]);

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

  // Foreign CONTENT is merged only on the own deck, in Everyone, after
  // hydration — exactly the fetch gate above. The merge happens at the SLIDE-
  // MODEL layer producing NEW objects; it never mutates `byPeriodQ.data.section`
  // (the cached read-model the lead-form draft serializes), so Everyone stays
  // strictly view-only (design Decision 3, spec status-slide-rendering §4).
  const foreignContentRows = useMemo(
    () =>
      isEveryone && visibilityHydrated ? (crossAuthorContentQ.data ?? []) : [],
    [isEveryone, visibilityHydrated, crossAuthorContentQ.data],
  );
  const sectionModel = useMemo(() => {
    if (!byPeriodQ.data?.section) return null;
    return buildLeadDeckModel(
      byPeriodQ.data.section,
      // Health fold (risk-derived, toggle-independent) — own deck only.
      isOwnDeck ? (crossAuthorsQ.data ?? []) : [],
      foreignContentRows,
    );
  }, [byPeriodQ.data, crossAuthorsQ.data, foreignContentRows, isOwnDeck]);

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
      size="lg"
    />
  );

  if (scope === "product") {
    return (
      <div ref={deckRef}>
        {/* lead-demo-feedback #88: match the own-scope LeadSlideArticle inset
            (p-3) so toggling Summary↔Product never shifts the hero (the prior
            p-6 put the hero 12px lower/right than the own-scope path). */}
        <article className="slide-frame rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[var(--color-card)] p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
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
