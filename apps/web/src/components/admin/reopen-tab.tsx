"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../lib/trpc-context";
import { ReopenRequestCard } from "./reopen-request-card";
import { TabHeader, TabSearch } from "./tab-header";

type FilterStatus = "pending" | "approved" | "rejected" | "all";

const FILTERS: readonly { value: FilterStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

/**
 * Reopen Requests tab — Head-side queue of lead-initiated reopen asks.
 *
 * Each request shows: who asked, which week+section, when, and the optional
 * reason. Head can Approve (section flips back to draft, lead can edit) or
 * Reject (section stays submitted; head writes a short note explaining why).
 *
 * Pending count is exposed via `admin.pendingReopenCount` so the tab badge
 * stays in sync without polling.
 */
export function ReopenTab() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [search, setSearch] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const listQuery = useQuery(
    trpc.admin.listReopenRequests.queryOptions({ status: filter }),
  );

  const respondMut = useMutation(
    trpc.admin.respondReopenRequest.mutationOptions({
      onSuccess: ({ decision }) => {
        toast.success(
          decision === "approved"
            ? "Request approved; section reopened."
            : "Request rejected.",
        );
        setRespondingId(null);
        setNote("");
        void queryClient.invalidateQueries({
          queryKey: trpc.admin.listReopenRequests.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.admin.pendingReopenCount.queryKey(),
        });
      },
      onError: (err) => {
        toast.error(`Failed to process request: ${err.message}`);
      },
    }),
  );

  const requests = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => {
      const haystack = [
        r.requestedBy.name,
        r.requestedBy.email,
        r.report.weekLabel,
        r.reason,
        r.reviewNote,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [requests, search]);

  return (
    <div className="space-y-4">
      <TabHeader
        title="Reopen Requests"
        description="Leads ask for permission to edit a submitted section."
        count={`${requests.length} requests`}
        search={
          <TabSearch
            value={search}
            onChange={setSearch}
            placeholder="Search by lead, email, week or note…"
            testId="reopen-search"
          />
        }
        actions={
          <div className="flex gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] p-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
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
        }
      />

      {listQuery.isPending && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-sm text-[var(--color-muted-foreground)]">
          Loading…
        </div>
      )}

      {listQuery.isError && (
        <div className="rounded-[var(--radius)] border border-[var(--color-destructive)] bg-red-50 p-4 text-sm text-red-800">
          Failed to load requests: {listQuery.error.message}
        </div>
      )}

      {!listQuery.isPending && !listQuery.isError && requests.length === 0 && (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
          {filter === "pending"
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
            isSaving={respondMut.isPending}
            onStartRespond={() => {
              setRespondingId(r.id);
              setNote("");
            }}
            onCancelRespond={() => {
              setRespondingId(null);
              setNote("");
            }}
            onNoteChange={setNote}
            onReject={() =>
              respondMut.mutate({
                id: r.id,
                decision: "rejected",
                note: note.trim() || undefined,
              })
            }
            onApprove={() =>
              respondMut.mutate({
                id: r.id,
                decision: "approved",
                note: note.trim() || undefined,
              })
            }
          />
        ))}
      </ul>
    </div>
  );
}
