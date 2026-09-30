"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { type ComponentProps, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  invalidateLeadForm,
  invalidateSubmissionDashboard,
} from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { DashboardPanelIssue } from "./dashboard-panel-state";
import { ReopenRequestRow } from "./reopen-request-row";
import { useFocusQueueAfterDecision } from "./use-focus-queue-after-decision";

type DashboardReopenRequest = ComponentProps<
  typeof ReopenRequestRow
>["request"];
type ReopenDecision = "approved" | "rejected";

function useRespondReopenRequest(onResolved: (id: string) => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.admin.respondReopenRequest.mutationOptions({
      onSuccess: (result, variables) => {
        onResolved(variables.id);
        if (result.staleAutoClosed) {
          toast.info(
            "This section was already reopened; the request was closed.",
          );
        } else {
          toast.success(
            result.decision === "approved"
              ? "Request approved; section reopened."
              : "Request rejected.",
          );
        }
      },
      onError: (err) => {
        toast.error(`Failed to process request: ${err.message}`);
      },
      // Invalidate on settled so stale/race outcomes refresh both the request
      // queue and the report projections that may have changed server-side.
      onSettled: () => {
        invalidateSubmissionDashboard(queryClient, trpc);
        invalidateLeadForm(queryClient, trpc);
        void queryClient
          .invalidateQueries(trpc.admin.listReopenRequests.pathFilter())
          .catch(() => undefined);
        void queryClient
          .invalidateQueries(trpc.admin.pendingReopenCount.pathFilter())
          .catch(() => undefined);
      },
    }),
  );
}

interface ReopenRequestListProps {
  readonly requests: readonly DashboardReopenRequest[];
  readonly respondingId: string | null;
  readonly note: string;
  readonly onNoteChange: (note: string) => void;
  readonly onStartRespond: (id: string) => void;
  readonly onCancel: () => void;
  readonly onDecide: (id: string, decision: ReopenDecision) => void;
  readonly isPending: boolean;
  readonly pendingDecision: ReopenDecision | undefined;
}

function ReopenRequestList({
  requests,
  respondingId,
  note,
  onNoteChange,
  onStartRespond,
  onCancel,
  onDecide,
  isPending,
  pendingDecision,
}: ReopenRequestListProps) {
  return (
    <ul className="space-y-3">
      {requests.map((r) => (
        <ReopenRequestRow
          key={r.id}
          request={r}
          isResponding={respondingId === r.id}
          note={note}
          onNoteChange={onNoteChange}
          onStartRespond={() => onStartRespond(r.id)}
          onCancel={onCancel}
          onReject={() => onDecide(r.id, "rejected")}
          onApprove={() => onDecide(r.id, "approved")}
          isPending={isPending}
          pendingDecision={pendingDecision}
        />
      ))}
    </ul>
  );
}

function ReopenRequestsIssue({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}) {
  return (
    <div>
      <DashboardPanelIssue
        kind="leads"
        testId="reopen-requests-error"
        title="Reopen requests unavailable"
        description={
          error instanceof Error
            ? error.message
            : "The reopen queue could not be loaded."
        }
        onRetry={onRetry}
      />
    </div>
  );
}

function ReopenRequestsHeader({ countLabel }: { readonly countLabel: string }) {
  return (
    <header className="mb-3 flex items-center justify-between">
      <h2 className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]">
        Reopen Requests
      </h2>
      <span className="rounded-[var(--radius-pill)] bg-[var(--color-status-at-risk-bg)] px-2 py-0.5 text-xs font-bold text-[var(--color-status-at-risk-fg)]">
        {countLabel}
      </span>
    </header>
  );
}

export function ReopenRequestsCard() {
  const trpc = useTRPC();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const closeResponder = () => {
    setRespondingId(null);
    setNote("");
  };

  const listQuery = useInfiniteQuery(
    trpc.admin.listReopenRequests.infiniteQueryOptions(
      { status: "pending" },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    ),
  );
  const countQuery = useQuery(
    trpc.admin.pendingReopenCount.queryOptions(undefined),
  );
  const requests = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data?.pages],
  );
  const { queueRef, markDecided } = useFocusQueueAfterDecision(requests);
  const respondMut = useRespondReopenRequest((id) => {
    markDecided(id);
    closeResponder();
  });

  if (listQuery.isPending) {
    return (
      <section
        className="min-h-28 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4"
        role="status"
        aria-busy="true"
        aria-label="Loading pending reopen requests"
      >
        <div className="h-5 w-40 animate-pulse rounded bg-[var(--color-surface-hover)]" />
        <div className="mt-4 h-12 w-full animate-pulse rounded bg-[var(--color-surface-hover)]" />
      </section>
    );
  }

  if (listQuery.isError && requests.length === 0) {
    return (
      <ReopenRequestsIssue
        error={listQuery.error}
        onRetry={() => {
          void listQuery.refetch().catch(() => undefined);
        }}
      />
    );
  }

  // The card is a queue: render nothing when there is nothing to decide.
  if (requests.length === 0) return null;

  return (
    <section
      ref={queueRef}
      tabIndex={-1}
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      aria-label="Pending reopen requests"
    >
      <ReopenRequestsHeader
        countLabel={
          countQuery.data !== undefined
            ? `${countQuery.data.count} pending`
            : countQuery.isError
              ? `Count unavailable · ${requests.length} loaded`
              : `Count loading · ${requests.length} loaded`
        }
      />

      <ReopenRequestList
        requests={requests}
        respondingId={respondingId}
        note={note}
        onNoteChange={setNote}
        onStartRespond={(id) => {
          setRespondingId(id);
          setNote("");
        }}
        onCancel={closeResponder}
        onDecide={(id, decision) =>
          respondMut.mutate({ id, decision, note: note.trim() || undefined })
        }
        isPending={respondMut.isPending}
        pendingDecision={respondMut.variables?.decision}
      />

      {listQuery.isError ? (
        <DashboardNextPageIssue
          error={listQuery.error}
          isRetrying={listQuery.isFetching}
          onRetry={() => {
            if (listQuery.isFetchNextPageError) {
              void listQuery.fetchNextPage({ cancelRefetch: false });
            } else {
              void listQuery.refetch({ cancelRefetch: false });
            }
          }}
        />
      ) : listQuery.hasNextPage ? (
        <DashboardLoadMore
          isLoading={listQuery.isFetchingNextPage}
          onLoadMore={() => {
            void listQuery.fetchNextPage({ cancelRefetch: false });
          }}
        />
      ) : null}
    </section>
  );
}

function DashboardLoadMore({
  isLoading,
  onLoadMore,
}: {
  readonly isLoading: boolean;
  readonly onLoadMore: () => void;
}) {
  return (
    <div className="mt-4 flex justify-center">
      <button
        type="button"
        disabled={isLoading}
        onClick={onLoadMore}
        className="rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {isLoading ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}

function DashboardNextPageIssue({
  error,
  isRetrying,
  onRetry,
}: {
  readonly error: unknown;
  readonly isRetrying: boolean;
  readonly onRetry: () => void;
}) {
  const focusRetry = useCallback(
    (element: HTMLButtonElement | null) => element?.focus(),
    [],
  );

  return (
    <div
      role="alert"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-destructive)] bg-[var(--color-status-blocked-bg)] p-3 text-sm text-[var(--color-destructive)]"
    >
      <span>
        Some requests could not be loaded:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </span>
      <button
        ref={focusRetry}
        type="button"
        disabled={isRetrying}
        onClick={onRetry}
        className="rounded-[var(--radius-pill)] border border-current px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {isRetrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
