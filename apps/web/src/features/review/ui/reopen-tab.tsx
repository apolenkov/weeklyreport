"use client";

import { useFocusAfterRowRemoved } from "../../../shared/hooks/browser/use-focus-after-row-removed";
import { formatClientErrorMessage } from "../../../shared/lib/errors/client-error-reporting";
import type { ReopenDecision } from "../../../shared/ui/forms/reopen-respond-form";
import { TabHeader, TabSearch } from "../../../shared/ui/tabs/tab-header";
import {
  LoadMoreRequestsButton,
  ReopenNextPageIssue,
} from "./reopen-pagination-controls";
import { type ReopenRequest, ReopenRequestCard } from "./reopen-request-card";
import {
  type ReopenFilterStatus,
  useReopenTabState,
} from "./use-reopen-tab-state";

const FILTERS: readonly { value: ReopenFilterStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

function ReopenFilterBar({
  filter,
  onChange,
}: {
  readonly filter: ReopenFilterStatus;
  readonly onChange: (next: ReopenFilterStatus) => void;
}) {
  return (
    <div className="flex gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] p-1">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => onChange(f.value)}
          className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1 ${
            filter === f.value
              ? "bg-[var(--color-starbucks-accent)] text-[var(--color-primary-foreground)]"
              : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)]"
          }`}
          aria-pressed={filter === f.value}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// The respond form is single-open: one `respondingId` and one shared note draft
// serve the whole list, so the draft lives here rather than inside each card.
interface ReopenRequestListProps {
  readonly requests: readonly ReopenRequest[];
  readonly respondingId: string | null;
  readonly note: string;
  readonly isSaving: boolean;
  readonly pendingDecision: ReopenDecision | undefined;
  readonly onNoteChange: (next: string) => void;
  readonly startRespond: (id: string) => void;
  readonly cancelRespond: () => void;
  readonly respond: (id: string, decision: ReopenDecision) => void;
}

function ReopenRequestList({
  requests,
  respondingId,
  note,
  onNoteChange,
  isSaving,
  pendingDecision,
  startRespond,
  cancelRespond,
  respond,
}: ReopenRequestListProps) {
  return (
    <ul className="space-y-3">
      {requests.map((r) => (
        <ReopenRequestCard
          key={r.id}
          request={r}
          isResponding={respondingId === r.id}
          note={note}
          isSaving={isSaving}
          pendingDecision={pendingDecision}
          onStartRespond={() => startRespond(r.id)}
          onCancelRespond={cancelRespond}
          onNoteChange={onNoteChange}
          onReject={() => respond(r.id, "rejected")}
          onApprove={() => respond(r.id, "approved")}
        />
      ))}
    </ul>
  );
}

function ReopenTabHeader({
  countLabel,
  filter,
  setFilter,
  search,
  setSearch,
}: {
  readonly countLabel: string;
  readonly filter: ReopenFilterStatus;
  readonly setFilter: (next: ReopenFilterStatus) => void;
  readonly search: string;
  readonly setSearch: (next: string) => void;
}) {
  return (
    <TabHeader
      title="Reopen Requests"
      description="Leads ask for permission to edit a submitted section."
      count={countLabel}
      search={
        <TabSearch
          value={search}
          onChange={setSearch}
          placeholder="Lead, email, or week…"
          testId="reopen-search"
        />
      }
      actions={<ReopenFilterBar filter={filter} onChange={setFilter} />}
    />
  );
}

function reopenCountLabel(
  isPending: boolean,
  hasNextPage: boolean,
  count: number,
): string {
  if (isPending) return "Loading…";
  if (hasNextPage) return `${count} loaded`;
  return `${count} ${count === 1 ? "request" : "requests"}`;
}

export function ReopenTab() {
  const {
    filter,
    setFilter,
    search,
    setSearch,
    requests,
    listQuery,
    respondingId,
    note,
    isSaving,
    pendingDecision,
    onNoteChange,
    startRespond,
    cancelRespond,
    respond,
  } = useReopenTabState();
  // A decision removes the form (and, under the Pending filter, the row) that
  // held focus. The results region outlives both and holds the empty state once
  // the last row is gone, so it is the stable, visible place to land. The open
  // form counts as one removable row.
  const resultsRef = useFocusAfterRowRemoved<HTMLDivElement>(
    requests.length + (respondingId === null ? 0 : 1),
  );

  return (
    <div className="space-y-4">
      <ReopenTabHeader
        countLabel={reopenCountLabel(
          listQuery.isPending,
          listQuery.hasNextPage,
          requests.length,
        )}
        filter={filter}
        setFilter={setFilter}
        search={search}
        setSearch={setSearch}
      />

      <div
        ref={resultsRef}
        tabIndex={-1}
        role="region"
        aria-label="Reopen requests"
        className="space-y-4 rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2"
      >
        <ReopenListStatus
          isPending={listQuery.isPending}
          errorMessage={
            listQuery.isError && requests.length === 0
              ? formatClientErrorMessage(
                  "Failed to load requests",
                  listQuery.error,
                )
              : null
          }
          isEmpty={requests.length === 0}
          hasSearch={search.trim().length > 0}
          filter={filter}
          onRetry={() => {
            void listQuery.refetch({ cancelRefetch: false });
          }}
        />

        <ReopenRequestList
          requests={requests}
          respondingId={respondingId}
          note={note}
          isSaving={isSaving}
          pendingDecision={pendingDecision}
          onNoteChange={onNoteChange}
          startRespond={startRespond}
          cancelRespond={cancelRespond}
          respond={respond}
        />
      </div>

      {listQuery.isError && requests.length > 0 ? (
        <ReopenNextPageIssue
          errorMessage={formatClientErrorMessage(
            "Some requests could not be loaded",
            listQuery.error,
          )}
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
        <LoadMoreRequestsButton
          isLoading={listQuery.isFetchingNextPage}
          onLoadMore={() => {
            void listQuery.fetchNextPage({ cancelRefetch: false });
          }}
        />
      ) : null}
    </div>
  );
}

// Loading / load-failure / empty placeholders for the request list. Only one can
// apply at a time, so the first match wins and the list below renders alone.
function ReopenListStatus({
  isPending,
  errorMessage,
  isEmpty,
  hasSearch,
  filter,
  onRetry,
}: {
  readonly isPending: boolean;
  readonly errorMessage: string | null;
  readonly isEmpty: boolean;
  readonly hasSearch: boolean;
  readonly filter: ReopenFilterStatus;
  readonly onRetry: () => void;
}) {
  if (isPending) {
    return (
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-sm text-[var(--color-muted-foreground)]"
        role="status"
        aria-busy="true"
        aria-label="Loading reopen requests"
      >
        Loading…
      </div>
    );
  }
  if (errorMessage !== null) {
    return (
      <div
        role="alert"
        className="rounded-[var(--radius)] border border-[var(--color-destructive)] bg-[var(--color-status-blocked-bg)] p-4 text-sm text-[var(--color-destructive)]"
      >
        <p>{errorMessage}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-[var(--radius-pill)] border border-current px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!isEmpty) return null;
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
      {emptyStateMessage(hasSearch, filter)}
    </div>
  );
}

function emptyStateMessage(
  hasSearch: boolean,
  filter: ReopenFilterStatus,
): string {
  if (hasSearch) return "No requests match the search.";
  return filter === "pending"
    ? "No pending reopen requests."
    : "Nothing here yet.";
}
