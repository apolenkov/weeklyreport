"use client";

import { useState, useEffect, useMemo, useRef, useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive } from "lucide-react";
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
import { ownedStagesForProject } from "../../lib/mappers/lead-form";
import { stageStatusToTraffic } from "../../lib/mappers/traffic-light";
import { isoWeekNumber, formatDateRange } from "../../lib/mappers/lead-history";
import {
  useLeadFormAutosave,
  stableStringify,
} from "../../hooks/use-lead-form-autosave";
import { LeadFormSkeleton } from "./lead-form-skeleton";
import { LeadFormSyncBridge } from "./lead-form-sync-bridge";
import { SdlcTooltipProvider } from "../ui/sdlc-tooltip";
import { PeriodNavigator } from "./period-navigator";
import { FillFromButton } from "./fill-from-button";
import { VersionHistoryNav } from "./version-history-nav";
import { CurrentWeekSection } from "./current-week-section";
import { NextWeekSection } from "./next-week-section";
import { DecisionsSection } from "./decisions-section";
import { PrioritiesSection } from "./priorities-section";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { RequestReopenDialog } from "./request-reopen-dialog";
import { LeadSlidesClient } from "../slides/lead-slides-client";

import type {
  Product,
  KanbanItem,
  RiskEntry,
  DecisionEntry,
  PriorityEntry,
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

function StarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 flex-shrink-0"
      stroke="var(--color-starbucks-gold)"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function SlidesViewIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 flex-shrink-0"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4h18v16H3z" />
      <path d="M9 4v16M15 4v16" />
      <path d="M3 10h18" />
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

function ChevronDown({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-[var(--color-muted-foreground)] transition-transform duration-300"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

type AccordionSectionProps = {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly titleColor?: string;
  readonly badge?: string;
  readonly badgeStyle?: React.CSSProperties;
  readonly subtitle?: string;
  readonly defaultOpen?: boolean;
  /**
   * Bumped by the parent's "Toggle All" button to force every section
   * into the same state. Each bump increments the number; the section
   * mirrors `groupExpanded` into its local state on every change. Local
   * clicks afterwards still toggle individual sections — the group sync
   * only fires when the parent actively changes the signal.
   */
  readonly groupSyncKey?: number;
  readonly groupExpanded?: boolean;
  readonly testId?: string;
  readonly actions?: React.ReactNode;
  readonly children: React.ReactNode;
};

function AccordionSection({
  icon,
  title,
  titleColor = "var(--color-primary)",
  badge,
  badgeStyle,
  subtitle,
  defaultOpen = true,
  groupSyncKey,
  groupExpanded,
  testId,
  actions,
  children,
}: AccordionSectionProps) {
  const [expanded, setExpanded] = useState(defaultOpen);

  useEffect(() => {
    // Only react to actual group-toggle actions, not initial mount.
    if (groupSyncKey === undefined || groupExpanded === undefined) return;
    setExpanded(groupExpanded);
  }, [groupSyncKey, groupExpanded]);

  return (
    <div
      data-testid={testId}
      className="overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_0_0.5px_0_rgba(0,0,0,0.12),0_12px_26px_-18px_rgba(0,0,0,0.22),0_2px_4px_rgba(0,0,0,0.06)]"
    >
      <div className="flex w-full items-center justify-between gap-3 p-5 transition-colors hover:bg-[var(--color-surface-hover)]">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {icon}
              <span
                className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em]"
                style={{ color: titleColor }}
              >
                {title}
              </span>
              {badge && (
                <span
                  className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-0.5 font-[family-name:var(--font-sans)] text-[13px] font-semibold tabular-nums text-[var(--color-muted-foreground)]"
                  style={badgeStyle}
                >
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
                {subtitle}
              </span>
            )}
          </div>
          {!actions && <ChevronDown expanded={expanded} />}
        </button>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
        {actions ? (
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-pill)] transition-colors hover:bg-white"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
            aria-expanded={expanded}
          >
            <ChevronDown expanded={expanded} />
          </button>
        ) : null}
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          {/* pt-2 = breathing room between the section header (p-5) and the
              first content row, otherwise the first card sits flush against
              the chevron line and feels cramped. */}
          <div className="px-5 pb-5 pt-2">{children}</div>
        </div>
      </div>
    </div>
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
    priorities: section.priorities
      .filter((p) => hasText(p.text))
      .map((p) => ({
        id: p.id,
        rank: p.rank,
        text: p.text,
        stageIds: p.stageIds,
        productId: p.productId ?? null,
      })),
  };
}

