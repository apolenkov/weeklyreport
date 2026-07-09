/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- the literal-union cast on severity is required by tsc (without it the ternary widens to string, TS2322), but ESLint's program flags it redundant; wave-6c-ii */
"use client";

import { Separator } from "@customreport/ui/components/ui/separator";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useContext, useEffect, useMemo, useRef, useState } from "react";

import { useFullscreen } from "../../../hooks/use-fullscreen";
import { useRecordVisibility } from "../../../hooks/use-record-visibility";
import { deriveActivityAlarmFloor } from "../../../lib/activity-alarm";
import { deriveActivityBucket } from "../../../lib/activity-buckets";
import { crossAuthorContentFetchEnabled } from "../../../lib/cross-author-content-gate";
import { SessionContext } from "../../../lib/session-provider";
import { useTRPC } from "../../../lib/trpc-context";
import { useQueryErrorHandler } from "../../../lib/use-query-error-handler";
import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import { AccordionSection } from "../../../shared/ui/report-shell/accordion-section";
import { AgentReviewComingSoon } from "../../../shared/ui/report-shell/agent-review-coming-soon";
import { ArchiveToggle } from "../../../shared/ui/report-shell/archive-toggle";
import {
  DocumentActionGroup,
  ReportToolbar,
} from "../../../shared/ui/report-shell/report-toolbar";
import { SaveNowButton } from "../../../shared/ui/report-shell/save-now-button";
import {
  segmentClassName,
  SegmentedToggle,
} from "../../../shared/ui/report-shell/segmented-toggle";
import { ViewModeToggle } from "../../../shared/ui/report-shell/view-mode-toggle";
import { SdlcTooltipProvider } from "../../../shared/ui/sdlc-tooltip";
import { VersionComingSoonControl } from "../../admin/ui/version-coming-soon";
import { PdfExportComingSoonControl } from "../../pdf-export/ui/pdf-export-coming-soon";
import { ActivityStatusSection } from "../../period/ui/activity-status-section";
import { CurrentWeekSection } from "../../period/ui/current-week-section";
import { DecisionsSection } from "../../period/ui/decisions-section";
import { FillFromButton } from "../../period/ui/fill-from-button";
import { PeriodNavigator } from "../../period/ui/period-navigator";
import { RequestReopenDialog } from "../../period/ui/request-reopen-dialog";
import { LeadReviewFeedback } from "../../review/ui/lead-review-feedback";
import { LeadSlidesClient } from "../../slides/ui/lead-slides-client";
import { SlideFullscreenButton } from "../../slides/ui/slide-fullscreen-button";
import {
  applyCrossAuthorStageOverrides,
  buildCrossAuthorStageMap,
  mapForeignDecisions,
  mapForeignItems,
  mapForeignRisks,
} from "../model/lead-cross-author";
import {
  mapLeadFormData,
  mapLeadReviewFeedback,
  ownedStagesForProject,
} from "../model/lead-form";
import { formatDateRange, isoWeekNumber } from "../model/lead-history";
import type {
  DecisionEntry,
  KanbanItem,
  Product,
  ReportPeriod,
  RiskEntry,
} from "../model/mock-data";
import { ItemEditDialog } from "./item-edit-dialog";
import { LeadFormSkeleton } from "./lead-form-skeleton";
import { LeadFormSyncBridge } from "./lead-form-sync-bridge";
import { NextWeekSection } from "./next-week-section";
import { QuickAddButton } from "./quick-add-button";
import {
  type UnifiedActivityEntry,
  UnifiedActivitySection,
} from "./unified-activity-section";
import { useLeadFormDraftMerges } from "./use-lead-form-draft-merges";
import { useLeadFormDraftOrchestration } from "./use-lead-form-draft-orchestration";
import { useLeadFormWriteActions } from "./use-lead-form-write-actions";

interface LeadFormProps {
  /**
   * 35-07: explicit report identifier from the dynamic `[reportId]` route
   * segment. When provided, the form scopes data load + actions to that
   * specific report instead of the session's active period.
   *
   * When omitted (bare `/lead/report` path), the form still falls back to
   * `reports.getActive` and — once resolved — performs a `router.replace`
   * to the canonical addressed URL `/lead/report/<reportId>` so bookmarks
   * and shared links work.
   */
  readonly reportId?: string;
  readonly mode?: "edit" | "slides";
  /**
   * 35-07: when true, the form auto-redirects (router.replace) to the
   * canonical addressed URL once the active reportId is known. Off when
   * already on a `[reportId]` route.
   */
  readonly redirectToCanonical?: boolean;
}

// SVG Icon components
function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 flex-shrink-0"
      stroke="var(--color-primary)"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3h7v7H3z" />
      <path d="M14 3h7v7h-7z" />
      <path d="M3 14h7v7H3z" />
      <path d="M14 14h7v7h-7z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 flex-shrink-0"
      stroke="var(--color-primary)"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function NextWeekIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 flex-shrink-0"
      stroke="var(--color-primary)"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M12 16l3-3-3-3" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 flex-shrink-0"
      stroke="var(--color-destructive)"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 flex-shrink-0"
      stroke="var(--color-starbucks-accent)"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  );
}

export { sectionToDraftPayload } from "../model/lead-section-draft-payload";

const NO_PRODUCTS_ASSIGNED_MESSAGE = "No products assigned — contact admin";

/**
 * scope-lead-report-to-own-contribution (7c.1): the lead form's Record
 * visibility toggle. A two-state segmented control — "Mine only" (default) /
 * "Everyone". Lead-form only; view-only (it changes what the lead sees, never
 * what is submitted or published — D4b). English label per the repo UI-string
 * rule.
 */
