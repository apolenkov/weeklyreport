"use client";

import { useState, useEffect, useMemo, useRef, useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { ArchiveToggle } from "../report-shell/archive-toggle";
import { Separator } from "@customreport/ui/components/ui/separator";
import { toast } from "sonner";

import { useTRPC } from "../../lib/trpc-context";
import {
  invalidateLeadForm,
  invalidateLeadHistory,
  invalidateDashboard,
} from "../../lib/cache-keys";
import { SessionContext } from "../../lib/session-provider";
import { logClientError } from "../../lib/client-error-reporting";
import { mapLeadFormData } from "../../lib/mappers";
import { ownedStagesForProject, normalizeStageName } from "../../lib/mappers/lead-form";
import { stageStatusToTraffic, trafficToStageStatus } from "../../lib/mappers/traffic-light";
import { deriveEffectiveStageStatus } from "../../lib/stage-status";
import { isoWeekNumber, formatDateRange } from "../../lib/mappers/lead-history";
import {
  useLeadFormAutosave,
  stableStringify,
} from "../../hooks/use-lead-form-autosave";
import {
  computeCoupling,
  validateCoupling,
} from "../../hooks/use-status-risk-coupling";
import { LeadFormSkeleton } from "./lead-form-skeleton";
import { LeadFormSyncBridge } from "./lead-form-sync-bridge";
import { SdlcTooltipProvider } from "../ui/sdlc-tooltip";
import { PeriodNavigator } from "./period-navigator";
import { FillFromButton } from "./fill-from-button";
import { VersionHistoryNav } from "./version-history-nav";
import { CurrentWeekSection } from "./current-week-section";
import { NextWeekSection } from "./next-week-section";
import { DecisionsSection } from "./decisions-section";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { RequestReopenDialog } from "./request-reopen-dialog";
import { LeadSlidesClient } from "../slides/lead-slides-client";
import { SlideFullscreenButton } from "../slides/slide-fullscreen-button";
import { AccordionSection } from "../report-shell/accordion-section";
import { ViewModeToggle } from "../report-shell/view-mode-toggle";
import { ReportToolbar } from "../report-shell/report-toolbar";
import { AgentReviewComingSoon } from "../report-shell/agent-review-coming-soon";

import type {
  Product,
  KanbanItem,
  RiskEntry,
  DecisionEntry,
  ReportPeriod,
  VersionSnapshot,
} from "./mock-data";

import type {
  ReportSectionReadModel,
  DraftSavePayload,
} from "@customreport/shared";

type LeadFormProps = {
  readonly period?: string;
  /**
   * 35-07: explicit report identifier from the dynamic `[reportId]` route
   * segment. When provided, the form scopes data load + actions to that
   * specific report instead of the session's active period.
   *
   * When omitted (bare `/lead/report` path), the form still falls back to
   * `reports.getActive` and — once resolved — performs a `router.replace`
   * to the canonical addressed URL `/lead/report/<reportId>` so bookmarks
   * and shared links work. The legacy `?period=` query continues to read
   * the bare route in read-only mode without a redirect (back-compat).
   */
  readonly reportId?: string;
  readonly mode?: "edit" | "slides";
  /**
   * 35-07: when true, the form auto-redirects (router.replace) to the
   * canonical addressed URL once the active reportId is known. Off when
   * the bare route is hit with `?period=` (legacy bookmarks) or when
   * already on a `[reportId]` route.
   */
  readonly redirectToCanonical?: boolean;
};

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
        carriedOver: it.carriedOver ?? false,
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
        stageIds: r.stageIds,
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


function aggregateTrafficLight(
  stages: readonly { status?: "green" | "yellow" | "red" | null }[],
): "green" | "yellow" | "red" | null {
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

export function LeadForm({
  period,
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
  const sessionState = useContext(SessionContext);
  const sessionRole = sessionState?.user?.role ?? null;
  const isHeadLikeSession = sessionRole === "head" || sessionRole === "admin";
  const shouldRouteHeadLikeAwayFromLeadForm = isHeadLikeSession;
  const shouldDeferForSession = Boolean(sessionState && sessionState.isLoading);

  // Four queries compose the lead-form view. `byPeriod` and `versions` depend
  // on identifiers from `getActive` (or — 35-07 — the pinned `reportId` from
  // the dynamic route), so they're gated by `enabled`.
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
    // Prevent window-focus refetches from overwriting in-flight local edits.
    // Every mutation that changes server state calls invalidateLeadForm(), so
    // explicit invalidation is the only freshness path — no background polling
    // needed.
    staleTime: Infinity,
  });

  // The section id for actions (autosave / submit / revoke) comes from the
  // loaded section when a reportId is pinned (the active session's section
  // id may not match the pinned report). Fall back to activeSectionId for
  // the bare-route case until byPeriod resolves.
  const sectionIdForActions =
    byPeriodQ.data?.section.reportSectionId ?? activeSectionId;

  const versionsQ = useQuery({
    ...trpc.leadForm.versions.queryOptions({
      reportSectionId: sectionIdForActions,
    }),
    enabled: sectionIdForActions !== "",
  });
  const historyQ = useQuery(trpc.reports.myHistory.queryOptions());

  // F1: load other authors who share a product with the current user.
  // Only relevant when viewing your own section (not a foreign-author view).
  const crossAuthorsQ = useQuery({
    ...trpc.leadForm.crossAuthors.queryOptions({
      reportId: targetReportId,
    }),
    enabled: targetReportId !== "",
  });

  // F-shiny-3: cross-author section data is always loaded (always-on).
  const crossAuthorSectionsQ = useQuery({
    ...trpc.leadForm.crossAuthorSections.queryOptions({
      reportId: targetReportId,
    }),
    enabled: targetReportId !== "",
  });

  // F3.4: non-null when user navigates to a historical snapshot via ← › arrows.
  const [viewedSnapshotVersion, setViewedSnapshotVersion] = useState<number | null>(null);

  // F3.4: fetch full snapshot data for a historical version when the user
  // navigates to it via VersionHistoryNav ← › arrows.
  const getVersionQ = useQuery({
    ...trpc.leadForm.getVersion.queryOptions({
      reportSectionId: sectionIdForActions,
      version: viewedSnapshotVersion ?? 1,
    }),
    enabled: viewedSnapshotVersion !== null && sectionIdForActions !== "",
  });

  const crossAuthors = crossAuthorsQ.data ?? [];

  // F-shiny-1: enrich crossAuthors with per-risk details and isEmpty flag
  // sourced from crossAuthorSectionsQ (always loaded).
  const enrichedCrossAuthors: import("./sdlc-pipeline").CrossAuthorEntry[] =
    crossAuthors.map((ca) => {
      const caSection = crossAuthorSectionsQ.data?.find(
        (s) => s.authorId === ca.authorId,
      );
      const projectRisks =
        caSection?.risks
          .filter((r) => r.projectId === ca.projectId)
          .slice(0, 3)
          .map((r) => ({
            severity: (r.severity === "blocked" ? "blocked" : "at-risk") as
              | "blocked"
              | "at-risk",
            text: r.risk,
          })) ?? null;
      return {
        ...ca,
        risks: projectRisks,
        isEmpty: ca.itemCount === 0 && ca.riskCount === 0,
      };
    });

  // 35-07: bare route → replace URL with the canonical addressed form once
  // the active reportId is known. Skipped when:
  //   • a `?period=` query is present (legacy bookmarks; preserve old UX)
  //   • the page already renders under `[reportId]` (pinnedReportId set)
  //   • there is no active period (server returned null) — the form will
  //     show the existing empty / skeleton state.
  useEffect(() => {
    if (!redirectToCanonical) return;
    if (period) return;
    if (pinnedReportId) return;
    if (shouldRouteHeadLikeAwayFromLeadForm) return;
    if (!activeReportId) return;
    const next = new URLSearchParams();
    if (isSlidesMode) next.set("mode", "slides");
    const query = next.toString();
    router.replace(`/lead/report/${activeReportId}${query ? `?${query}` : ""}`);
  }, [
    redirectToCanonical,
    period,
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

  // Toast on per-query errors.
  useEffect(() => {
    if (activeQ.isError) {
      logClientError("leadForm.activeReport.load_failed", activeQ.error, {
        component: "LeadForm",
        procedure: "reports.getActive",
        reportId: pinnedReportId ?? null,
      });
      toast.error(
        activeQ.error instanceof Error
          ? `Failed to load active report: ${activeQ.error.message}`
          : "Failed to load active report",
      );
    }
  }, [activeQ.isError, activeQ.error, pinnedReportId]);

  useEffect(() => {
    if (byPeriodQ.isError) {
      logClientError("leadForm.byPeriod.load_failed", byPeriodQ.error, {
        component: "LeadForm",
        procedure: "leadForm.byPeriod",
        reportId: targetReportId || null,
        role: sessionRole,
      });
      toast.error(
        byPeriodQ.error instanceof Error
          ? `Failed to load form: ${byPeriodQ.error.message}`
          : "Failed to load form",
      );
    }
  }, [byPeriodQ.isError, byPeriodQ.error, targetReportId, sessionRole]);

  useEffect(() => {
    if (versionsQ.isError) {
      logClientError("leadForm.versions.load_failed", versionsQ.error, {
        component: "LeadForm",
        procedure: "leadForm.versions",
        reportSectionId: sectionIdForActions || null,
      });
      toast.error(
        versionsQ.error instanceof Error
          ? `Failed to load versions: ${versionsQ.error.message}`
          : "Failed to load versions",
      );
    }
  }, [versionsQ.isError, versionsQ.error, sectionIdForActions]);

  useEffect(() => {
    if (historyQ.isError) {
      logClientError("leadForm.history.load_failed", historyQ.error, {
        component: "LeadForm",
        procedure: "reports.myHistory",
      });
      toast.error(
        historyQ.error instanceof Error
          ? `Failed to load history: ${historyQ.error.message}`
          : "Failed to load history",
      );
    }
  }, [historyQ.isError, historyQ.error]);

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

  const restoreMut = useMutation(
    trpc.leadForm.restoreVersion.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        toast.success("Version restored");
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Restore failed";
        toast.error(msg);
      },
    }),
  );

  const createSnapshotMut = useMutation(
    trpc.leadForm.createSnapshot.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
      },
      onError: () => {
        // Autosave-triggered snapshot failures are silent — the user already
        // sees "✓ Saved"; a toast for the background snapshot would confuse.
      },
    }),
  );

  // ---- Build draft payload ----
  const draftPayload = useMemo(
    () => (draftSection ? sectionToDraftPayload(draftSection) : null),
    [draftSection],
  );

  const isLoading =
    activeQ.isLoading ||
    byPeriodQ.isLoading ||
    versionsQ.isLoading ||
    historyQ.isLoading;
  const awaitingRoleRedirect = shouldRouteHeadLikeAwayFromLeadForm;
  const awaitingCanonicalRedirect =
    !!redirectToCanonical &&
    !period &&
    !pinnedReportId &&
    activeReportId !== "";

  // Toggle All state — must live above the early return below, otherwise
  // the hook count drifts between renders and React throws "Rendered more
  // hooks than during the previous render". Each Toggle All click bumps
  // the sync key; AccordionSection mirrors the new groupExpanded into
  // its local state. Individual sections may then drift again via clicks.
  const [groupSyncKey, setGroupSyncKey] = useState(0);
  const [groupExpanded, setGroupExpanded] = useState(true);
  const [currentWeekAddSignal, setCurrentWeekAddSignal] = useState(0);
  const [nextWeekAddSignal, setNextWeekAddSignal] = useState(0);
  const [risksAddSignal, setRisksAddSignal] = useState(0);
  const [decisionsAddSignal, setDecisionsAddSignal] = useState(0);

  // Compute readOnly early (before hook; the autosave hook needs it). When
  // data isn't ready, treat as readOnly (autosave disabled).
  const isReadOnlyEarly =
    !!period ||
    isSubmitted ||
    (byPeriodQ.data ? byPeriodQ.data.readOnly : true);

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
    enabled: !isReadOnlyEarly && !isSubmitted && draftSection !== null,
    initialSavedKey,
    onSaveSuccess: () => {
      // Every successful autosave creates a new (unpinned) version snapshot.
      // Skip when viewing a historical snapshot (read-only overlay) or when
      // a snapshot mutation is already in flight.
      if (!sectionIdForActions || viewedSnapshotVersion !== null) return;
      if (createSnapshotMut.isPending) return;
      createSnapshotMut.mutate({ reportSectionId: sectionIdForActions });
    },
  });

  // 35-07: set document.title to surface the addressed week in the browser
  // tab. Format: "Week 19, May 4-10 - CustomReport". Resolved from the
  // history entry whose reportId matches the loaded section so the label
  // matches the dropdown. Restores the title on unmount.
  const titleHistoryEntry = useMemo(() => {
    if (!byPeriodQ.data?.section?.reportId || !historyQ.data) return null;
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
  const selectedPeriodId =
    pinnedReportId ||
    searchParams.get("period") ||
    activeQ.data?.reportId ||
    "";
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
    !versionsQ.data ||
    !historyQ.data ||
    !draftSection
  ) {
    return <LeadFormSkeleton />;
  }

  // Map raw draft state -> Lead* presentation shapes for existing children.
  const data = mapLeadFormData({
    active: activeQ.data ?? draftSection,
    byPeriod: { section: draftSection, readOnly: byPeriodQ.data.readOnly },
    versions: versionsQ.data,
    history: historyQ.data,
  });

  // F8: enrich unassigned stages with cross-author names and real status.
  // crossAuthorsQ.data has { projectId, stageNames, authorName, stages } per shared product.
  // Stages not owned by the current user but assigned to another lead become
  // ownership:"locked" with their name and real risk color instead of gray "empty".
  const _crossAuthorStageMap = new Map<
    string,
    Map<string, { assignee: string; status: import("../../lib/mappers/traffic-light").StageStatus }>
  >();
  // Join with crossAuthorSectionsQ to incorporate risk severity and blocked items
  // into stage chip color. enrichedCrossAuthors drops stageName so we use the
  // raw crossAuthorSectionsQ data here keyed by authorId.
  const _caSectionByAuthorId = new Map(
    (crossAuthorSectionsQ.data ?? []).map((s) => [s.authorId, s] as const),
  );
  for (const ca of crossAuthorsQ.data ?? []) {
    let _sm = _crossAuthorStageMap.get(ca.projectId);
    if (!_sm) {
      _sm = new Map();
      _crossAuthorStageMap.set(ca.projectId, _sm);
    }
    for (const sn of ca.stageNames) {
      const lower = sn.toLowerCase();
      const stageEntry = ca.stages?.find(
        (s) =>
          s.stageName.toLowerCase() === lower ||
          (lower === "dev" && s.stageName.toLowerCase() === "development") ||
          (lower === "development" && s.stageName.toLowerCase() === "dev"),
      );
      const caSection = _caSectionByAuthorId.get(ca.authorId);
      const stageRisks = (caSection?.risks ?? []).filter(
        (r) => r.projectId === ca.projectId && r.stageName != null &&
          normalizeStageName(r.stageName) === lower,
      );
      const stageItems = (caSection?.items ?? []).filter(
        (i) => i.projectId === ca.projectId && i.stageName != null &&
          normalizeStageName(i.stageName) === lower,
      );
      const status = deriveEffectiveStageStatus(
        trafficToStageStatus(stageEntry?.status ?? null),
        stageRisks,
        stageItems,
      );
      const entry = { assignee: ca.authorName, status };
      _sm.set(lower, entry);
      // Mirror the dev ↔ development alias used in ownedStagesForProject mapper.
      if (lower === "dev") _sm.set("development", entry);
      if (lower === "development") _sm.set("dev", entry);
    }
  }
  const products: Product[] = (data.products as Product[]).map((product) => {
    const stageMap = _crossAuthorStageMap.get(product.id);
    if (!stageMap) return product;
    return {
      ...product,
      stages: product.stages.map((stage) => {
        if (stage.ownership !== "unassigned") return stage;
        const entry = stageMap.get(stage.stageName.toLowerCase());
        if (!entry) return stage;
        return { ...stage, ownership: "locked" as const, assignee: entry.assignee, status: entry.status };
      }),
    };
  });
  // F3.4: build a lookup from snapshot stageStatuses + risks + items so own-author
  // stage chips reflect the status captured at snapshot time, not the current draft.
  // Plain const — must stay after the early-return guard; not a hook.
  const snapshotStageMap = (() => {
    if (!getVersionQ.data) return null;
    const raw = getVersionQ.data as {
      stageStatuses?: Array<{ projectId: string; stageName: string; status: string }>;
      risks?: Array<{ projectId: string; stageName?: string | null; severity?: string }>;
      items?: Array<{ projectId: string; stageName?: string | null; workflowStatus: string }>;
    };
    type SnapEntry = {
      traffic: string;
      risks: Array<{ severity?: string }>;
      items: Array<{ workflowStatus: string }>;
    };
    const map = new Map<string, Map<string, SnapEntry>>();
    for (const ss of raw.stageStatuses ?? []) {
      let pm = map.get(ss.projectId);
      if (!pm) { pm = new Map(); map.set(ss.projectId, pm); }
      pm.set(normalizeStageName(ss.stageName), { traffic: ss.status, risks: [], items: [] });
    }
    for (const r of raw.risks ?? []) {
      if (!r.stageName) continue;
      const entry = map.get(r.projectId)?.get(normalizeStageName(r.stageName));
      if (entry) entry.risks.push({ severity: r.severity });
    }
    for (const item of raw.items ?? []) {
      if (!item.stageName) continue;
      const entry = map.get(item.projectId)?.get(normalizeStageName(item.stageName));
      if (entry) entry.items.push({ workflowStatus: item.workflowStatus });
    }
    return map;
  })();

  // F3.4: when viewing a historical snapshot, override own-author stage statuses
  // with snapshot values so chips reflect the captured state, including risks/items.
  const displayProducts: Product[] = (() => {
    if (!snapshotStageMap) return products;
    return products.map((p) => {
      const pm = snapshotStageMap.get(p.id);
      if (!pm) return p;
      return {
        ...p,
        stages: p.stages.map((s) => {
          if (s.ownership === "locked") return s;
          const snap = pm.get(normalizeStageName(s.stageName));
          if (!snap) return s;
          // snap.traffic is a raw Prisma TrafficLight value; map to StageStatus first,
          // then derive the effective status incorporating captured risks and items.
          const explicit = trafficToStageStatus(snap.traffic as import("../../lib/mappers/traffic-light").TrafficLightStatus | null);
          return { ...s, status: deriveEffectiveStageStatus(explicit, snap.risks, snap.items) };
        }),
      };
    });
  })();

  // Lookup map for resolving productName from productId in cross-author embeds.
  const productNameById = new Map(displayProducts.map((p) => [p.id, p.name]));
  // F3.4: when viewing a historical snapshot, substitute items/risks/decisions
  // from the snapshot payload instead of the current draft.
  type SnapPayload = {
    items?: Array<{
      projectId: string; type: string; text: string; workflowStatus: string;
      stageName?: string | null; priorityRank?: number | null;
    }>;
    risks?: Array<{
      projectId: string; risk: string; impact: string; mitigation: string;
      severity?: string; stageName?: string | null;
    }>;
    decisions?: Array<{
      productId?: string | null; text: string; owner: string;
      impact: string; deadline?: string | null; stageName?: string | null;
    }>;
  };

  function snapWorkflowToStatus(ws: string): import("./mock-data").ItemStatus {
    if (ws === "in_progress") return "in-progress";
    if (ws === "done") return "completed";
    if (ws === "blocked") return "blocked";
    return "planned";
  }

  const snapRaw = viewedSnapshotVersion !== null ? (getVersionQ.data as SnapPayload | null) : null;
  const snapshotAuthor = draftSection.authorName ?? "";

  // When in snapshot mode but snapRaw is null (still loading or API returned
  // no data for this version), use empty arrays — never fall back to the
  // current draft, which would misrepresent historical state.
  const inSnapMode = viewedSnapshotVersion !== null;

  const currentWeekItems: KanbanItem[] = snapRaw?.items
    ? snapRaw.items
        .filter((i) => i.type === "current")
        .map((i, idx): KanbanItem => ({
          id: `snap:cw:${idx}`,
          productId: i.projectId,
          productName: productNameById.get(i.projectId) ?? i.projectId,
          stageName: i.stageName ?? undefined,
          status: snapWorkflowToStatus(i.workflowStatus),
          text: i.text,
          author: snapshotAuthor,
          priorityRank: i.priorityRank ?? null,
        }))
    : inSnapMode
      ? []
      : (data.currentWeekItems as KanbanItem[]);

  const nextWeekItems: KanbanItem[] = snapRaw?.items
    ? snapRaw.items
        .filter((i) => i.type === "next")
        .map((i, idx): KanbanItem => ({
          id: `snap:nw:${idx}`,
          productId: i.projectId,
          productName: productNameById.get(i.projectId) ?? i.projectId,
          stageName: i.stageName ?? undefined,
          status: snapWorkflowToStatus(i.workflowStatus),
          text: i.text,
          author: snapshotAuthor,
          priorityRank: i.priorityRank ?? null,
        }))
    : inSnapMode
      ? []
      : (data.nextWeekItems as KanbanItem[]);

  const risks: RiskEntry[] = snapRaw?.risks
    ? snapRaw.risks.map((r, idx): RiskEntry => ({
        id: `snap:risk:${idx}`,
        productId: r.projectId,
        productName: productNameById.get(r.projectId) ?? r.projectId,
        stageName: r.stageName ?? undefined,
        severity: r.severity === "blocked" ? "blocked" : "at-risk",
        text: r.risk,
        impact: r.impact,
        mitigation: r.mitigation,
      }))
    : inSnapMode
      ? []
      : (data.risks as RiskEntry[]);

  const decisions: DecisionEntry[] = snapRaw?.decisions
    ? snapRaw.decisions.map((d, idx): DecisionEntry => ({
        id: `snap:dec:${idx}`,
        productId: d.productId ?? "",
        productName: productNameById.get(d.productId ?? "") ?? "",
        text: d.text,
        owner: d.owner,
        impact: d.impact,
        deadline: d.deadline ?? null,
        stageName: d.stageName ?? undefined,
      }))
    : inSnapMode
      ? []
      : (data.decisions as DecisionEntry[]);

  // W5/W6: build foreign item arrays from crossAuthorSectionsQ (always-on).
  const foreignCurrentItems: KanbanItem[] =
    crossAuthorSectionsQ.data?.flatMap((ca) =>
      ca.items
        .filter((i) => i.type === "current")
        .map(
          (i): KanbanItem => ({
            id: `foreign:${ca.authorId}:${i.id}`,
            productId: i.projectId,
            productName: productNameById.get(i.projectId) ?? i.projectId,
            stageName: i.stageName ?? undefined,
            status: (i.workflowStatus === "in_progress"
              ? "in-progress"
              : i.workflowStatus === "done"
                ? "completed"
                : i.workflowStatus === "blocked"
                  ? "blocked"
                  : "planned") as import("./mock-data").ItemStatus,
            text: i.text,
            author: ca.authorName,
            authorId: ca.authorId,
            foreign: true,
          }),
        ),
    ) ?? [];

  const foreignNextItems: KanbanItem[] =
    crossAuthorSectionsQ.data?.flatMap((ca) =>
      ca.items
        .filter((i) => i.type === "next")
        .map(
          (i): KanbanItem => ({
            id: `foreign:${ca.authorId}:${i.id}`,
            productId: i.projectId,
            productName: productNameById.get(i.projectId) ?? i.projectId,
            stageName: i.stageName ?? undefined,
            status: (i.workflowStatus === "in_progress"
              ? "in-progress"
              : i.workflowStatus === "done"
                ? "completed"
                : i.workflowStatus === "blocked"
                  ? "blocked"
                  : "planned") as import("./mock-data").ItemStatus,
            text: i.text,
            author: ca.authorName,
            authorId: ca.authorId,
            foreign: true,
          }),
        ),
    ) ?? [];

  const foreignRisks: RiskEntry[] =
    crossAuthorSectionsQ.data?.flatMap((ca) =>
      ca.risks.map(
        (r): RiskEntry => ({
          id: `foreign:${ca.authorId}:${r.id}`,
          productId: r.projectId,
          productName: productNameById.get(r.projectId) ?? r.projectId,
          stageName: r.stageName ?? undefined,
          severity: r.severity === "blocked" ? "blocked" : "at-risk",
          text: r.risk,
          impact: r.impact,
          mitigation: r.mitigation,
          authorName: ca.authorName,
          authorId: ca.authorId,
          foreign: true,
        }),
      ),
    ) ?? [];

  const foreignDecisions: DecisionEntry[] =
    crossAuthorSectionsQ.data?.flatMap((ca) =>
      ca.decisions.map(
        (d): DecisionEntry => ({
          id: `foreign:${ca.authorId}:${d.id}`,
          productId: d.productId,
          productName: productNameById.get(d.productId) ?? d.productId,
          text: d.text,
          owner: d.owner,
          impact: d.impact,
          deadline: d.deadline ? d.deadline.toISOString().slice(0, 10) : null,
          stageName: d.stageName ?? undefined,
          authorId: ca.authorId,
          foreign: true,
        }),
      ),
    ) ?? [];

  const mergedCurrentItems = [...currentWeekItems, ...foreignCurrentItems];
  const mergedNextItems = [...nextWeekItems, ...foreignNextItems];
  const mergedRisks = [...risks, ...foreignRisks];
  const mergedDecisions = [...decisions, ...foreignDecisions];

  /**
   * All priority ranks already assigned to own (non-foreign) items for the
   * entire period (current + next week). Passed to each week section so the
   * ItemEditDialog can disable taken ranks in the picker. Foreign items are
   * intentionally excluded — they are read-only and cannot be edited.
   */
  const ownPeriodRanks: readonly number[] = [
    ...currentWeekItems,
    ...nextWeekItems,
  ]
    .map((i) => i.priorityRank)
    .filter((r): r is number => r != null);

  const periods: ReportPeriod[] = data.periods as ReportPeriod[];
  const versions: VersionSnapshot[] = data.versions as VersionSnapshot[];
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

  // F3.4: viewing a historical snapshot forces read-only mode.
  const isViewingSnapshot = viewedSnapshotVersion !== null;
  const isReadOnly = data.readOnly || !!period || isSubmitted || isViewingSnapshot;

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
      const nextStageStatusByKey = new Map<
        string,
        "green" | "yellow" | "red" | null
      >();
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
    const committedRisks = risks.filter(
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

  function handleRestoreVersion(version: number) {
    if (!sectionIdForActions) return;
    if (
      autosave.dirty &&
      !window.confirm("You have unsaved changes. Continue and overwrite?")
    ) {
      return;
    }
    restoreMut.mutate({ reportSectionId: sectionIdForActions, version });
  }

  function handleToggleAll() {
    setGroupExpanded((prev) => !prev);
    setGroupSyncKey((k) => k + 1);
  }

  // Autosave indicator label — 4-state badge.
  const latestVersionNumber =
    versionsQ.data && versionsQ.data.length > 0
      ? versionsQ.data[versionsQ.data.length - 1]?.version ?? null
      : null;
  const autosaveLabel =
    autosave.state === "saving"
      ? "↻ Saving…"
      : autosave.state === "pending"
        ? "● Pending…"
        : autosave.state === "saved" && autosave.lastSavedAt
          ? `${latestVersionNumber != null ? `Version ${latestVersionNumber} · ` : ""}${autosave.lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
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
          <div className="flex items-center gap-3">
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
            {isSlidesMode && <SlideFullscreenButton targetRef={deckRef} />}
            {!isSlidesMode && <AgentReviewComingSoon />}
            <ViewModeToggle
              mode={isSlidesMode ? "slides" : "edit"}
              editHref={
                targetReportId
                  ? "/lead/report/" + encodeURIComponent(targetReportId)
                  : "/lead/report"
              }
              slidesHref={
                targetReportId
                  ? "/lead/report/" +
                    encodeURIComponent(targetReportId) +
                    "?mode=slides"
                  : "/lead/report"
              }
            />
            {isSubmitted && currentUser.authorRole === "lead" && (
              <button
                type="button"
                className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,117,74,0.25)] bg-[rgba(0,117,74,0.08)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
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
            {!isSubmitted && (
              <button
                type="button"
                className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleSubmit}
                disabled={isReadOnly || submitMut.isPending}
              >
                Submit Report
              </button>
            )}
          </div>
        </header>

        {/* Context shell: period, archive, fill-from, and edit-version controls. */}
        <ReportToolbar
          periodNavigator={<PeriodNavigator periods={visiblePeriods} />}
          archiveToggle={
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
          }
          trailingExtras={
            <>
              <FillFromButton
                periods={periods}
                disabled={isReadOnly || fillFromMut.isPending}
                onFillFrom={handleFillFrom}
              />
              <Separator
                orientation="vertical"
                className="h-5 bg-[var(--color-border)]"
              />
              <VersionHistoryNav
                versions={versions}
                onRestore={isReadOnly ? undefined : handleRestoreVersion}
                onViewVersion={setViewedSnapshotVersion}
                viewedVersion={viewedSnapshotVersion}
              />
            </>
          }
        />

        {/* Read-only banner for past periods. Triggered by either the
            legacy `?period=` query (back-compat) or — 35-07 — when the
            page renders under a `[reportId]` segment that points at a
            past report instead of the lead's active section. */}
        {(period ||
          (pinnedReportId &&
            activeReportId &&
            pinnedReportId !== activeReportId)) &&
          !isSubmitted && (
            <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
              <span className="text-sm text-[var(--color-muted-foreground)]">
                Viewing past period
                {period ? ` · ${period}` : ""}. This form is read-only.
              </span>
            </div>
          )}

        {/* F3.4: snapshot preview banner — shown when user navigates to a
            historical version via VersionHistoryNav ← ›. Stages reflect
            status captured at snapshot time; content is read-only. */}
        {isViewingSnapshot && (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-starbucks-accent)]/40 bg-[var(--color-success)] p-3">
            <span className="text-sm font-medium text-[var(--color-starbucks-accent)]">
              {getVersionQ.isLoading
                ? `Loading snapshot v${viewedSnapshotVersion}…`
                : `Viewing snapshot v${viewedSnapshotVersion} — read-only. Stage statuses reflect this version.`}
            </span>
            <button
              type="button"
              className="rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] px-3 py-1 text-xs font-semibold text-[var(--color-starbucks-accent)] hover:bg-[var(--color-starbucks-accent)]/10 transition-colors"
              onClick={() => setViewedSnapshotVersion(null)}
            >
              Back to current
            </button>
          </div>
        )}

        {/* F3.4: while snapshot data is in flight, show skeleton to prevent
            the current draft content from flashing under the snapshot banner. */}
        {isViewingSnapshot && getVersionQ.isLoading ? (
          <LeadFormSkeleton />
        ) : isSlidesMode ? (
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
              products={displayProducts}
              risks={risks}
              onProductsChange={handleProductsChange}
              onRisksChange={handleRisksChange}
              readOnly={isReadOnly}
              stagesForProduct={stagesForProduct}
              {...(sectionIdForActions
                ? { sectionId: sectionIdForActions }
                : {})}
              {...(currentUser.name
                ? { sectionAuthorName: currentUser.name }
                : {})}
              risksAddSignal={risksAddSignal}
              crossAuthors={enrichedCrossAuthors}
              displayRisks={mergedRisks}
            >
              <AccordionSection
                groupSyncKey={groupSyncKey}
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
                groupSyncKey={groupSyncKey}
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
                  items={mergedCurrentItems}
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
                groupSyncKey={groupSyncKey}
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
                  items={mergedNextItems}
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
                groupSyncKey={groupSyncKey}
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
              groupSyncKey={groupSyncKey}
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
                decisions={mergedDecisions}
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
              Submit Report?
            </h3>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              Your report will be locked and visible to the group head. You will
              not be able to make changes after submission.
            </p>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{currentWeekItems.length}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  current week items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{nextWeekItems.length}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  next week items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{risks.length}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  risks
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{decisions.length}</span>
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
                Submit Report
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
        preview={currentUser.name ?? "Lead submission"}
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
