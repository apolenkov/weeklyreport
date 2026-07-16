import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useMemo, useState } from "react";

import { invalidateReview } from "../../../lib/cache-keys";
import {
  formatPeriodRangeWithYear,
  isoWeekNumber,
} from "../../../lib/format-date";
import { SessionContext } from "../../../lib/session-provider";
import { useTRPC } from "../../../lib/trpc-context";
import { useQueryErrorHandler } from "../../../lib/use-query-error-handler";
import type { ReviewMode, SubmissionFilter } from "../../review";
import { useWeeklyReportMutations } from "./use-weekly-report-mutations";
import {
  resolveTerminalNotice,
  type TerminalNotice,
} from "./weekly-report-page-helpers";
import {
  buildWeeklyReportPageView,
  type WeeklyReportPageView,
} from "./weekly-report-page-view";

interface UseWeeklyReportPageParams {
  readonly reportId?: string;
  readonly redirectToCanonical?: boolean;
  readonly canonicalBasePath: string;
  readonly authorId?: string;
  readonly scope: "product" | "lead";
}

interface WeeklyReportPageHandlers {
  readonly setSubmissionFilter: (next: SubmissionFilter) => void;
  readonly setReviewMode: (next: ReviewMode) => void;
  readonly publish: () => void;
  readonly reopen: () => void;
  readonly archive: () => void;
}

interface WeeklyReportPageMutationState {
  readonly isPublishOrReopenPending: boolean;
  readonly isArchivePending: boolean;
  readonly archiveLabel: string;
}

export type WeeklyReportPageState =
  | { readonly kind: "loading" }
  | { readonly kind: "notice"; readonly notice: TerminalNotice }
  | { readonly kind: "empty" }
  | ({
      readonly kind: "ready";
      readonly submissionFilter: SubmissionFilter;
      readonly reviewMode: ReviewMode;
      readonly handlers: WeeklyReportPageHandlers;
      readonly mutationState: WeeklyReportPageMutationState;
    } & WeeklyReportPageView);

/**
 * The WeeklyReportPage controller: owns the query, the three lifecycle
 * mutations (publish/reopen/archive, via `useWeeklyReportMutations`), the
 * canonical-URL redirect, the document-title effect, and hands loaded data to
 * the pure `buildWeeklyReportPageView` derivation. Returns a discriminated
 * union so the shell keeps the page's early-return semantics — hooks below
 * always run unconditionally; only the final derivation is guarded on
 * loaded, non-terminal data.
 */
