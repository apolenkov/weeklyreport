/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- the literal-union cast on severity is required by tsc (without it the ternary widens to string, TS2322), but ESLint's program flags it redundant; wave-6c-ii */
"use client";

import type {
  DraftSavePayload,
  ReportSectionReadModel,
} from "@customreport/shared";
import { Separator } from "@customreport/ui/components/ui/separator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  stableStringify,
  useLeadFormAutosave,
} from "../../hooks/use-lead-form-autosave";
import { useRecordVisibility } from "../../hooks/use-record-visibility";
import { computeCoupling, validateCoupling } from "../../hooks/use-status-risk";
import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../lib/cache-keys";
import { mapLeadFormData } from "../../lib/mappers";
import {
  applyCrossAuthorStageOverrides,
  buildCrossAuthorStageMap,
  mapForeignDecisions,
  mapForeignItems,
  mapForeignRisks,
} from "../../lib/mappers/lead-cross-author";
import {
  normalizeStageName,
  ownedStagesForProject,
} from "../../lib/mappers/lead-form";
import { formatDateRange, isoWeekNumber } from "../../lib/mappers/lead-history";
import { stageStatusToTraffic } from "../../lib/mappers/traffic-light";
import { SessionContext } from "../../lib/session-provider";
import { useTRPC } from "../../lib/trpc-context";
import { useQueryErrorHandler } from "../../lib/use-query-error-handler";
import { AccordionSection } from "../report-shell/accordion-section";
import { AgentReviewComingSoon } from "../report-shell/agent-review-coming-soon";
import { ArchiveToggle } from "../report-shell/archive-toggle";
import { ReportToolbar } from "../report-shell/report-toolbar";
import { SaveNowButton } from "../report-shell/save-now-button";
import { ViewModeToggle } from "../report-shell/view-mode-toggle";
import { LeadSlidesClient } from "../slides/lead-slides-client";
import { SlideFullscreenButton } from "../slides/slide-fullscreen-button";
import { SdlcTooltipProvider } from "../ui/sdlc-tooltip";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { CurrentWeekSection } from "./current-week-section";
import { DecisionsSection } from "./decisions-section";
import { FillFromButton } from "./fill-from-button";
import { LeadFormSkeleton } from "./lead-form-skeleton";
import { LeadFormSyncBridge } from "./lead-form-sync-bridge";
import type {
  DecisionEntry,
  KanbanItem,
  Product,
  ReportPeriod,
  RiskEntry,
} from "./mock-data";
import { NextWeekSection } from "./next-week-section";
import { PdfExportComingSoonControl } from "./pdf-export-coming-soon";
import { PeriodNavigator } from "./period-navigator";
import { RequestReopenDialog } from "./request-reopen-dialog";
import { VersionComingSoonControl } from "./version-coming-soon";

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

/**
 * Build a `draftSaveSchema`-compatible payload from the raw API section. The
 * raw shape carries every field the schema requires (owner/impact on
 * decisions, tag/workflowStatus on items, etc.) so this round-trips cleanly.
 */