function RecordVisibilityToggle({
  value,
  onChange,
  disabled = false,
}: {
  readonly value: "mine" | "everyone";
  readonly onChange: (next: "mine" | "everyone") => void;
  /**
   * slides-record-visibility (Decision 6): on a FOREIGN-author slide deck
   * Everyone is not offered — the toggle is forced to Mine and made inert so the
   * current user's co-owner rows can never be merged onto another author's deck.
   */
  readonly disabled?: boolean;
}) {
  // Icon-only (User = mine, Users = everyone) so the toggle stays compact and
  // does not crowd the period navigator; each keeps an accessible name via
  // aria-label + tooltip.
  const options: {
    key: "mine" | "everyone";
    label: string;
    Icon: typeof User;
  }[] = [
    { key: "mine", label: "Mine only", Icon: User },
    { key: "everyone", label: "Everyone", Icon: Users },
  ];
  return (
    <SegmentedToggle ariaLabel="Record visibility">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          aria-label={option.label}
          title={option.label}
          disabled={disabled}
          onClick={() => onChange(option.key)}
          className={`btn-press ${segmentClassName(value === option.key, {
            iconOnly: true,
          })} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <option.Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      ))}
    </SegmentedToggle>
  );
}

export function LeadForm({
  reportId: pinnedReportId,
  redirectToCanonical,
  mode = "edit",
}: LeadFormProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSlidesMode = mode === "slides";
  // W9.A: ref shared between lead-form header (SlideFullscreenButton) and LeadSlidesClient (deck root div)
  const deckRef = useRef<HTMLDivElement>(null);
  const fullscreenToggleRef = useRef<HTMLButtonElement>(null);
  // add-slide-fullscreen-exit-affordance: lead-form is the SINGLE fullscreen
  // owner on the hosted path. It threads isFullscreen + toggle into BOTH its
  // toolbar toggle AND LeadSlidesClient (whose local hook is disabled), so
  // exactly one `f`/fullscreenchange listener exists. Focus returns to the
  // toolbar toggle on exit. Gated on slides mode so the edit form adds no `f`.
  const slidesFullscreen = useFullscreen(
    deckRef,
    fullscreenToggleRef,
    isSlidesMode,
  );
  const sessionState = useContext(SessionContext);
  const sessionRole = sessionState?.user?.role ?? null;
  const isHeadLikeSession = sessionRole === "head" || sessionRole === "admin";
  const shouldRouteHeadLikeAwayFromLeadForm = isHeadLikeSession;
  const shouldDeferForSession = Boolean(sessionState?.isLoading);

  // Three queries compose the lead-form view. `byPeriod` depends on
  // identifiers from `getActive` (or — 35-07 — the pinned `reportId` from
  // the dynamic route), so it's gated by `enabled`.
  const activeQ = useQuery(trpc.reports.getActive.queryOptions());
  const activeReportId = activeQ.data?.reportId ?? "";
  const activeSectionId = activeQ.data?.reportSectionId ?? "";

  // 35-07: when the page renders under `/lead/report/[reportId]`, scope the
  // data load to the path-segment id rather than the session's active period.
  // This lets the lead view (and bookmark) any past week of their own history.
  const targetReportId =
    pinnedReportId && pinnedReportId !== "" ? pinnedReportId : activeReportId;

  const byPeriodQ = useQuery({
    ...trpc.leadForm.byPeriod.queryOptions({
      reportId: targetReportId,
    }),
    enabled:
      targetReportId !== "" &&
      !shouldRouteHeadLikeAwayFromLeadForm &&
      !shouldDeferForSession,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // The section id for actions (autosave / submit / revoke) comes from the
  // loaded section when a reportId is pinned (the active session's section
  // id may not match the pinned report). Fall back to activeSectionId for
  // the bare-route case until byPeriod resolves.
  const sectionIdForActions =
    byPeriodQ.data?.section.reportSectionId ?? activeSectionId;

  const historyQ = useQuery(trpc.reports.myHistory.queryOptions());

  // Org-level presentation flag for the opt-in unified by-state view (ADR
  // 0011). Classic two-section format is the default until the flag loads —
  // and stays the default when it is off.
  const viewSettingsQ = useQuery(trpc.leadForm.viewSettings.queryOptions());
  const unifiedView = viewSettingsQ.data?.unifiedActivityView === true;

  // F1: load other authors who share a product with the current user.
  // Only relevant when viewing your own section (not a foreign-author view).
  const crossAuthorsQ = useQuery({
    ...trpc.leadForm.crossAuthors.queryOptions({
      reportId: targetReportId,
    }),
    enabled: targetReportId !== "",
  });

  // Foreign stage health for the lead's shared products. The cross-author
  // query already carries authorInitials + RISK-DERIVED per-stage status, so
  // the pipeline entries map straight from it — no foreign item/risk/decision
  // text crosses the API boundary. This status-only read is ALWAYS fetched and
  // ALWAYS drives honest product health; the toggle never gates it (D4a).
  const crossAuthorEntries: import("../../period/ui/sdlc-pipeline").CrossAuthorEntry[] =
    crossAuthorsQ.data ?? [];

  // scope-lead-report-to-own-contribution (7c): Record visibility toggle. The
  // key is namespaced by the signed-in user AND the loaded report so an
  // "everyone" choice cannot bleed across users (shared browser / dev
  // role-switcher) or across reports (D4c). The toggle is lead-form-only.
  const currentUserId = sessionState?.user?.id ?? null;
  const {
    visibility: recordVisibility,
    hydrated: visibilityHydrated,
    setVisibility: setRecordVisibility,
  } = useRecordVisibility(currentUserId, targetReportId);
  const isEveryone = recordVisibility === "everyone";

  // slides-record-visibility (Decision 6): the slide deck can target another
  // author's deck via `?authorId`. On such a FOREIGN deck Everyone is not
  // offered — force the toolbar toggle to Mine and make it inert. The deck
  // (LeadSlidesClient) enforces the same own-deck gate independently, so this
  // is the matching toolbar affordance, not the security boundary.
  const slidesAuthorId = searchParams.get("authorId");
  const isForeignSlidesDeck =
    isSlidesMode && slidesAuthorId !== null && slidesAuthorId !== currentUserId;
  const toolbarVisibility = isForeignSlidesDeck ? "mine" : recordVisibility;

  // 7c.3: the full-content read is fetched ONLY in the Everyone state, and only
  // AFTER the persisted toggle has hydrated — so it never fires on the
  // pre-hydration "mine" default and then races a restored "everyone".
  // close-slides-visibility-tails (tail 1): gate via the shared predicate, with
  // own-deck = !isForeignSlidesDeck, so a foreign slides deck NEVER fires the
  // read regardless of the persisted Everyone toggle (matches LeadSlidesClient).
  const crossAuthorContentQ = useQuery({
    ...trpc.leadForm.crossAuthorContent.queryOptions({
      reportId: targetReportId,
    }),
    enabled: crossAuthorContentFetchEnabled({
      hasReport: targetReportId !== "",
      visibilityHydrated,
      isEveryone,
      isOwnDeck: !isForeignSlidesDeck,
    }),
  });

  // 7c.6: purge the fetched foreign full content from the query cache whenever
  // the toggle leaves Everyone OR is not yet hydrated for the current context.
  // `enabled:false` (above) stops a refetch; removing the cached query drops
  // the data so the merged display arrays recompute to own-only. A later return
  // to Everyone re-fetches rather than serving stale. The purge uses the bare
  // procedure prefix (`queryKey()`, no input) so a report switch also drops the
  // PRIOR report's cached content, not just the current report's.
  useEffect(() => {
    if (isEveryone && visibilityHydrated) return;
    qc.removeQueries({
      queryKey: trpc.leadForm.crossAuthorContent.queryKey(),
    });
  }, [isEveryone, visibilityHydrated, targetReportId, qc, trpc]);

  // 7c.6 (identity guard): the `crossAuthorContent` cache key is scoped by
  // reportId only, NOT by user — so two identities on the SAME browser + same
  // QueryClient + same report could otherwise share a cache entry. On ANY
  // identity change (logout, role switch, authz downgrade) drop ALL cached
  // foreign content unconditionally, so user B can never read user A's foreign
  // records even while both sit in Everyone. The dev switcher / logout do a
  // full reload (fresh QueryClient) today; this guard makes the invariant hold
  // regardless of the navigation mechanism. The lead form shows all assigned
  // products at once (no per-product selector), so identity + report purges
  // cover every real context-switch surface.
  useEffect(() => {
    qc.removeQueries({
      queryKey: trpc.leadForm.crossAuthorContent.queryKey(),
    });
  }, [currentUserId, sessionRole, qc, trpc]);

  // 35-07: bare route → replace URL with the canonical addressed form once
  // the active reportId is known. Skipped when:
  //   • the page already renders under `[reportId]` (pinnedReportId set)
  //   • there is no active period (server returned null) — the form will
  //     show the existing empty / skeleton state.
  useEffect(() => {
    if (!redirectToCanonical) return;
    if (pinnedReportId) return;
    if (shouldRouteHeadLikeAwayFromLeadForm) return;
    if (!activeReportId) return;
    const next = new URLSearchParams();
    if (isSlidesMode) next.set("mode", "slides");
    const query = next.toString();
    const suffix = query ? `?${query}` : "";
    router.replace(`/lead/report/${activeReportId}${suffix}`);
  }, [
    redirectToCanonical,
    pinnedReportId,
    activeReportId,
    isSlidesMode,
    shouldRouteHeadLikeAwayFromLeadForm,
    router,
  ]);

  useEffect(() => {
    if (!shouldRouteHeadLikeAwayFromLeadForm) return;
    const destination = pinnedReportId
      ? `/head/report/${encodeURIComponent(pinnedReportId)}`
      : "/head/dashboard";
    router.replace(destination);
  }, [pinnedReportId, router, shouldRouteHeadLikeAwayFromLeadForm]);

  // Query error policy — log + toast via unified hook (design.md D1/D2).
  useQueryErrorHandler(activeQ, {
    event: "leadForm.activeReport.load_failed",
    component: "LeadForm",
    procedure: "reports.getActive",
    context: { reportId: pinnedReportId ?? null },
    toastPrefix: "Failed to load active report",
  });

  useQueryErrorHandler(byPeriodQ, {
    event: "leadForm.byPeriod.load_failed",
    component: "LeadForm",
    procedure: "leadForm.byPeriod",
    context: { reportId: targetReportId || null, role: sessionRole },
    toastPrefix: "Failed to load form",
  });

  useQueryErrorHandler(historyQ, {
    event: "leadForm.history.load_failed",
    component: "LeadForm",
    procedure: "reports.myHistory",
    toastPrefix: "Failed to load history",
  });

  // ---- Local UI + draft state ----
  const {
    autosave,
    draftPayload,
    draftSection,
    handleConflict,
    isSubmitted,
    setDraftSection,
    setIsSubmitted,
    setVersionSafe,
    versionRef,
  } = useLeadFormDraftOrchestration({
    serverSection: byPeriodQ.data?.section,
    sectionIdForActions,
    serverReadOnly: byPeriodQ.data ? byPeriodQ.data.readOnly : true,
    refetchSection: byPeriodQ.refetch,
  });

  const writeActionSubmitContextRef = useRef<{
    draftPayload: typeof draftPayload;
    products: readonly Product[];
    ownRisks: readonly RiskEntry[];
  }>({ draftPayload: null, products: [], ownRisks: [] });

  const {
    confirmRevoke,
    fillFromMut,
    handleConfirmSubmit,
    handleFillFrom,
    handleRequestReopen,
    handleRevoke,
    handleSubmit,
    openReopenDialog,
    closeReopenDialog,
    reopenError,
    requestReopenMut,
    revokeMut,
    setShowRevokeDialog,
    setShowSubmitConfirm,
    showReopenDialog,
    showRevokeDialog,
    showSubmitConfirm,
    submitMut,
  } = useLeadFormWriteActions({
    sectionIdForActions,
    autosaveDirty: autosave.dirty,
    getSubmitContext: () => writeActionSubmitContextRef.current,
    versionRef,
    setVersionSafe,
    setIsSubmitted,
    handleConflict,
  });

  const draftMergeContextRef = useRef<{
    products: readonly Product[];
    currentWeekItems: readonly KanbanItem[];
    nextWeekItems: readonly KanbanItem[];
  }>({ products: [], currentWeekItems: [], nextWeekItems: [] });

  const {
    currentWeekAddSignal,
    decisionsAddSignal,
    handleActivityRaiseRequiresRisk,
    handleActivityStatusChange,
    handleAddCurrentWeekItem,
    handleAddDecision,
    handleAddNextWeekItem,
    handleAddRisk,
    handleCurrentWeekItemsChange,
    handleDecisionsChange,
    handleMarkComplete,
    handleMoveToCurrentWeek,
    handleMoveToNextWeek,
    handleNextWeekItemsChange,
    handlePauseItem,
    handleProductsChange,
    handleQuickAdd,
    handleQuickAddCancel,
    handleQuickAddSave,
    handleRisksChange,
    nextWeekAddSignal,
    quickAddItem,
    riskPrefill,
    risksAddSignal,
  } = useLeadFormDraftMerges({
    setDraftSection,
    getLoadedContext: () => draftMergeContextRef.current,
  });

  // simplify-stage-status-interaction (D4): stages the lead left unset (null
  // traffic) auto-promote to On Track at submit, warned first. stageStatuses
  // only carries the lead's OWN stages, so a null entry is a genuinely unset
  // own stage. Both the confirm-dialog warning and the coercion below read this
  // one count, so they can never disagree.
  const unsetOwnStageCount = (draftPayload?.stageStatuses ?? []).filter(
    (s) => s.status == null,
  ).length;

  const isLoading =
    activeQ.isLoading || byPeriodQ.isLoading || historyQ.isLoading;
  const awaitingRoleRedirect = shouldRouteHeadLikeAwayFromLeadForm;
  const awaitingCanonicalRedirect =
    !!redirectToCanonical && !pinnedReportId && activeReportId !== "";

  // Toggle All state — must live above the early return below, otherwise
  // the hook count drifts between renders and React throws "Rendered more
  // hooks than during the previous render". Each Toggle All click flips
  // groupExpanded; AccordionSection mirrors the new value into its local
  // state. Individual sections may then drift again via clicks.
  const [groupExpanded, setGroupExpanded] = useState(true);

  // 35-07: set document.title to surface the addressed week in the browser
  // tab. Format: "Week 19, May 4-10 - CustomReport". Resolved from the
  // history entry whose reportId matches the loaded section so the label
  // matches the dropdown. Restores the title on unmount.
  const titleHistoryEntry = useMemo(() => {
    if (!byPeriodQ.data?.section.reportId || !historyQ.data) return null;
    return (
      historyQ.data.find(
        (h) => h.reportId === byPeriodQ.data.section.reportId,
      ) ?? null
    );
  }, [byPeriodQ.data, historyQ.data]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!titleHistoryEntry) return;
    const start = titleHistoryEntry.periodStart;
    const week = isoWeekNumber(start);
    const range = formatDateRange(start, titleHistoryEntry.periodEnd);
    const previous = document.title;
    document.title = `Week ${week}, ${range} - CustomReport`;
    return () => {
      document.title = previous;
    };
  }, [titleHistoryEntry]);

  const [showArchivePeriods, setShowArchivePeriods] = useState(false);
  const selectedPeriodId = pinnedReportId || activeQ.data?.reportId || "";
  const selectedHistoryPeriod = historyQ.data?.find(
    (entry) => entry.reportId === selectedPeriodId && entry.reportId !== "",
  );

  useEffect(() => {
    if (selectedHistoryPeriod?.archived) {
      setShowArchivePeriods(true);
    }
  }, [selectedHistoryPeriod?.reportId, selectedHistoryPeriod?.archived]);

  // Skeleton until all queries settle.
  if (
    isLoading ||
    awaitingRoleRedirect ||
    awaitingCanonicalRedirect ||
    activeQ.data === undefined ||
    !byPeriodQ.data ||
    !historyQ.data ||
    !draftSection
  ) {
    return <LeadFormSkeleton />;
  }

  // Map raw draft state -> Lead* presentation shapes for existing children.
  const data = mapLeadFormData({
    active: activeQ.data ?? draftSection,
    byPeriod: {
      section: draftSection,
      readOnly: byPeriodQ.data.readOnly,
      canRequestReopen: byPeriodQ.data.canRequestReopen,
    },
    history: historyQ.data,
  });

  // review-acknowledgement (§8): reviewer comments on this lead's OWN records,
  // read from the authoritative SERVER section (not the editable `draftSection`,
  // whose in-place edits could drop the joined comments). Surfaced read-only so a
  // returned (draft) section's feedback is never silent.
  const reviewFeedback = mapLeadReviewFeedback(byPeriodQ.data.section);

  // F8 / unassigned-stage-reporting-exclusion: enrich foreign-owned (locked)
  // stages with cross-author initials + risk-derived status. crossAuthorsQ.data
  // has { projectId, stageNames, authorInitials, stages } per shared product. A
  // stage in the product's stageSet not owned by the current user arrives as
  // ownership:"locked" with a null assignee (from buildStageGrid); this override
  // fills that lead's initials and risk-derived color. No foreign
  // item/risk/decision text is read here.
  //
  // 7c.4: the foreign stage CHIPS show only in Everyone. In Mine only we skip
  // the override so co-owners' stages stay hidden. Product
  // HEALTH stays honest in BOTH states — it derives from `crossAuthorEntries`
  // (the always-fetched status read) inside SdlcPipeline, independent of these
  // chips (D4d).
  const crossAuthorStageMap = buildCrossAuthorStageMap(
    crossAuthorsQ.data ?? [],
  );
  const products: Product[] = (
    isEveryone
      ? applyCrossAuthorStageOverrides(data.products, crossAuthorStageMap)
      : data.products
  ) as Product[];

  // activity-first-class: the author's attached activities offered as record
  // parents in the item/risk dialogs (id + display name only).
  const activityOptions: readonly { id: string; name: string }[] =
    draftSection.activities.map((a) => ({
      id: a.activityId,
      name: a.activityName,
    }));

  const ownCurrentWeekItems: KanbanItem[] =
    data.currentWeekItems as KanbanItem[];
  const ownNextWeekItems: KanbanItem[] = data.nextWeekItems as KanbanItem[];
  const ownRisks: RiskEntry[] = data.risks as RiskEntry[];
  const ownDecisions: DecisionEntry[] = data.decisions as DecisionEntry[];
  writeActionSubmitContextRef.current = { draftPayload, products, ownRisks };

  // The interactive pill's alarm floor re-derived from the LIVE draft risks
  // (the server-baked alarmFloor goes stale the moment a draft risk is added
  // or removed — no refetch mid-edit). Activity twin of the stage chips'
  // applyRiskSeverityFloor; read-only surfaces keep the server value.
  const activityCards = data.activityCards.map((card) => ({
    ...card,
    alarmFloor: deriveActivityAlarmFloor(card.activityId, ownRisks),
  }));

  // 7c.4: Everyone merges co-owners' full records READ-ONLY on top of the
  // lead's own records, from the gated full-content read. Mine only renders
  // own records only (no full-content fetch). The merge is view-only: the
  // draft-merge handlers strip every `.foreign` row, so it never reaches the
  // submission (D4b).
  const productNameById = new Map(products.map((p) => [p.id, p.name]));
  // close-slides-visibility-tails (tail 1, belt-and-suspenders): also gate the
  // consume site on !isForeignSlidesDeck so foreign rows are excluded at BOTH
  // the fetch and the merge — robust even if this memo is ever reused outside
  // the edit-render branch. After the fetch gate the data is already empty on a
  // foreign deck; this makes the invariant explicit rather than incidental.
  const foreignContentRows =
    isEveryone && visibilityHydrated && !isForeignSlidesDeck
      ? (crossAuthorContentQ.data ?? [])
      : [];
  const currentWeekItems: KanbanItem[] = [
    ...ownCurrentWeekItems,
    ...mapForeignItems(foreignContentRows, productNameById, "current"),
  ];
  const nextWeekItems: KanbanItem[] = [
    ...ownNextWeekItems,
    ...mapForeignItems(foreignContentRows, productNameById, "next"),
  ];
  draftMergeContextRef.current = { products, currentWeekItems, nextWeekItems };
  const risks: RiskEntry[] = [
    ...ownRisks,
    ...mapForeignRisks(foreignContentRows, productNameById),
  ];
  const decisions: DecisionEntry[] = [
    ...ownDecisions,
    ...mapForeignDecisions(foreignContentRows, productNameById),
  ];

  /**
   * All priority ranks already assigned to own (non-foreign) items for the
   * entire period (current + next week). Passed to each week section so the
   * ItemEditDialog can disable taken ranks in the picker. Foreign items are
   * intentionally excluded — they are read-only and cannot be edited.
   */
  const ownPeriodRanks: readonly number[] = [
    ...ownCurrentWeekItems,
    ...ownNextWeekItems,
  ]
    .map((i) => i.priorityRank)
    .filter((r): r is number => r != null);

  // Resolve-not-delete (ADR 0015): translate the server's published lineage
  // (durable stableIds) into the presentation row ids currently on screen, so
  // the cards can mark locked records and withhold Delete. Advisory only —
  // the save-path guard on the server is the enforcement point.
  const publishedLineage = byPeriodQ.data.publishedLineage;
  const lockedItemLineage = new Set(publishedLineage.itemStableIds);
  const lockedDecisionLineage = new Set(publishedLineage.decisionStableIds);
  const publishedLockedItemIds: ReadonlySet<string> = new Set(
    draftSection.items.flatMap((item) =>
      item.id && item.stableId && lockedItemLineage.has(item.stableId)
        ? [item.id]
        : [],
    ),
  );
  const publishedLockedDecisionIds: ReadonlySet<string> = new Set(
    draftSection.decisions.flatMap((decision) =>
      decision.id &&
      decision.stableId &&
      lockedDecisionLineage.has(decision.stableId)
        ? [decision.id]
        : [],
    ),
  );

  // A reopened period's section still carries published-lineage records, so the
  // server's fillFrom guard rejects every source (PUBLISHED_RECORD_LOCKED).
  // Mirror the RAW lineage check here to disable the control instead of
  // offering an action that always fails; the server guard stays the
  // enforcement point.
  const fillFromLocked =
    publishedLineage.itemStableIds.length > 0 ||
    publishedLineage.decisionStableIds.length > 0;

  // Unified by-state entries: each displayed item plus its derived bucket
  // (deriveActivityBucket over the RAW persisted fields — a pure projection;
  // Item.type storage is untouched). Foreign read-only rows have no raw row
  // in the draft, so their bucket derives from the presentation status.
  const rawItemById = new Map(
    draftSection.items.flatMap((item) =>
      item.id ? [[item.id, item] as const] : [],
    ),
  );
  const toUnifiedEntry = (
    item: KanbanItem,
    week: "current" | "next",
  ): UnifiedActivityEntry => {
    const raw = item.foreign === true ? undefined : rawItemById.get(item.id);
    if (raw) {
      return {
        item,
        week,
        bucket: deriveActivityBucket({
          type: raw.type,
          workflowStatus: raw.workflowStatus,
          carriedOver: raw.carriedOver,
        }),
      };
    }
    const bucket =
      item.status === "completed"
        ? "done"
        : item.status === "paused"
          ? "paused"
          : item.status === "postponed"
            ? "deferred"
            : item.status === "planned"
              ? "planned-next"
              : "in-progress";
    return { item, week, bucket };
  };
  const unifiedEntries: UnifiedActivityEntry[] = [
    ...currentWeekItems.map((item) => toUnifiedEntry(item, "current")),
    ...nextWeekItems.map((item) => toUnifiedEntry(item, "next")),
  ];

  const periods: ReportPeriod[] = data.periods as ReportPeriod[];
  const currentUser = data.currentUser;
  const selectedPeriod = periods.find(
    (period) => period.id === selectedPeriodId && period.id !== "",
  );
  const hasArchivedPeriods = periods.some((period) => period.archived);
  const visibleNonArchivedPeriods = periods.filter(
    (period) => !period.archived,
  );
  const visiblePeriods =
    !hasArchivedPeriods ||
    showArchivePeriods ||
    visibleNonArchivedPeriods.length === 0
      ? periods
      : selectedPeriod?.archived
        ? [...visibleNonArchivedPeriods, selectedPeriod]
        : visibleNonArchivedPeriods;

  const isReadOnly = data.readOnly || isSubmitted;

  // 35-04: per-project stages-the-lead-owns selector. Forwarded into the
  // Item / Risk / Decision dialogs so the SDLC stage dropdown is scoped per
  // project (unify-record-dialogs made decisions product-scoped too).
  const stagesForProduct = (productId: string) =>
    ownedStagesForProject(draftSection, productId);

  function handleToggleAll() {
    setGroupExpanded((prev) => !prev);
  }

  // Autosave indicator label — 4-state badge.
  const autosaveLabel =
    autosave.state === "saving"
      ? "↻ Saving…"
      : autosave.state === "pending"
        ? "● Pending…"
        : autosave.state === "saved" && autosave.lastSavedAt
          ? autosave.lastSavedAt.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : autosave.state === "error"
            ? "⚠ Save failed"
            : "Autosaved";

  // Trailing utility control (edit mode): collapse/expand all sections. The
  // slot is always reserved and disabled when the report has nothing to
  // collapse, so adding/removing sections in-session never shifts the row.
  const hasCollapsibleContent =
    currentWeekItems.length > 0 ||
    nextWeekItems.length > 0 ||
    risks.length > 0 ||
    decisions.length > 0;
  const collapseAllLabel = groupExpanded
    ? "Collapse all sections"
    : "Expand all sections";

  return (
    <SdlcTooltipProvider>
      <form className="space-y-6" data-testid="lead-report-form">
        {/* Page header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="min-w-0">
              <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
                My Report
              </h1>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                Your report draft and status context.
              </p>
            </div>
            {/* Submitted state uses the .b-ok variant (light teal bg + dark
                teal text) — matches mockup s2 rather than the heavier
                white-on-dark-teal `.b-done` look that read as a destructive
                "locked" signal. */}
            {!isSlidesMode &&
              (isSubmitted ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-starbucks-accent)]">
                  ✓ Submitted
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
                  {autosaveLabel}
                </span>
              ))}
          </div>
          {/* report-toolbar-layout: document actions live on the header line's
              right slot, not inside the bordered toolbar. A read-only past
              period hides the real mutating actions (Save/Submit/Fill-From)
              while the inert Coming-soon stubs remain (deferred-feature-pattern).
              Submit is the single brand-green forward primary; reversal
              actions (Request Reopen / Revoke) stay neutral/outline so green
              keeps one "forward, safe-to-commit" meaning. */}
          <DocumentActionGroup>
            <VersionComingSoonControl />
            {/* TODO(lead-pdf-export): lead is excluded from pdfExport
                (role-coverage-gate); this inert ComingSoon control never
                reaches a backend call. */}
            <PdfExportComingSoonControl />
            {!isReadOnly && (
              <FillFromButton
                periods={visiblePeriods}
                disabled={fillFromMut.isPending}
                lockedReason={
                  fillFromLocked
                    ? "Fill from previous cannot replace records that are part of the published report."
                    : undefined
                }
                onFillFrom={handleFillFrom}
              />
            )}
            {!isReadOnly && <SaveNowButton autosave={autosave} />}
            {/* reopen-request-lifecycle (D4): the control is driven by the
                server-computed `canRequestReopen` flag — hidden when the period
                is published/archived or a request is already pending. The client
                does NOT reconstruct the lifecycle policy. */}
            {isSubmitted &&
              currentUser.authorRole === "lead" &&
              data.canRequestReopen && (
                <button
                  type="button"
                  className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={openReopenDialog}
                  disabled={requestReopenMut.isPending}
                  title="Ask Head to unlock this section"
                >
                  Request Reopen
                </button>
              )}
            {isSubmitted && currentUser.authorRole !== "lead" && (
              <button
                type="button"
                className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleRevoke}
                disabled={revokeMut.isPending}
                title="Revoke submission and unlock the section"
              >
                Revoke
              </button>
            )}
            {/* Quick-add: one picker button routing to the existing per-type
                dialogs (current-item / next-item / decision / risk /
                blocker). report-toolbar-layout: sits immediately before the
                Submit commit — after Save and Fill-From — and stays visible
                in both edit and slides mode so it never disappears. */}
            {!isReadOnly && (
              <QuickAddButton
                onPick={handleQuickAdd}
                disabled={products.length === 0}
              />
            )}
            {!isSubmitted && !isReadOnly && (
              <button
                type="button"
                className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleSubmit}
                disabled={submitMut.isPending}
              >
                Submit
              </button>
            )}
          </DocumentActionGroup>
        </header>

        {/* report-toolbar-layout: the bordered toolbar holds only the
            Context-control bar: Agent review · period nav · show-archived ·
            Mine|Everyone · Edit|Slides · collapse/fullscreen. */}
        <ReportToolbar
          sticky
          contextControls={
            <>
              {/* Period navigation (and the show-archived filter) anchor the
                  left; the view controls are pushed to the right by the spacer
                  so "where you are" and "how you see it" read as two clusters. */}
              <PeriodNavigator
                periods={visiblePeriods}
                showLeadSubmissionMarkers
                leadSubmittedAt={byPeriodQ.data.section.submittedAt ?? null}
              />
              {/* Show-archived filter renders only when the lead has archived
                  periods (lead-report-controls-integrity). */}
              {hasArchivedPeriods && (
                <>
                  <Separator
                    orientation="vertical"
                    className="h-5 bg-[var(--color-border)]"
                  />
                  <ArchiveToggle
                    checked={showArchivePeriods}
                    onChange={setShowArchivePeriods}
                  />
                </>
              )}
              <div className="grow" aria-hidden="true" />
              {/* Inert Agent-review placeholder leads the right-aligned view
                  group (head-toolbar-semantics: compact, leading edge). */}
              <AgentReviewComingSoon compact />
              {/* slides-record-visibility: the Record-visibility toggle now
                  renders in BOTH edit and slides (report-toolbar-parity) so the
                  controls after it never shift between modes. In slides it
                  drives the deck via the props threaded into LeadSlidesClient.
                  Disabled until the persisted state hydrates so a click cannot
                  race the restored value. */}
              <RecordVisibilityToggle
                value={toolbarVisibility}
                onChange={setRecordVisibility}
                disabled={isForeignSlidesDeck}
              />
              <ViewModeToggle
                mode={isSlidesMode ? "slides" : "edit"}
                editHref={
                  targetReportId
                    ? `/lead/report/${encodeURIComponent(targetReportId)}`
                    : "/lead/report"
                }
                slidesHref={
                  targetReportId
                    ? `/lead/report/${encodeURIComponent(
                        targetReportId,
                      )}?mode=slides`
                    : "/lead/report"
                }
              />
              {/* Mode-adaptive trailing utility: one fixed-width icon slot.
                  Edit → collapse/expand all sections (always reserved, disabled
                  when empty so the row never shifts); slides → fullscreen toggle.
                  Both render as a square icon button at the shared toolbar
                  height in the same trailing position. */}
              {isSlidesMode ? (
                <SlideFullscreenButton
                  isFullscreen={slidesFullscreen.isFullscreen}
                  onToggle={slidesFullscreen.toggle}
                  buttonRef={fullscreenToggleRef}
                />
              ) : (
                <button
                  type="button"
                  className="btn-press inline-flex h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleToggleAll}
                  disabled={!hasCollapsibleContent}
                  aria-label={collapseAllLabel}
                  title={collapseAllLabel}
                >
                  <CollapseIcon />
                </button>
              )}
            </>
          }
        />

        {/* Read-only banner for past periods. Triggered — 35-07 — when the
            page renders under a `[reportId]` segment that points at a
            past report instead of the lead's active section. */}
        {pinnedReportId &&
          activeReportId &&
          pinnedReportId !== activeReportId &&
          !isSubmitted && (
            <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
              <span className="text-sm text-[var(--color-muted-foreground)]">
                Viewing past period. This form is read-only.
              </span>
            </div>
          )}

        {isSlidesMode ? (
          <LeadSlidesClient
            initialReportId={targetReportId || pinnedReportId || null}
            chrome="content"
            deckRef={deckRef}
            // add-slide-fullscreen-exit-affordance: lead-form owns the single
            // fullscreen hook; the deck's local hook is disabled and it renders
            // the floating pill + Esc hint presentationally from these props.
            isFullscreen={slidesFullscreen.isFullscreen}
            onToggle={slidesFullscreen.toggle}
            // slides-record-visibility: thread the toolbar's visibility state so
            // the deck shows Mine vs Everyone. LeadSlidesClient owns the own-deck
            // gate + the gated cross-author fetch/merge; lead-form just supplies
            // the (hydrated) toggle value, forced to Mine on a foreign deck.
            visibilityMode={toolbarVisibility}
            visibilityHydrated={visibilityHydrated}
          />
        ) : (
          // Split-view: at xl the edit form (left) sits beside a live slide
          // preview (right) fed from the same draftSection — one source, no
          // extra fetch. Below xl it stays single-column; ?mode=slides handles
          // the standalone deck.
          <div className="min-w-0 space-y-6">
            {/* review-acknowledgement (§8): reviewer feedback on a returned
                section surfaces read-only above the editable content, so the
                lead sees what to fix before resubmitting. Self-suppresses when
                there is none. */}
            <LeadReviewFeedback records={reviewFeedback} />
            <LeadFormSyncBridge.Provider
              products={products}
              activities={activityOptions}
              risks={ownRisks}
              onProductsChange={handleProductsChange}
              onRisksChange={handleRisksChange}
              readOnly={isReadOnly}
              stagesForProduct={stagesForProduct}
              {...(draftSection.authorName
                ? { sectionAuthorName: draftSection.authorName }
                : {})}
              risksAddSignal={risksAddSignal}
              crossAuthors={crossAuthorEntries}
              // lead-mine-hide-unowned-stages: until the persisted visibility is
              // hydrated, render the full grid ("everyone") to avoid a flash that
              // briefly hides foreign/vacant chips when the restored value is
              // "everyone" (the gated content fetch is likewise hydration-guarded).
              visibilityMode={
                visibilityHydrated ? recordVisibility : "everyone"
              }
              displayRisks={risks}
              externalRiskPrefill={riskPrefill}
            >
              <AccordionSection
                groupExpanded={groupExpanded}
                testId="lead-section-product-status"
                icon={<GridIcon />}
                title="Product Status"
                badge={`${products.length} assigned products`}
                subtitle="Assigned stages are highlighted. Blocked and at-risk stages link to the context you need to resolve them."
              >
                <LeadFormSyncBridge.Pipeline />
              </AccordionSection>

              {/* Project Activities — stage-less units beside products.
                  Self-suppresses when the author has no attached activities
                  (attachment is admin-provisioned, so there is no add here). */}
              {draftSection.activities.length > 0 && (
                <AccordionSection
                  groupExpanded={groupExpanded}
                  testId="lead-section-activities"
                  icon={<GridIcon />}
                  title="Project Activities"
                  badge={`${draftSection.activities.length} attached activities`}
                  subtitle="Weekly status for activities you are attached to. Activities carry no SDLC stage and never affect product health."
                >
                  <ActivityStatusSection
                    activities={activityCards}
                    readOnly={isReadOnly}
                    onStatusChange={handleActivityStatusChange}
                    onRaiseRequiresRisk={handleActivityRaiseRequiresRisk}
                  />
                </AccordionSection>
              )}

              {/* Items: classic Current/Next two-section format by default;
                  the opt-in unified by-state view when the org flag is on
                  (a pure projection — physical Item.type is untouched). */}
              {unifiedView ? (
                <AccordionSection
                  groupExpanded={groupExpanded}
                  testId="lead-section-unified"
                  icon={<CalendarIcon />}
                  title="Activity"
                  badge={`${currentWeekItems.length + nextWeekItems.length} items`}
                  subtitle="Current and next week items in one list, grouped by state. Use + Add to create records."
                >
                  <UnifiedActivitySection
                    entries={unifiedEntries}
                    risks={risks}
                    readOnly={isReadOnly}
                    onWeekItemsChange={(week, items) =>
                      week === "current"
                        ? handleCurrentWeekItemsChange(items)
                        : handleNextWeekItemsChange(items)
                    }
                    currentUserName={currentUser.name}
                    products={products}
                    stagesForProduct={stagesForProduct}
                    ownPeriodRanks={ownPeriodRanks}
                    publishedLockedIds={publishedLockedItemIds}
                    onMarkComplete={handleMarkComplete}
                    onMoveToNextWeek={handleMoveToNextWeek}
                  />
                </AccordionSection>
              ) : (
                <>
                  {/* Current Week */}
                  <AccordionSection
                    groupExpanded={groupExpanded}
                    testId="lead-section-current-week"
                    icon={<CalendarIcon />}
                    title="Current Week"
                    badge={`${currentWeekItems.length} items`}
                    subtitle="Work completed or still in progress this week, grouped by product and SDLC stage."
                    actions={
                      !isReadOnly ? (
                        <button
                          type="button"
                          className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-10 min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={handleAddCurrentWeekItem}
                          disabled={products.length === 0}
                          title={
                            products.length > 0
                              ? `Add item to ${products[0]?.name}`
                              : NO_PRODUCTS_ASSIGNED_MESSAGE
                          }
                        >
                          + Add Item
                        </button>
                      ) : null
                    }
                  >
                    <CurrentWeekSection
                      items={currentWeekItems}
                      risks={risks}
                      readOnly={isReadOnly}
                      onItemsChange={handleCurrentWeekItemsChange}
                      currentUserName={currentUser.name}
                      products={products}
                      activities={activityOptions}
                      stagesForProduct={stagesForProduct}
                      ownPeriodRanks={ownPeriodRanks}
                      addSignal={currentWeekAddSignal}
                      publishedLockedIds={publishedLockedItemIds}
                      onMarkComplete={handleMarkComplete}
                      onMoveToNextWeek={handleMoveToNextWeek}
                      onPauseItem={handlePauseItem}
                    />
                  </AccordionSection>

                  {/* Next Week */}
                  <AccordionSection
                    groupExpanded={groupExpanded}
                    testId="lead-section-next-week"
                    icon={<NextWeekIcon />}
                    title="Next Week"
                    badge={`${nextWeekItems.length} items`}
                    subtitle="Planned work for the next reporting week, scoped to product and SDLC stage."
                    actions={
                      !isReadOnly ? (
                        <button
                          type="button"
                          className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-10 min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={handleAddNextWeekItem}
                          disabled={products.length === 0}
                          title={
                            products.length > 0
                              ? `Add item to ${products[0]?.name}`
                              : NO_PRODUCTS_ASSIGNED_MESSAGE
                          }
                        >
                          + Add Item
                        </button>
                      ) : null
                    }
                  >
                    <NextWeekSection
                      items={nextWeekItems}
                      risks={risks}
                      readOnly={isReadOnly}
                      onItemsChange={handleNextWeekItemsChange}
                      currentUserName={currentUser.name}
                      products={products}
                      activities={activityOptions}
                      stagesForProduct={stagesForProduct}
                      ownPeriodRanks={ownPeriodRanks}
                      addSignal={nextWeekAddSignal}
                      publishedLockedIds={publishedLockedItemIds}
                      onMoveToCurrentWeek={handleMoveToCurrentWeek}
                    />
                  </AccordionSection>
                </>
              )}

              {/* Risks & Blockers */}
              <AccordionSection
                groupExpanded={groupExpanded}
                testId="lead-section-risks"
                icon={<AlertIcon />}
                title="Risks & Blockers"
                titleColor="var(--color-destructive)"
                badge={`${risks.length}`}
                badgeStyle={{
                  background: "var(--color-status-blocked-bg)",
                  color: "var(--color-destructive)",
                }}
                subtitle="Risks and blockers that need attention, with impact, mitigation, and affected stages."
                actions={
                  !isReadOnly ? (
                    <button
                      type="button"
                      className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-10 min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={handleAddRisk}
                      disabled={products.length === 0}
                      title={
                        products.length > 0
                          ? undefined
                          : NO_PRODUCTS_ASSIGNED_MESSAGE
                      }
                    >
                      + Add Risk
                    </button>
                  ) : null
                }
              >
                <LeadFormSyncBridge.Risks />
              </AccordionSection>
            </LeadFormSyncBridge.Provider>

            {/* Decisions */}
            <AccordionSection
              groupExpanded={groupExpanded}
              testId="lead-section-decisions"
              icon={<ChatIcon />}
              title="Decisions"
              titleColor="var(--color-starbucks-accent)"
              badge={`${decisions.length}`}
              badgeStyle={{
                background: "var(--color-success)",
                color: "var(--color-starbucks-accent)",
              }}
              subtitle="Decisions that need leadership attention, with owner, impact, and affected stages."
              actions={
                !isReadOnly ? (
                  <button
                    type="button"
                    className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-10 min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleAddDecision}
                  >
                    + Add Decision
                  </button>
                ) : null
              }
            >
              <DecisionsSection
                decisions={decisions}
                readOnly={isReadOnly}
                onChange={handleDecisionsChange}
                currentUserName={currentUser.name}
                stagesForProduct={stagesForProduct}
                products={products}
                activities={activityOptions}
                defaultProductId={products[0]?.id}
                addSignal={decisionsAddSignal}
                publishedLockedIds={publishedLockedDecisionIds}
              />
            </AccordionSection>
          </div>
        )}
      </form>

      {/* Submit Confirmation Dialog */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div
            className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm submission"
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              Submit your report?
            </h3>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              Your report will be locked and visible to the group head. You will
              not be able to make changes after submission.
            </p>
            {/* 7c.5: the submit summary counts the lead's OWN records only —
                it reflects what will actually be submitted, never the foreign
                read-only records merged in for the Everyone lens. */}
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {ownCurrentWeekItems.length}
                </span>
                <span className="text-[var(--color-muted-foreground)]">
                  current week items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{ownNextWeekItems.length}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  next week items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{ownRisks.length}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  risks
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{ownDecisions.length}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  decisions
                </span>
              </div>
            </div>
            {/* simplify-stage-status-interaction (D4): warn that unset own
                stages will be promoted to On Track on submit — announced, not
                silent. Omitted when nothing is unset. */}
            {unsetOwnStageCount > 0 && (
              <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
                {unsetOwnStageCount} stage
                {unsetOwnStageCount === 1 ? "" : "s"} not set — they will be
                marked On Track.
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
                onClick={() => setShowSubmitConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleConfirmSubmit}
                disabled={submitMut.isPending}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick-add item dialog host — the EXISTING item dialog opened by the
          picker for current-item / next-item. The risk / blocker / decision
          quick-adds open the dialogs the sections already host (a blocker rides
          the severity-blocked risk prefill). */}
      <ItemEditDialog
        key={`quick-add-${quickAddItem?.seq ?? 0}`}
        open={quickAddItem !== null}
        item={null}
        products={products}
        activities={activityOptions}
        week={quickAddItem?.week ?? "current"}
        currentUserName={currentUser.name}
        defaultProductId={products[0]?.id}
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        risks={risks}
        onSave={handleQuickAddSave}
        onCancel={handleQuickAddCancel}
      />

      <RequestReopenDialog
        open={showReopenDialog}
        pending={requestReopenMut.isPending}
        error={reopenError}
        onConfirm={handleRequestReopen}
        onCancel={closeReopenDialog}
      />

      <ConfirmDeleteDialog
        open={showRevokeDialog}
        title="Revoke this submission?"
        preview={currentUser.name}
        subtitle="Their form returns to Draft and they can edit again."
        consequence="The lead will be notified that their submission was revoked."
        confirmLabel="Revoke"
        reversible
        onConfirm={confirmRevoke}
        onCancel={() => setShowRevokeDialog(false)}
      />
    </SdlcTooltipProvider>
  );
}