export function useWeeklyReportPage(
  params: UseWeeklyReportPageParams,
): WeeklyReportPageState {
  const { reportId, redirectToCanonical, canonicalBasePath, scope } = params;
  const focusedAuthorId = params.authorId ?? null;
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const sessionState = useContext(SessionContext);
  const currentRole = sessionState?.user?.role ?? null;
  const currentUserId = sessionState?.user?.id ?? null;
  const mutations = useWeeklyReportMutations();

  // review-acknowledgement (§7): per-user, client-only accordion filter. Default
  // submitted-only; rendered (and effective) only when review is enabled — a
  // head/admin/viewer on a live open|reopened period, never a lead or a
  // published snapshot.
  const [submissionFilter, setSubmissionFilter] =
    useState<SubmissionFilter>("submitted");

  // Read|Review body mode. Default "read" so any access-holder lands on the
  // assembled report; a designated reviewer opts into the per-record comment
  // composer and per-section verdict controls via the toggle.
  const [reviewMode, setReviewMode] = useState<ReviewMode>("read");

  // weeklyReport.get input: { reportId?: string } | undefined.
  // When reportId is given, scope to that report; otherwise fall back to the
  // session's active period (server-side default).
  const queryInput = reportId ? { reportId } : {};
  const weeklyQ = useQuery(trpc.weeklyReport.get.queryOptions(queryInput));

  useQueryErrorHandler(weeklyQ, {
    event: "weeklyReport.get.load_failed",
    component: "WeeklyReportPage",
    procedure: "weeklyReport.get",
    context: { reportId: reportId ?? null, authorId: focusedAuthorId },
    toastPrefix: "Failed to load status report",
  });

  // Bare `/head/report` -> redirect to `/head/report/<reportId>` once the
  // active reportId is known. Skipped when:
  //   • the page already renders under `[reportId]` (reportId prop set)
  //   • there is no resolvable report (weeklyQ data not loaded or no-period)
  const resolvedReportId =
    weeklyQ.data?.status === "active" ? weeklyQ.data.reportId : null;
  useEffect(() => {
    if (!redirectToCanonical) return;
    if (reportId) return;
    if (!resolvedReportId) return;
    const authorQuery = focusedAuthorId
      ? `?authorId=${encodeURIComponent(focusedAuthorId)}`
      : "";
    router.replace(`${canonicalBasePath}/${resolvedReportId}${authorQuery}`);
  }, [
    redirectToCanonical,
    reportId,
    resolvedReportId,
    focusedAuthorId,
    router,
    canonicalBasePath,
  ]);

  // Surface the period in the browser tab title.
  const titleParts = useMemo(() => {
    if (!weeklyQ.data || weeklyQ.data.status === "no-period") return null;
    const start = weeklyQ.data.periodStart;
    const end = weeklyQ.data.periodEnd;
    if (!(start instanceof Date) || !(end instanceof Date)) return null;
    return {
      week: isoWeekNumber(start),
      range: formatPeriodRangeWithYear(start, end),
    };
  }, [weeklyQ.data]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!titleParts) return;
    const previous = document.title;
    document.title = `Week ${titleParts.week}, ${titleParts.range} - CustomReport`;
    return () => {
      document.title = previous;
    };
  }, [titleParts]);

  // Narrows weeklyQ.data off the `no-period` / undefined variants for TS —
  // used by the memo below and, once past the terminal-state guards, known
  // to be loaded and active.
  const reportData =
    weeklyQ.data && weeklyQ.data.status !== "no-period"
      ? weeklyQ.data
      : undefined;

  // review-acknowledgement (§7): the mapper chain is the expensive part of the
  // derivation (scope/review/§7-filter/focus branching). Keying the memo on
  // the data-dependent inputs only — never `reviewMode` — means a pure
  // UI-toggle re-render (e.g. Read|Review) reuses the same view-model object
  // instead of re-running the full chain.
  const view = useMemo(() => {
    if (!reportData) return null;
    return buildWeeklyReportPageView(reportData, {
      scope,
      currentRole,
      currentUserId,
      focusedAuthorId,
      submissionFilter,
      onReviewMutated: () => invalidateReview(qc, trpc),
    });
  }, [
    reportData,
    scope,
    currentRole,
    currentUserId,
    focusedAuthorId,
    submissionFilter,
    qc,
    trpc,
  ]);

  if (weeklyQ.isLoading) {
    return { kind: "loading" };
  }

  // Terminal states (invalid-link + no-period). Resolved by a pure helper so
  // the page function stays under the complexity budget.
  const terminalNotice = resolveTerminalNotice(weeklyQ);
  if (terminalNotice) {
    return { kind: "notice", notice: terminalNotice };
  }

  if (!view) {
    return { kind: "empty" };
  }

  return {
    kind: "ready",
    ...view,
    submissionFilter,
    reviewMode,
    handlers: {
      setSubmissionFilter,
      setReviewMode,
      publish: () => mutations.publish(view.reportId),
      reopen: () => mutations.reopen(view.reportId),
      archive: () => mutations.archive(view.reportId),
    },
    mutationState: {
      isPublishOrReopenPending: mutations.isPublishOrReopenPending,
      isArchivePending: mutations.isArchivePending,
      archiveLabel: mutations.isArchivePending ? "Archiving…" : "Archive",
    },
  };
}