function sectionToDraftPayload(
  section: ReportSectionReadModel,
): DraftSavePayload {
  // Drop rows whose required text fields are empty or whitespace-only. The
  // server's safeText({min:1}) Zod refinement rejects them, which would
  // otherwise produce "Save failed" toast every time the user clicks
  // "+ Add Risk/Decision/Item" before typing. Empty rows live only in
  // local UI state until the user fills them in; once any required field
  // becomes non-empty the row joins the autosave payload.
  const hasText = (s: string | null | undefined) =>
    typeof s === "string" && s.trim().length > 0;
  return {
    reportSectionId: section.reportSectionId,
    status: "draft",
    projectStatuses: section.projects.map((p) => ({
      projectId: p.projectId,
      status: p.trafficLight ?? undefined,
    })),
    stageStatuses: section.projects.flatMap((p) =>
      (p.ownedStages ?? []).map((stage) => ({
        projectId: p.projectId,
        stageId: stage.stageId,
        status: stage.status ?? null,
      })),
    ),
    items: section.items
      .filter((it) => hasText(it.text))
      .map((it) => ({
        id: it.id,
        projectId: it.projectId,
        type: it.type,
        text: it.text,
        tag: it.tag,
        workflowStatus: it.workflowStatus,
        carriedOver: it.carriedOver,
        completed: it.completed ?? null,
        stageIds: it.stageIds,
        // F1: include priorityRank in the autosave payload (was omitted, so the
        // dialog's rank never reached the backend → "doesn't save").
        priorityRank: it.priorityRank ?? null,
      })),
    risks: section.risks
      .filter((r) => hasText(r.risk) && hasText(r.mitigation))
      .map((r) => ({
        id: r.id,
        projectId: r.projectId,
        risk: r.risk,
        impact: r.impact,
        mitigation: r.mitigation,
        severity: r.severity,
        // require-risk-stage: the write schema now demands ≥1 stage. The
        // read model stays tolerant of stage-less legacy rows; sending []
        // for such a row fails server-side validation loudly until the
        // data is backfilled/reseeded (design D3 trade-off).
        stageIds: r.stageIds ?? [],
      })),
    decisions: section.decisions
      .filter((d) => hasText(d.text) && hasText(d.owner) && hasText(d.impact))
      .map((d) => ({
        id: d.id,
        text: d.text,
        owner: d.owner,
        deadline: d.deadline ?? null,
        impact: d.impact,
        resolvedAt: d.resolvedAt ?? null,
        stageIds: d.stageIds,
        productId: d.productId ?? null,
      })),
  };
}

type StageStatusValue = "green" | "yellow" | "red" | null;