function normalizeStageName(stageName: string): string {
  const lower = stageName.toLowerCase();
  return lower === "development" ? "dev" : lower;
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
  const requestedAuthorId = searchParams.get("authorId") ?? undefined;
  const requestedAuthorIdNormalized = requestedAuthorId?.trim() || undefined;
  const isSlidesMode = mode === "slides";
  const sessionState = useContext(SessionContext);
  const sessionRole = sessionState?.user?.role ?? null;
  const isHeadLikeSession = sessionRole === "head" || sessionRole === "admin";
  const shouldRouteHeadLikeAwayFromLeadForm =
    isHeadLikeSession && !requestedAuthorIdNormalized;
  const shouldDeferForSession = Boolean(sessionState && sessionState.isLoading);
  const isPinnedAuthorOwnView = Boolean(
    pinnedReportId &&
    requestedAuthorIdNormalized &&
    sessionState?.user?.id &&
    requestedAuthorIdNormalized === sessionState.user.id,
  );
  const isPinnedAuthorView = Boolean(
    pinnedReportId && requestedAuthorIdNormalized && !isPinnedAuthorOwnView,
  );

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
      ...(requestedAuthorIdNormalized
        ? { authorId: requestedAuthorIdNormalized }
        : {}),
    }),
    enabled:
      targetReportId !== "" &&
      !shouldRouteHeadLikeAwayFromLeadForm &&
      !shouldDeferForSession,
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
    if (requestedAuthorId) next.set("authorId", requestedAuthorId);
    if (isSlidesMode) next.set("mode", "slides");
    const query = next.toString();
    router.replace(`/lead/report/${activeReportId}${query ? `?${query}` : ""}`);
  }, [
    redirectToCanonical,
    period,
    pinnedReportId,
    activeReportId,
    requestedAuthorId,
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
        authorId: requestedAuthorIdNormalized ?? null,
      });
      toast.error(
        activeQ.error instanceof Error
          ? `Failed to load active report: ${activeQ.error.message}`
          : "Failed to load active report",
      );
    }
  }, [
    activeQ.isError,
    activeQ.error,
    pinnedReportId,
    requestedAuthorIdNormalized,
  ]);

  useEffect(() => {
    if (byPeriodQ.isError) {
      logClientError("leadForm.byPeriod.load_failed", byPeriodQ.error, {
        component: "LeadForm",
        procedure: "leadForm.byPeriod",
        reportId: targetReportId || null,
        authorId: requestedAuthorIdNormalized ?? null,
        role: sessionRole,
      });
      toast.error(
        byPeriodQ.error instanceof Error
          ? `Failed to load form: ${byPeriodQ.error.message}`
          : "Failed to load form",
      );
    }
  }, [
    byPeriodQ.isError,
    byPeriodQ.error,
    targetReportId,
    requestedAuthorIdNormalized,
    sessionRole,
  ]);

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
  const [submitFieldError, setSubmitFieldError] = useState<{
    field: "priorities";
    message: string;
  } | null>(null);
  const prioritiesRef = useRef<HTMLDivElement>(null);

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
        // Intercept Zod validation errors from the server and surface
        // human-readable messages instead of raw JSON.
        if (err instanceof Error) {
          const raw = err.message;
          // Server may return serialized Zod issues as a JSON array string.
          // Detect priorities.too_small specifically and guide the user.
          try {
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const hasPrioritiesMin = parsed.some(
                (issue) =>
                  typeof issue === "object" &&
                  issue !== null &&
                  "path" in issue &&
                  Array.isArray((issue as { path: unknown[] }).path) &&
                  (issue as { path: unknown[] }).path.includes("priorities") &&
                  "code" in issue &&
                  (issue as { code: string }).code === "too_small",
              );
              if (hasPrioritiesMin) {
                toast.error(
                  "Please add at least one priority before submitting.",
                );
                setShowSubmitConfirm(false);
                setSubmitFieldError({
                  field: "priorities",
                  message: "Add at least one priority before submitting.",
                });
                prioritiesRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                return;
              }
            }
          } catch {
            // Not JSON — fall through to the generic message.
          }
          toast.error(raw);
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

  // createSnapshot is reused for both manual ("Save Version" button) and
  // auto (every 10 autosaves) paths. The toast is keyed on a ref so the
  // auto-path can fire silently while the manual path confirms.
  const isManualSaveRef = useRef(false);
  const createSnapshotMut = useMutation(
    trpc.leadForm.createSnapshot.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        if (isManualSaveRef.current) {
          toast.success("Version saved");
          isManualSaveRef.current = false;
        }
      },
      onError: (err: unknown) => {
        // Auto-path failures stay silent — they're a safety net, not a
        // user request. Manual failures surface so the user knows the
        // checkpoint didn't land.
        if (isManualSaveRef.current) {
          const msg =
            err instanceof Error ? err.message : "Save Version failed";
          toast.error(msg);
          isManualSaveRef.current = false;
        }
      },
    }),
  );

  // A16: auto-versioning — track saves; snapshot once per minute if new saves occurred.
  const autosaveCountRef = useRef(0);
  const lastSnapshotCountRef = useRef(0);

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
  const [prioritiesAddSignal, setPrioritiesAddSignal] = useState(0);

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
      autosaveCountRef.current += 1;
    },
  });

  // A16: snapshot once per minute when there are new autosaves since the
  // last snapshot. Uses a stable ref for mutate so the interval is not
  // reset on every mutation-state change (isPending, isSuccess, etc.).
  const snapshotMutateRef = useRef(createSnapshotMut.mutate);
  snapshotMutateRef.current = createSnapshotMut.mutate;

  useEffect(() => {
    if (!sectionIdForActions || isReadOnlyEarly || isSubmitted) return;
    const id = setInterval(() => {
      if (autosaveCountRef.current > lastSnapshotCountRef.current) {
        lastSnapshotCountRef.current = autosaveCountRef.current;
        snapshotMutateRef.current({ reportSectionId: sectionIdForActions });
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [sectionIdForActions, isReadOnlyEarly, isSubmitted]);

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

  const products: Product[] = data.products as Product[];
  const currentWeekItems: KanbanItem[] = data.currentWeekItems as KanbanItem[];
  const nextWeekItems: KanbanItem[] = data.nextWeekItems as KanbanItem[];
  const risks: RiskEntry[] = data.risks as RiskEntry[];
  const decisions: DecisionEntry[] = data.decisions as DecisionEntry[];
  const priorities: PriorityEntry[] = data.priorities as PriorityEntry[];
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

  const isReadOnly =
    data.readOnly || !!period || isSubmitted || isPinnedAuthorView;

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

  function handlePrioritiesChange(next: PriorityEntry[]) {
    if (next.some((p) => p.text.trim().length > 0)) {
      setSubmitFieldError(null);
    }
    setDraftSection((prev) => {
      if (!prev) return prev;
      // The UI now owns the full priority list (variable length, ranks
      // renumbered to 1..N on every change). The next array IS the new
      // state — preserving "missing" ranks would resurrect deleted rows.
      // Match by rank when an existing raw entry has the same rank so we
      // keep its server-assigned id; otherwise insert a fresh row.
      const existingByRank = new Map(
        prev.priorities.map((p) => [p.rank, p] as const),
      );
      const merged = next.map((p) => {
        const existing = existingByRank.get(p.rank);
        if (existing) {
          return {
            ...existing,
            text: p.text,
            stageName: null,
            stageIds: p.stageIds,
            productId: p.productId || null,
          };
        }
        return {
          rank: p.rank,
          text: p.text,
          stageName: null,
          stageIds: p.stageIds,
          productId: p.productId || null,
        };
      });
      return { ...prev, priorities: merged };
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
    if (!draftPayload?.priorities.some((p) => p.text.trim().length > 0)) {
      setSubmitFieldError({
        field: "priorities",
        message: "Add at least one priority before submitting.",
      });
      prioritiesRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      prioritiesRef.current?.focus();
      return;
    }
    setSubmitFieldError(null);
    setShowSubmitConfirm(true);
  }

  function handleConfirmSubmit() {
    if (!draftPayload) return;
    if (!draftPayload.priorities.some((p) => p.text.trim().length > 0)) {
      setShowSubmitConfirm(false);
      handleSubmit();
      return;
    }
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

  function handleSaveVersion() {
    if (!sectionIdForActions) return;
    isManualSaveRef.current = true;
    // Sync lastSnapshotCount so the 1-min interval doesn't double-snapshot.
    lastSnapshotCountRef.current = autosaveCountRef.current;
    createSnapshotMut.mutate({ reportSectionId: sectionIdForActions });
  }

  function handleToggleAll() {
    setGroupExpanded((prev) => !prev);
    setGroupSyncKey((k) => k + 1);
  }

  // Autosave indicator label.
  const autosaveLabel =
    autosave.state === "saving"
      ? "Saving…"
      : autosave.state === "pending"
        ? "Pending…"
        : autosave.state === "saved" && autosave.lastSavedAt
          ? `Saved at ${autosave.lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : autosave.state === "error"
            ? "Save failed"
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
          {!isSlidesMode && (
            <div className="flex items-center gap-3">
              {(currentWeekItems.length > 0 ||
                nextWeekItems.length > 0 ||
                risks.length > 0 ||
                decisions.length > 0 ||
                priorities.length > 0) && (
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
              <Link
                href={
                  targetReportId
                    ? "/lead/report/" + encodeURIComponent(targetReportId)
                    : "/lead/report"
                }
                scroll={false}
                className="inline-flex h-10 min-w-[96px] items-center justify-center gap-1 rounded-l-[var(--radius-pill)] border border-r-0 border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-3 text-sm font-semibold text-white transition-colors"
              >
                Edit
              </Link>
              <Link
                href={
                  targetReportId
                    ? "/lead/report/" +
                      encodeURIComponent(targetReportId) +
                      "?mode=slides"
                    : "/lead/report"
                }
                scroll={false}
                className="inline-flex h-10 min-w-[96px] items-center justify-center gap-1 rounded-r-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors"
                aria-label="Open slides mode"
              >
                <SlidesViewIcon />
                Slides
              </Link>
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
          )}
        </header>

        {/* Context shell: period, archive, fill-from, and edit-version controls. */}
        {!isSlidesMode && (
          <div className="flex flex-nowrap items-center justify-between gap-3 overflow-x-auto rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-[var(--color-surface-hover)]/70 px-2 py-1.5 whitespace-nowrap">
            <PeriodNavigator periods={visiblePeriods} />

            <label
              className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-2 text-[13px] font-semibold text-[var(--color-foreground)]"
              title="Show archived periods"
            >
              <input
                type="checkbox"
                checked={showArchivePeriods}
                onChange={(event) =>
                  setShowArchivePeriods(event.currentTarget.checked)
                }
                className="h-4 w-4 accent-[var(--color-starbucks-accent)]"
                aria-label="Show archived periods"
              />
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Show archived</span>
            </label>

            <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
              <FillFromButton
                periods={periods}
                disabled={isReadOnly || fillFromMut.isPending}
                onFillFrom={handleFillFrom}
              />
              <VersionHistoryNav
                versions={versions}
                onRestore={isReadOnly ? undefined : handleRestoreVersion}
                onSaveVersion={isReadOnly ? undefined : handleSaveVersion}
                canSaveVersion={!createSnapshotMut.isPending}
              />
            </div>
          </div>
        )}

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

        {isSlidesMode ? (
          <LeadSlidesClient
            initialReportId={targetReportId || pinnedReportId || null}
            chrome="content"
          />
        ) : (
          <>
            <LeadFormSyncBridge.Provider
              products={products}
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
                  items={currentWeekItems}
                  readOnly={isReadOnly}
                  onItemsChange={handleCurrentWeekItemsChange}
                  currentUserName={currentUser.name}
                  products={products}
                  stagesForProduct={stagesForProduct}
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
                  items={nextWeekItems}
                  readOnly={isReadOnly}
                  onItemsChange={handleNextWeekItemsChange}
                  currentUserName={currentUser.name}
                  products={products}
                  stagesForProduct={stagesForProduct}
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

            {/* Priorities — variable-length list */}
            <div
              ref={prioritiesRef}
              tabIndex={-1}
              className="scroll-mt-24 outline-none"
            >
              <AccordionSection
                groupSyncKey={groupSyncKey}
                groupExpanded={groupExpanded}
                testId="lead-section-priorities"
                icon={<StarIcon />}
                title="Priorities"
                titleColor="var(--color-starbucks-gold)"
                badge={`${priorities.length}`}
                subtitle="Top priorities for the week, tied back to product and SDLC stage where relevant."
                actions={
                  !isReadOnly ? (
                    <button
                      type="button"
                      className="btn-press inline-flex min-h-10 min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => setPrioritiesAddSignal((value) => value + 1)}
                    >
                      + Add Priority
                    </button>
                  ) : null
                }
              >
                <PrioritiesSection
                  priorities={priorities}
                  readOnly={isReadOnly}
                  onChange={handlePrioritiesChange}
                  availableStages={availableStages}
                  products={products}
                  defaultProductId={products[0]?.id}
                  sectionAuthorName={currentUser.name ?? undefined}
                  addSignal={prioritiesAddSignal}
                />
                {submitFieldError?.field === "priorities" && (
                  <p
                    role="alert"
                    className="mt-3 text-sm font-medium text-[var(--color-destructive)]"
                  >
                    {submitFieldError.message}
                  </p>
                )}
              </AccordionSection>
            </div>
          </>
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
