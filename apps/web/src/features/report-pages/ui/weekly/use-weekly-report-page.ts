import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useContext, useMemo, useState } from "react";

import { useQueryErrorHandler } from "../../../../shared/hooks/query/use-query-error-handler";
import { SessionContext } from "../../../../shared/lib/auth/session-provider";
import { invalidateReview } from "../../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";
import type { ReviewMode, SubmissionFilter } from "../../../review";
import {
  useWeeklyReportMutations,
  type WeeklyReportMutations,
} from "./use-weekly-report-mutations";
import {
  useCanonicalReportRedirect,
  useReportDocumentTitle,
} from "./use-weekly-report-page-effects";
import {
  resolveTerminalNotice,
  type TerminalNotice,
} from "./weekly-report-page-helpers";
import {
  buildWeeklyReportPageView,
  type WeeklyReportPageView,
} from "./weekly-report-page-view";

interface UseWeeklyReportPageParams {
  readonly reportId?: string | undefined;
  readonly redirectToCanonical?: boolean | undefined;
  readonly canonicalBasePath: string;
  readonly authorId?: string | undefined;
  readonly scope: "product" | "lead";
}

interface WeeklyReportPageHandlers {
  readonly setSubmissionFilter: (next: SubmissionFilter) => void;
  readonly setReviewMode: (next: ReviewMode) => void;
  readonly publish: (onSuccess: () => void) => void;
  readonly reopen: (onSuccess: () => void) => void;
  readonly archive: () => void;
  readonly restore: () => void;
}

interface WeeklyReportPageMutationState {
  // One guard for every lifecycle write on this page: publish, reopen, archive
  // and restore all transition the same period row, so any in-flight write
  // must lock the rest.
  readonly isLifecyclePending: boolean;
  readonly archiveLabel: string;
  readonly restoreLabel: string;
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

// Scope to reportId when given; otherwise the session's active period.
function useWeeklyReportQuery(
  reportId: string | undefined,
  focusedAuthorId: string | null,
) {
  const trpc = useTRPC();
  const weeklyQ = useQuery({
    ...trpc.weeklyReport.get.queryOptions(reportId ? { reportId } : {}),
    // The active-period alias can change while its cached report remains fresh.
    ...(reportId ? {} : { staleTime: 0 }),
  });
  useQueryErrorHandler(weeklyQ, {
    event: "weeklyReport.get.load_failed",
    component: "WeeklyReportPage",
    procedure: "weeklyReport.get",
    context: { reportId: reportId ?? null, authorId: focusedAuthorId },
    toastPrefix: "Failed to load status report",
  });
  // `reportData` narrows off `no-period` / undefined so every downstream
  // consumer sees only loaded, active report data.
  const reportData =
    weeklyQ.data && weeklyQ.data.status !== "no-period"
      ? weeklyQ.data
      : undefined;
  return { weeklyQ, reportData };
}

interface WeeklyReportPageViewArgs {
  readonly reportData:
    Parameters<typeof buildWeeklyReportPageView>[0] | undefined;
  readonly scope: "product" | "lead";
  readonly focusedAuthorId: string | null;
  readonly submissionFilter: SubmissionFilter;
}

function useWeeklyReportPageView({
  reportData,
  scope,
  focusedAuthorId,
  submissionFilter,
}: WeeklyReportPageViewArgs): WeeklyReportPageView | null {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const sessionState = useContext(SessionContext);
  const currentRole = sessionState?.user?.role ?? null;
  const currentUserId = sessionState?.user?.id ?? null;

  // Mapper chain is expensive; omit `reviewMode` so a pure Read|Review toggle
  // reuses the same view-model instead of re-running the full derivation.
  return useMemo(() => {
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
}

// Client-only display preferences. `submitted` is effective only when review
// is enabled; `read` lands access-holders on the assembled report, and
// reviewers opt into per-record comments and section verdicts via the toggle.
function useReportViewPreferences() {
  const [submissionFilter, setSubmissionFilter] =
    useState<SubmissionFilter>("submitted");
  const [reviewMode, setReviewMode] = useState<ReviewMode>("read");
  return { submissionFilter, setSubmissionFilter, reviewMode, setReviewMode };
}

function readyState({
  view,
  submissionFilter,
  reviewMode,
  setSubmissionFilter,
  setReviewMode,
  mutations,
}: {
  readonly view: WeeklyReportPageView;
  readonly submissionFilter: SubmissionFilter;
  readonly reviewMode: ReviewMode;
  readonly setSubmissionFilter: (next: SubmissionFilter) => void;
  readonly setReviewMode: (next: ReviewMode) => void;
  readonly mutations: WeeklyReportMutations;
}): WeeklyReportPageState {
  return {
    kind: "ready",
    ...view,
    submissionFilter,
    reviewMode,
    handlers: {
      setSubmissionFilter,
      setReviewMode,
      publish: (onSuccess) => mutations.publish(view.reportId, onSuccess),
      reopen: (onSuccess) => mutations.reopen(view.reportId, onSuccess),
      archive: () => mutations.archive(view.reportId),
      restore: () => mutations.restore(view.reportId),
    },
    mutationState: {
      isLifecyclePending:
        mutations.isPublishOrReopenPending ||
        mutations.isArchivePending ||
        mutations.isRestorePending,
      archiveLabel: mutations.isArchivePending ? "Archiving…" : "Archive",
      restoreLabel: mutations.isRestorePending ? "Restoring…" : "Restore",
    },
  };
}

// Discriminated-union return keeps early-return shell semantics: hooks always
// run; only the final derivation is gated on loaded, non-terminal data.
export function useWeeklyReportPage(
  params: UseWeeklyReportPageParams,
): WeeklyReportPageState {
  const { reportId, redirectToCanonical, canonicalBasePath, scope } = params;
  const focusedAuthorId = params.authorId ?? null;
  const mutations = useWeeklyReportMutations();
  const preferences = useReportViewPreferences();

  const { weeklyQ, reportData } = useWeeklyReportQuery(
    reportId,
    focusedAuthorId,
  );
  useCanonicalReportRedirect({
    enabled: redirectToCanonical,
    reportId,
    resolvedReportId:
      weeklyQ.isFetchedAfterMount &&
      weeklyQ.isSuccess &&
      !weeklyQ.isFetching &&
      weeklyQ.data.status === "active"
        ? weeklyQ.data.reportId
        : null,
    focusedAuthorId,
    canonicalBasePath,
  });

  useReportDocumentTitle(reportData);
  const view = useWeeklyReportPageView({
    reportData,
    scope,
    focusedAuthorId,
    submissionFilter: preferences.submissionFilter,
  });

  if (weeklyQ.isPending) return { kind: "loading" };

  const terminalNotice = resolveTerminalNotice(weeklyQ);
  if (terminalNotice) return { kind: "notice", notice: terminalNotice };

  if (!view) return { kind: "empty" };

  return readyState({ view, mutations, ...preferences });
}
