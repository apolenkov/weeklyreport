"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  formatPeriodRangeWithYear,
  joinPeriodLabel,
} from "../../../lib/format-date";
import { useTRPC } from "../../../lib/trpc-context";

/**
 * reopen-request-lifecycle (D2): a head-dashboard queue of pending reopen
 * requests with inline Approve / Reject + optional note. It reads the SAME
 * data as the admin Reopen Requests tab (`listReopenRequests` with the pending
 * filter) and, on a decision, invalidates BOTH the list and the pending count
 * so the dashboard, the AlertBar indicator, and the admin tab never diverge.
 *
 * Intentionally lighter than the admin tab: it shows only pending requests (a
 * queue, not an archive). Heads who want history use the admin panel.
 *
 * Anchored by `id` so the AlertBar reopen indicator can scroll to it.
 */
const REOPEN_REQUESTS_CARD_ID = "reopen-requests-card";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReopenRequestsCard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const listQuery = useQuery(
    trpc.admin.listReopenRequests.queryOptions({ status: "pending" }),
  );

  const respondMut = useMutation(
    trpc.admin.respondReopenRequest.mutationOptions({
      onSuccess: (result) => {
        setRespondingId(null);
        setNote("");
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
      // Invalidate on settled (success OR error) so a stale/race outcome still
      // drops the now-terminal row from the queue and refreshes the count.
      onSettled: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.admin.listReopenRequests.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.admin.pendingReopenCount.queryKey(),
        });
      },
    }),
  );

  const requests = listQuery.data ?? [];

  // The card is a queue: render nothing when there is nothing to decide.
  if (listQuery.isPending || listQuery.isError || requests.length === 0) {
    return null;
  }

  return (
    <section
      id={REOPEN_REQUESTS_CARD_ID}
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
      aria-label="Pending reopen requests"
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]">
          Reopen Requests
        </h2>
        <span className="rounded-[var(--radius-pill)] bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
          {requests.length} pending
        </span>
      </header>

      <ul className="space-y-3">
        {requests.map((r) => {
          const isResponding = respondingId === r.id;
          return (
            <li
              key={r.id}
              className="rounded-[var(--radius)] border border-[var(--color-border)] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--color-foreground)]">
                      {r.requestedBy.name}
                    </span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {joinPeriodLabel(
                        r.report.weekLabel,
                        formatPeriodRangeWithYear(
                          r.report.periodStart,
                          r.report.periodEnd,
                        ),
                      )}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    Requested {formatTimestamp(r.createdAt)}
                  </div>
                </div>
                {!isResponding && (
                  <button
                    type="button"
                    onClick={() => {
                      setRespondingId(r.id);
                      setNote("");
                    }}
                    className="btn-press inline-flex items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]"
                  >
                    Respond
                  </button>
                )}
              </div>

              {r.reason && (
                <div className="mt-2 rounded-[var(--radius)] bg-[var(--color-surface-hover)] p-2 text-sm text-[var(--color-foreground)]">
                  <span className="whitespace-pre-wrap">{r.reason}</span>
                </div>
              )}

              {isResponding && (
                <div className="mt-3 space-y-2 rounded-[var(--radius)] border border-[var(--color-starbucks-accent)] bg-[rgba(0,117,74,0.04)] p-3">
                  <label
                    htmlFor={`reopen-card-note-${r.id}`}
                    className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]"
                  >
                    Comment (optional, up to 500 characters)
                  </label>
                  <textarea
                    id={`reopen-card-note-${r.id}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    placeholder="Example: approved, please update the carry-over."
                    className="w-full resize-y rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:border-[var(--color-starbucks-accent)] focus:outline-none"
                    style={{ minHeight: "60px" }}
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRespondingId(null);
                        setNote("");
                      }}
                      disabled={respondMut.isPending}
                      className="btn-press inline-flex items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        respondMut.mutate({
                          id: r.id,
                          decision: "rejected",
                          note: note.trim() || undefined,
                        })
                      }
                      disabled={respondMut.isPending}
                      className="btn-press inline-flex items-center rounded-[var(--radius-pill)] bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        respondMut.mutate({
                          id: r.id,
                          decision: "approved",
                          note: note.trim() || undefined,
                        })
                      }
                      disabled={respondMut.isPending}
                      className="btn-press inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary)] disabled:opacity-50"
                    >
                      {respondMut.isPending ? "Saving…" : "Approve"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
