"use client";

import type { ReopenDecision } from "../../../shared/ui/reopen-respond-form";
import { TabHeader, TabSearch } from "../../../shared/ui/tab-header";
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
          className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-[12px] font-semibold transition-colors ${
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
  matchCount,
  filter,
  setFilter,
  search,
  setSearch,
}: {
  readonly matchCount: number;
  readonly filter: ReopenFilterStatus;
  readonly setFilter: (next: ReopenFilterStatus) => void;
  readonly search: string;
  readonly setSearch: (next: string) => void;
}) {
  return (
    <TabHeader
      title="Reopen Requests"
      description="Leads ask for permission to edit a submitted section."
      count={`${matchCount} requests`}
      search={
        <TabSearch
          value={search}
          onChange={setSearch}
          placeholder="Search by lead, email, week or note…"
          testId="reopen-search"
        />
      }
      actions={<ReopenFilterBar filter={filter} onChange={setFilter} />}
    />
  );
}

export function ReopenTab() {
  const {
    filter,
    setFilter,
    search,
    setSearch,
    requests,
    filteredRequests,
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

  return (
    <div className="space-y-4">
      <ReopenTabHeader
        matchCount={filteredRequests.length}
        filter={filter}
        setFilter={setFilter}
        search={search}
        setSearch={setSearch}
      />

      <ReopenListStatus
        isPending={listQuery.isPending}
        errorMessage={listQuery.isError ? listQuery.error.message : null}
        isEmpty={filteredRequests.length === 0}
        hasUnfilteredRequests={requests.length > 0}
        filter={filter}
      />

      <ReopenRequestList
        requests={filteredRequests}
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
  );
}

// Loading / load-failure / empty placeholders for the request list. Only one can
// apply at a time, so the first match wins and the list below renders alone.
function ReopenListStatus({
  isPending,
  errorMessage,
  isEmpty,
  hasUnfilteredRequests,
  filter,
}: {
  readonly isPending: boolean;
  readonly errorMessage: string | null;
  readonly isEmpty: boolean;
  readonly hasUnfilteredRequests: boolean;
  readonly filter: ReopenFilterStatus;
}) {
  if (isPending) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-sm text-[var(--color-muted-foreground)]">
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
        Failed to load requests: {errorMessage}
      </div>
    );
  }
  if (!isEmpty) return null;
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
      {emptyStateMessage(hasUnfilteredRequests, filter)}
    </div>
  );
}

function emptyStateMessage(
  hasUnfilteredRequests: boolean,
  filter: ReopenFilterStatus,
): string {
  if (hasUnfilteredRequests) return "No requests match the search.";
  return filter === "pending"
    ? "No pending reopen requests."
    : "Nothing here yet.";
}