function aggregateTrafficLight(
  stages: readonly { status?: StageStatusValue }[],
): StageStatusValue {
  let severity = 0;
  for (const stage of stages) {
    if (stage.status === "red") {
      severity = 3;
      break;
    }
    if (stage.status === "yellow") severity = Math.max(severity, 2);
    if (stage.status === "green") severity = Math.max(severity, 1);
  }
  return severity === 3
    ? "red"
    : severity === 2
      ? "yellow"
      : severity === 1
        ? "green"
        : null;
}

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
}: {
  readonly value: "mine" | "everyone";
  readonly onChange: (next: "mine" | "everyone") => void;
}) {
  const options: { key: "mine" | "everyone"; label: string }[] = [
    { key: "mine", label: "Mine only" },
    { key: "everyone", label: "Everyone" },
  ];
  return (
    <div
      role="group"
      aria-label="Record visibility"
      className="inline-flex items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] p-0.5"
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.key)}
            className={`btn-press min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] px-3 py-1 font-[family-name:var(--font-sans)] text-sm font-semibold transition-colors ${
              active
                ? "bg-[var(--color-starbucks-accent)] text-white"
                : "bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
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
  const isSlidesMode = mode === "slides";
  // W9.A: ref shared between lead-form header (SlideFullscreenButton) and LeadSlidesClient (deck root div)
  const deckRef = useRef<HTMLDivElement>(null);
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
  const crossAuthorEntries: import("./sdlc-pipeline").CrossAuthorEntry[] =
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

  // 7c.3: the full-content read is fetched ONLY in the Everyone state, and only
  // AFTER the persisted toggle has hydrated — so it never fires on the
  // pre-hydration "mine" default and then races a restored "everyone".
  const crossAuthorContentQ = useQuery({
    ...trpc.leadForm.crossAuthorContent.queryOptions({
      reportId: targetReportId,
    }),
    enabled: targetReportId !== "" && visibilityHydrated && isEveryone,
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
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Draft mirror of the raw API section. Saving + submitting use this; child
  // edits merge field-level changes back by id while preserving every required
  // schema field that the lossy Lead* mappers drop (owner/impact/etc).
  const [draftSection, setDraftSection] =
    useState<ReportSectionReadModel | null>(null);
  const lastServerDraftKeyRef = useRef<string | null>(null);

  // Re-seed local state whenever the server-side section changes (initial load
  // or post-mutation invalidation). React Query can hand this component a new
  // object reference for the same server payload while a local autosave is
  // pending; compare the stable draft payload key so that refetch noise does
  // not wipe unsaved dialog edits before the debounce fires.
  useEffect(() => {
    const section = byPeriodQ.data?.section;
    if (!section) return;

    const serverDraftKey = stableStringify(sectionToDraftPayload(section));
    setIsSubmitted(section.status === "submitted");

    if (lastServerDraftKeyRef.current === serverDraftKey) return;
    lastServerDraftKeyRef.current = serverDraftKey;
    setDraftSection(section);
  }, [byPeriodQ.data?.section]);

  // ---- Mutations ----
  const submitMut = useMutation(
    trpc.reports.submit.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        setIsSubmitted(true);
        setShowSubmitConfirm(false);
        toast.success("Report submitted");
      },
      onError: (err: unknown) => {
        // Surface server-side errors as a toast; submitSectionSchema no
        // longer enforces a per-field "needs at least one priority" rule,
        // so we drop the field-targeted scroll/inline-error path that used
        // to handle priorities.too_small. Generic message covers the rest.
        if (err instanceof Error) {
          toast.error(err.message);
        } else {
          toast.error("Submit failed");
        }
      },
    }),
  );

  const revokeMut = useMutation(
    trpc.leadForm.revoke.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        invalidateDashboard(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        setIsSubmitted(false);
        toast.success("Section unlocked");
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Revoke failed";
        toast.error(msg);
      },
    }),
  );

  // M6: Lead-side request to reopen a submitted section. Backend already
  // exists (leadForm.requestReopen) — this just wires the UI. Local
  // dialog state lives next to the mutation so failure messages can be
  // surfaced inline rather than only in a toast.
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const requestReopenMut = useMutation(
    trpc.leadForm.requestReopen.mutationOptions({
      onSuccess: () => {
        setShowReopenDialog(false);
        setReopenError(null);
        toast.success("Reopen request sent to Head");
      },
      onError: (err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "Reopen request failed";
        setReopenError(msg);
      },
    }),
  );

  const fillFromMut = useMutation(
    trpc.leadForm.fillFrom.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        toast.success("Form filled from selected period");
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Fill from failed";
        toast.error(msg);
      },
    }),
  );

  // ---- Build draft payload ----
  const draftPayload = useMemo(
    () => (draftSection ? sectionToDraftPayload(draftSection) : null),
    [draftSection],
  );

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
  const [currentWeekAddSignal, setCurrentWeekAddSignal] = useState(0);
  const [nextWeekAddSignal, setNextWeekAddSignal] = useState(0);
  const [risksAddSignal, setRisksAddSignal] = useState(0);
  const [decisionsAddSignal, setDecisionsAddSignal] = useState(0);

  // Compute readOnly early (before hook; the autosave hook needs it). When
  // data isn't ready, treat as readOnly (autosave disabled).
  const isReadOnlyEarly =
    isSubmitted || (byPeriodQ.data ? byPeriodQ.data.readOnly : true);

  // Compute the baseline key from the *server-side* section so the autosave
  // hook treats freshly-loaded data as already-saved (no dirty flicker).
  const initialSavedKey = useMemo(() => {
    if (!byPeriodQ.data?.section) return null;
    return stableStringify(sectionToDraftPayload(byPeriodQ.data.section));
  }, [byPeriodQ.data]);

  // Autosave wiring — runs unconditionally to keep hook order stable.
  const autosave = useLeadFormAutosave({
    reportSectionId: sectionIdForActions || null,
    payload: draftPayload,
    // isReadOnlyEarly already subsumes isSubmitted (it is one of its OR
    // operands), so !isReadOnlyEarly implies !isSubmitted.
    enabled: !isReadOnlyEarly && draftSection !== null,
    initialSavedKey,
    // TODO(versions-v2): the save-success path used to create a version
    // snapshot here; re-wire the trigger when versioning returns.
  });

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
    byPeriod: { section: draftSection, readOnly: byPeriodQ.data.readOnly },
    history: historyQ.data,
  });

  // F8: enrich unassigned stages with cross-author initials + risk-derived
  // status. crossAuthorsQ.data has { projectId, stageNames, authorInitials,
  // stages } per shared product. Stages not owned by the current user but
  // assigned to another lead become ownership:"locked" with that lead's
  // initials and risk-derived color instead of gray "empty". No foreign
  // item/risk/decision text is read here.
  //
  // 7c.4: the foreign stage CHIPS show only in Everyone. In Mine only we skip
  // the override so co-owners' stages stay hidden (unassigned/gray). Product
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

  const ownCurrentWeekItems: KanbanItem[] =
    data.currentWeekItems as KanbanItem[];
  const ownNextWeekItems: KanbanItem[] = data.nextWeekItems as KanbanItem[];
  const ownRisks: RiskEntry[] = data.risks as RiskEntry[];
  const ownDecisions: DecisionEntry[] = data.decisions as DecisionEntry[];

  // 7c.4: Everyone merges co-owners' full records READ-ONLY on top of the
  // lead's own records, from the gated full-content read. Mine only renders
  // own records only (no full-content fetch). The merge is view-only: the
  // draft-merge handlers strip every `.foreign` row, so it never reaches the
  // submission (D4b).
  const productNameById = new Map(products.map((p) => [p.id, p.name]));
  const foreignContentRows =
    isEveryone && visibilityHydrated ? (crossAuthorContentQ.data ?? []) : [];
  const currentWeekItems: KanbanItem[] = [
    ...ownCurrentWeekItems,
    ...mapForeignItems(foreignContentRows, productNameById, "current"),
  ];
  const nextWeekItems: KanbanItem[] = [
    ...ownNextWeekItems,
    ...mapForeignItems(foreignContentRows, productNameById, "next"),
  ];
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
  // Item / Risk dialogs so the SDLC stage dropdown is scoped per project.
  // Decisions / Priorities are department-scoped, so they get the union.
  const stagesForProduct = (productId: string) =>
    ownedStagesForProject(draftSection, productId);
  const availableStages = ownedStagesForProject(draftSection, undefined);

  // ---- onChange merge handlers ----
  // Decisions: merge text edits / additions / deletions back into raw section
  // by id, preserving owner/impact/deadline/resolvedAt fields the mapper drops
  // for existing rows. Newly-added rows (ids unseen in `prev`) are appended
  // with safe schema defaults (owner/impact default to '' — the safeText
  // helper accepts empty strings).
  function handleDecisionsChange(next: DecisionEntry[]) {
    setDraftSection((prev) => {
      if (!prev) return prev;
      const existingById = new Map(
        prev.decisions.flatMap((d) => (d.id ? [[d.id, d] as const] : [])),
      );
      // Strip foreign entries — they are read-only and must not bleed into the draft.
      next = next.filter((d) => !d.foreign);
      const merged = next.map((d) => {
        const existing = existingById.get(d.id);
        const deadline = d.deadline ? new Date(d.deadline) : null;
        if (existing) {
          return {
            ...existing,
            text: d.text,
            owner: d.owner,
            impact: d.impact,
            deadline,
            stageName: null,
            stageIds: d.stageIds,
            productId: d.productId || null,
          };
        }
        return {
          id: d.id,
          text: d.text,
          owner: d.owner,
          impact: d.impact,
          deadline,
          resolvedAt: null,
          stageName: null,
          stageIds: d.stageIds,
          productId: d.productId || null,
        };
      });
      return { ...prev, decisions: merged };
    });
  }

  function handleProductsChange(next: Product[]) {
    setDraftSection((prev) => {
      if (!prev) return prev;
      const nextStageStatusByKey = new Map<string, StageStatusValue>();
      for (const p of next) {
        for (const s of p.stages) {
          if (s.ownership !== "mine") continue;
          nextStageStatusByKey.set(
            `${p.id}::${normalizeStageName(s.stageName)}`,
            stageStatusToTraffic(s.status),
          );
        }
      }
      const merged = prev.projects.map((ps) => {
        const ownedStages = (ps.ownedStages ?? []).map((stage) => {
          const key = `${ps.projectId}::${normalizeStageName(stage.stageName)}`;
          if (!nextStageStatusByKey.has(key)) return stage;
          return {
            ...stage,
            status: nextStageStatusByKey.get(key) ?? null,
          };
        });
        return {
          ...ps,
          ownedStages,
          trafficLight: aggregateTrafficLight(ownedStages),
        };
      });
      return { ...prev, projects: merged };
    });
  }

  function handleRisksChange(next: RiskEntry[]) {
    setDraftSection((prev) => {
      if (!prev) return prev;
      // Merge presentation risks back into raw section. RiskEntry now
      // carries impact + mitigation (filled by the modal-edit dialog), so
      // we propagate all three text fields onto raw rows.
      // Strip foreign entries — they are read-only and must not bleed into the draft.
      next = next.filter((r) => !r.foreign);
      const existingById = new Map(
        prev.risks.flatMap((r) => (r.id ? [[r.id, r] as const] : [])),
      );
      const merged = next.map((r) => {
        const existing = r.id ? existingById.get(r.id) : undefined;
        if (existing) {
          return {
            ...existing,
            projectId: r.productId,
            risk: r.text,
            impact: r.impact,
            mitigation: r.mitigation,
            severity: r.severity,
            stageName: null,
            stageIds: r.stageIds,
          };
        }
        return {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- draft rows lack a persisted id at runtime despite the non-null form-row type
          id: r.id ?? `tmp-${crypto.randomUUID()}`,
          projectId: r.productId,
          risk: r.text,
          impact: r.impact,
          mitigation: r.mitigation,
          severity: r.severity,
          stageName: null,
          stageIds: r.stageIds,
        };
      });
      return { ...prev, risks: merged };
    });
  }

  // Items: the section emits a presentation `KanbanItem[]` for one type
  // (current or next). Merge it back into raw `draftSection.items` while
  // preserving cross-type entries.
  //
  // The presentation `status` ('completed' | 'in-progress' | 'blocked' |
  // 'planned') is the inverse of `workflowToItemStatus` + a `completed` flag.
  // We translate it back so the modal-edit dialog can change Status without
  // a separate field surface for `workflowStatus` / `completed`.
  function statusToRawFields(status: KanbanItem["status"]): {
    workflowStatus: "done" | "in_progress" | "blocked";
    completed: boolean | null;
  } {
    switch (status) {
      case "completed":
        return { workflowStatus: "done", completed: true };
      case "blocked":
        return { workflowStatus: "blocked", completed: false };
      case "planned":
        // 'planned' has no DB enum value. Next-week rows use
        // completed=null as the explicit presentation marker so reopening the
        // form can distinguish Planned from In Progress.
        return { workflowStatus: "in_progress", completed: null };
      case "in-progress":
      default:
        return { workflowStatus: "in_progress", completed: false };
    }
  }

  function makeItemsChangeHandler(itemType: "current" | "next") {
    return (next: KanbanItem[]) => {
      // Strip foreign entries — they are read-only and must not bleed into the draft.
      next = next.filter((kb) => !kb.foreign);
      setDraftSection((prev) => {
        if (!prev) return prev;
        const existingById = new Map(
          prev.items.flatMap((it) =>
            it.type === itemType && it.id ? [[it.id, it] as const] : [],
          ),
        );
        const mergedTyped = next.map((kb) => {
          const raw = statusToRawFields(kb.status);
          const existing = existingById.get(kb.id);
          if (existing) {
            return {
              ...existing,
              text: kb.text,
              projectId: kb.productId,
              workflowStatus: raw.workflowStatus,
              completed: raw.completed,
              stageName: null,
              stageIds: kb.stageIds,
              // F1: carry the priority rank from the dialog into the draft so
              // autosave persists it (was silently dropped here).
              priorityRank: kb.priorityRank ?? null,
            };
          }
          return {
            id: kb.id,
            projectId: kb.productId,
            type: itemType,
            text: kb.text,
            // Schema requires safeText({min:1}) on tag; UI doesn't expose a
            // tag picker so we seed a default that survives validation.
            tag: "general",
            workflowStatus: raw.workflowStatus,
            carriedOver: false,
            completed: raw.completed,
            stageName: null,
            stageIds: kb.stageIds,
            priorityRank: kb.priorityRank ?? null,
          };
        });
        // Keep all items of the OTHER type unchanged; replace this type with
        // the merged set.
        const others = prev.items.filter((it) => it.type !== itemType);
        return { ...prev, items: [...others, ...mergedTyped] };
      });
    };
  }

  const handleCurrentWeekItemsChange = makeItemsChangeHandler("current");
  const handleNextWeekItemsChange = makeItemsChangeHandler("next");

  // ---- Action handlers ----
  function handleSubmit() {
    // F4: only check risks that will actually be submitted (same filter as
    // sectionToDraftPayload). Empty/unsaved rows must not falsely block submit.
    // 7c.5: scope to OWN risks — foreign records are a read-only lens and must
    // never affect the lead's submit gating (view-only, D4b).
    const committedRisks = ownRisks.filter(
      (r) => r.text.trim().length > 0 && r.mitigation.trim().length > 0,
    );
    const coupling = computeCoupling(products, committedRisks);
    const { missing } = validateCoupling(coupling);
    if (missing.length > 0) {
      toast.error(
        "Specify stages for at-risk/blocked products in Risks & Blockers.",
      );
      return;
    }
    setShowSubmitConfirm(true);
  }

  function handleConfirmSubmit() {
    if (!draftPayload) return;
    // submitSectionSchema requires every projectStatus to have a non-null
    // status. Coerce undefined -> green optimistically; the server will
    // reject if any are still invalid and toast the error.
    const projectStatuses = draftPayload.projectStatuses.map((p) => ({
      projectId: p.projectId,
      status: p.status ?? ("green" as const),
    }));
    submitMut.mutate({
      ...draftPayload,
      projectStatuses,
      confirmed: true,
    });
  }

  function handleRevoke() {
    setShowRevokeDialog(true);
  }

  function confirmRevoke() {
    setShowRevokeDialog(false);
    if (!sectionIdForActions) return;
    revokeMut.mutate({ reportSectionId: sectionIdForActions });
  }

  function handleRequestReopen(reason: string | undefined) {
    if (!sectionIdForActions) return;
    requestReopenMut.mutate({
      reportSectionId: sectionIdForActions,
      ...(reason ? { reason } : {}),
    });
  }

  function handleFillFrom(sourceSectionId: string) {
    if (!sectionIdForActions) return;
    if (
      autosave.dirty &&
      !window.confirm("You have unsaved changes. Continue and overwrite?")
    ) {
      return;
    }
    fillFromMut.mutate({
      targetSectionId: sectionIdForActions,
      sourceSectionId,
    });
  }

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
            {/* LF-3 (Phase 33-04): submitted state now uses the .b-ok variant
                (light teal bg + dark teal text) — matches mockup s2 rather
                than the heavier white-on-dark-teal `.b-done` look that read
                as a destructive "locked" signal. */}
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
        </header>

        {/* report-toolbar-layout: the period toolbar splits by one axis.
            Top (Document action) row: Version⏳ · PDF⏳ · Fill-From · Save ·
            Submit Section. Bottom (Context control) row: Agent review · period
            nav · show-archived · Mine|Everyone · Edit|Slides · Toggle All. A
            read-only past period hides only the real mutating actions
            (Save/Submit/Fill-From) but keeps the inert Coming-soon stubs
            (deferred-feature-pattern). */}
        <ReportToolbar
          documentActions={
            <>
              <VersionComingSoonControl />
              {/* TODO(lead-pdf-export): lead is excluded from pdfExport
                  (role-coverage-gate); this inert ComingSoon control never
                  reaches a backend call. */}
              <PdfExportComingSoonControl />
              {!isReadOnly && (
                <FillFromButton
                  periods={visiblePeriods}
                  disabled={fillFromMut.isPending}
                  onFillFrom={handleFillFrom}
                />
              )}
              {!isReadOnly && <SaveNowButton autosave={autosave} />}
              {/* Reversal lifecycle actions take a neutral/outline treatment so
                  the brand-accent green stays a single "forward, safe-to-commit"
                  meaning (report-toolbar-layout accent hierarchy). */}
              {isSubmitted && currentUser.authorRole === "lead" && (
                <button
                  type="button"
                  className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    setReopenError(null);
                    setShowReopenDialog(true);
                  }}
                  disabled={requestReopenMut.isPending}
                  title="Ask Head to unlock this section"
                >
                  Request Reopen
                </button>
              )}
              {isSubmitted && currentUser.authorRole !== "lead" && (
                <button
                  type="button"
                  className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleRevoke}
                  disabled={revokeMut.isPending}
                  title="Revoke submission and unlock the section"
                >
                  Revoke
                </button>
              )}
              {!isSubmitted && !isReadOnly && (
                <button
                  type="button"
                  className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleSubmit}
                  disabled={submitMut.isPending}
                >
                  Submit Section
                </button>
              )}
            </>
          }
          contextControls={
            <>
              {/* Inert Agent-review placeholder leads the context group
                  (head-toolbar-semantics: compact, leading edge). */}
              <AgentReviewComingSoon />
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
              {/* 7c.1: Record visibility toggle — edit mode only (not slides).
                  Disabled until the persisted state hydrates so a click cannot
                  race the restored value. */}
              {!isSlidesMode && (
                <RecordVisibilityToggle
                  value={recordVisibility}
                  onChange={setRecordVisibility}
                />
              )}
              {isSlidesMode && <SlideFullscreenButton targetRef={deckRef} />}
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
              {!isSlidesMode &&
                (currentWeekItems.length > 0 ||
                  nextWeekItems.length > 0 ||
                  risks.length > 0 ||
                  decisions.length > 0) && (
                  <button
                    type="button"
                    className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
                    onClick={handleToggleAll}
                    title="Toggle All"
                  >
                    <CollapseIcon />
                    Toggle All
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
          />
        ) : (
          // Split-view: at xl the edit form (left) sits beside a live slide
          // preview (right) fed from the same draftSection — one source, no
          // extra fetch. Below xl it stays single-column; ?mode=slides handles
          // the standalone deck.
          <div className="min-w-0 space-y-6">
            <LeadFormSyncBridge.Provider
              products={products}
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
              displayRisks={risks}
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
                      className="btn-press inline-flex min-h-10 min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() =>
                        setCurrentWeekAddSignal((value) => value + 1)
                      }
                      disabled={products.length === 0}
                      title={
                        products.length > 0
                          ? `Add item to ${products[0]?.name}`
                          : "No products assigned — contact admin"
                      }
                    >
                      + Add Item
                    </button>
                  ) : null
                }
              >
                <CurrentWeekSection
                  items={currentWeekItems}
                  readOnly={isReadOnly}
                  onItemsChange={handleCurrentWeekItemsChange}
                  currentUserName={currentUser.name}
                  products={products}
                  stagesForProduct={stagesForProduct}
                  ownPeriodRanks={ownPeriodRanks}
                  addSignal={currentWeekAddSignal}
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
                      className="btn-press inline-flex min-h-10 min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => setNextWeekAddSignal((value) => value + 1)}
                      disabled={products.length === 0}
                      title={
                        products.length > 0
                          ? `Add item to ${products[0]?.name}`
                          : "No products assigned — contact admin"
                      }
                    >
                      + Add Item
                    </button>
                  ) : null
                }
              >
                <NextWeekSection
                  items={nextWeekItems}
                  readOnly={isReadOnly}
                  onItemsChange={handleNextWeekItemsChange}
                  currentUserName={currentUser.name}
                  products={products}
                  stagesForProduct={stagesForProduct}
                  ownPeriodRanks={ownPeriodRanks}
                  addSignal={nextWeekAddSignal}
                />
              </AccordionSection>

              {/* Risks & Blockers */}
              <AccordionSection
                groupExpanded={groupExpanded}
                testId="lead-section-risks"
                icon={<AlertIcon />}
                title="Risks & Blockers"
                titleColor="var(--color-destructive)"
                badge={`${risks.length}`}
                badgeStyle={{
                  background: "#fee2e2",
                  color: "var(--color-destructive)",
                }}
                subtitle="Risks and blockers that need attention, with impact, mitigation, and affected stages."
                actions={
                  !isReadOnly ? (
                    <button
                      type="button"
                      className="btn-press inline-flex min-h-10 min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => setRisksAddSignal((value) => value + 1)}
                      disabled={products.length === 0}
                      title={
                        products.length > 0
                          ? undefined
                          : "No products assigned — contact admin"
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
                    className="btn-press inline-flex min-h-10 min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => setDecisionsAddSignal((value) => value + 1)}
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
                availableStages={availableStages}
                products={products}
                defaultProductId={products[0]?.id}
                addSignal={decisionsAddSignal}
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
              Submit Section?
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
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
                onClick={() => setShowSubmitConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleConfirmSubmit}
                disabled={submitMut.isPending}
              >
                Submit Section
              </button>
            </div>
          </div>
        </div>
      )}

      <RequestReopenDialog
        open={showReopenDialog}
        pending={requestReopenMut.isPending}
        error={reopenError}
        onConfirm={handleRequestReopen}
        onCancel={() => {
          setShowReopenDialog(false);
          setReopenError(null);
        }}
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
