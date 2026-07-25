"use client";

import { TabHeader, TabSearch } from "../../../shared/ui/tab-header";
import { ReopenRequestCard } from "./reopen-request-card";
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
              ? "bg-[var(--color-starbucks-accent)] text-white"
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
    onNoteChange,
    isSaving,
    startRespond,
    cancelRespond,
    respond,
  } = useReopenTabState();

  return (
    <div className="space-y-4">
      <TabHeader
        title="Reopen Requests"
        description="Leads ask for permission to edit a submitted section."
        count={`${filteredRequests.length} requests`}
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

      {listQuery.isPending && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-sm text-[var(--color-muted-foreground)]">
          Loading…
        </div>
      )}

      {listQuery.isError && (
        <div
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--color-destructive)] bg-red-50 p-4 text-sm text-red-800"
        >
          Failed to load requests: {listQuery.error.message}
        </div>
      )}

      {!listQuery.isPending &&
        !listQuery.isError &&
        filteredRequests.length === 0 && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
            {requests.length > 0
              ? "No requests match the search."
              : filter === "pending"
                ? "No pending reopen requests."
                : "Nothing here yet."}
          </div>
        )}

      <ul className="space-y-3">
        {filteredRequests.map((r) => (
          <ReopenRequestCard
            key={r.id}
            request={r}
            isResponding={respondingId === r.id}
            note={note}
            isSaving={isSaving}
            onStartRespond={() => startRespond(r.id)}
            onCancelRespond={cancelRespond}
            onNoteChange={onNoteChange}
            onReject={() => respond(r.id, "rejected")}
            onApprove={() => respond(r.id, "approved")}
          />
        ))}
      </ul>
    </div>
  );
}
