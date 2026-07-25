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

// Discriminated-union return keeps early-return shell semantics: hooks always
// run; only the final derivation is gated on loaded, non-terminal data.
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

  // Per-user, client-only accordion filter. Default submitted-only; effective
  // only when review is enabled (access-holder on a live period).
  const [submissionFilter, setSubmissionFilter] =
    useState<SubmissionFilter>("submitted");

  // Default "read" so access-holders land on the assembled report; reviewers
  // opt into per-record comments and section verdicts via the toggle.
  const [reviewMode, setReviewMode] = useState<ReviewMode>("read");

  // Scope to reportId when given; otherwise the session's active period.
  const queryInput = reportId ? { reportId } : {};
  const weeklyQ = useQuery(trpc.weeklyReport.get.queryOptions(queryInput));

  useQueryErrorHandler(weeklyQ, {
    event: "weeklyReport.get.load_failed",
    component: "WeeklyReportPage",
    procedure: "weeklyReport.get",
    context: { reportId: reportId ?? null, authorId: focusedAuthorId },
    toastPrefix: "Failed to load status report",
  });

  // Bare `/head/report` → canonical `/head/report/<reportId>` once known.
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

  // Narrows off `no-period` / undefined so the memo sees only active data.
  const reportData =
    weeklyQ.data && weeklyQ.data.status !== "no-period"
      ? weeklyQ.data
      : undefined;

  // Mapper chain is expensive; omit `reviewMode` so a pure Read|Review toggle
  // reuses the same view-model instead of re-running the full derivation.
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
