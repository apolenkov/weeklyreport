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
  type SectionSlideModel,
  type SlideProduct,
} from "./section-slide-utils";
import { ScopeToggle, type ScopeValue } from "../report-shell/scope-toggle";
import { SlideFullscreenButton } from "./slide-fullscreen-button";

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

type CrossAuthorRow = {
  authorId: string;
  authorName: string;
  sharedProductIds: string[];
  items: {
    id: string;
    projectId: string;
    type: string;
    text: string;
    workflowStatus: string;
    priorityRank?: number | null;
  }[];
  risks: { id: string; projectId: string; risk: string; severity: string }[];
  decisions: { id: string; productId: string; text: string }[];
};

/** Build a minimal SectionSlideModel from a cross-author row for display. */
function buildCrossAuthorSlideModel(ca: CrossAuthorRow): SectionSlideModel[] {
  const currentItems = ca.items
    .filter((i) => i.type === "current" && i.text.trim())
    .map((i) => i.text.trim());
  const nextItems = ca.items
    .filter((i) => i.type === "next" && i.text.trim())
    .map((i) => i.text.trim());
  const risks = ca.risks.filter((r) => r.risk.trim()).map((r) => r.risk.trim());
  const decisions = ca.decisions
    .filter((d) => d.text.trim())
    .map((d) => d.text.trim());
  const priorities = ca.items
    .filter((i) => i.priorityRank != null && i.text.trim())
    .sort((a, b) => (a.priorityRank ?? 0) - (b.priorityRank ?? 0))
    .map((i) => i.text.trim());
  // T-G3: text→rank map so cross-author slides also pick up P{N} chips.
  const itemRanks = ca.items.reduce<Record<string, number>>((acc, i) => {
    if (i.priorityRank != null && i.text.trim()) {
      acc[i.text.trim()] = i.priorityRank;
    }
    return acc;
  }, {});

  const blockedCount =
    ca.items.filter((i) => i.workflowStatus === "blocked").length +
    ca.risks.filter((r) => r.severity === "blocked").length;
  const atRiskCount = ca.risks.filter((r) => r.severity === "at-risk").length;

  const tone: SectionSlideModel["tone"] =
    currentItems.length === 0 && nextItems.length === 0
      ? "empty"
      : blockedCount > 0
        ? "blocked"
        : atRiskCount > 0 || risks.length > 0
          ? "warning"
          : "ready";

  // Synthetic product card so LeadSlideArticle renders actual content via
  // LeadUnifiedSlide. "cross-product" id receives no status accent and is
  // excluded from chip generation.
  const syntheticProduct: SlideProduct = {
    id: "cross-product",
    name: ca.authorName,
    status: null,
    stages: [],
    currentItems,
    nextItems,
    risks,
    decisions,
    priorities,
    itemRanks,
  };

  const model: SectionSlideModel = {
    id: ca.authorId + "-cross",
    ownerId: ca.authorId,
    ownerName: ca.authorName,
    ownerRole: "lead",
    status: "submitted",
    submittedAt: null,
    products: [ca.authorName],
    productSlides: [syntheticProduct],
    productCount: 1,
    currentCount: currentItems.length,
    nextCount: nextItems.length,
    riskCount: risks.length,
    decisionCount: decisions.length,
    priorityCount: priorities.length,
    blockedCount,
    atRiskCount,
    score: currentItems.length > 0 && nextItems.length > 0 ? 80 : 40,
    tone,
    readiness: [],
    currentItems,
    nextItems,
    risks,
    decisions,
    priorities,
  };
  return [model];
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
  const crossAuthorQ = useQuery({
    ...trpc.leadForm.crossAuthorSections.queryOptions({
      reportId: targetReportId,
    }),
    enabled: scope === "product" && targetReportId !== "",
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
    const ownSlides = paginateSectionSlides(
      buildSectionSlideModel(byPeriodQ.data.section),
    );
    if (scope !== "product" || !crossAuthorQ.data?.length) return ownSlides;
    const foreignSlides = crossAuthorQ.data.flatMap((ca) =>
      buildCrossAuthorSlideModel(ca),
    );
    return [...ownSlides, ...foreignSlides];
  }, [byPeriodQ.data, scope, crossAuthorQ.data]);

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
        toolbar={
          !inReportMode ? (
            <div className="flex flex-wrap items-center gap-2">
              <ScopeToggle
                value={scope}
                onChange={(s) => {
                  setScope(s);
                  setSelectedIndex(0);
                }}
                allowedScopes={["own", "product"]}
              />
              {/* W9.A: fullscreen button in standalone slides mode */}
              <SlideFullscreenButton targetRef={deckRef} />
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
