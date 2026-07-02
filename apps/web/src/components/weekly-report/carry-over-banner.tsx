"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateDashboard, invalidateLeadForm } from "../../lib/cache-keys";
import { useTRPC } from "../../lib/trpc-context";

interface CarryOverBannerProps {
  /** The newly opened period the head is looking at (carry-over target). */
  readonly reportId: string;
}

/**
 * Head-only signal on an OPEN period: the prior period's open records (next
 * week items, unresolved decisions) that have not been carried forward, with
 * the one-click "Copy forward unfinished" that runs the EXISTING
 * `carryOver.execute`. Nothing is automatic — carry-over stays a conscious
 * head action; the banner self-suppresses when there is nothing uncarried.
 * The parent mounts this only for head/admin on `periodStatus === "open"`.
 */
export function CarryOverBanner({ reportId }: CarryOverBannerProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const uncarriedQ = useQuery(
    trpc.carryOver.uncarried.queryOptions({ targetReportId: reportId }),
  );

  const executeMut = useMutation(
    trpc.carryOver.execute.mutationOptions({
      onSuccess: (result) => {
        void qc.invalidateQueries(trpc.carryOver.uncarried.pathFilter());
        invalidateDashboard(qc, trpc);
        invalidateLeadForm(qc, trpc);
        // `execute` is one-shot per (source, target): a second run — or one
        // with nothing eligible — writes no records and returns the prior
        // execution. Report what actually moved, never a blanket success.
        if (result.records.length === 0) {
          toast.info("Nothing new to copy forward");
        } else {
          toast.success("Unfinished work copied forward");
        }
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to copy work forward",
        );
      },
    }),
  );

  const data = uncarriedQ.data;
  if (!data || data.sourceReportId === null) return null;
  const itemCount = data.items.length;
  const decisionCount = data.decisions.length;
  if (itemCount === 0 && decisionCount === 0) return null;

  const summary = [
    itemCount > 0
      ? `${itemCount} planned item${itemCount === 1 ? "" : "s"}`
      : null,
    decisionCount > 0
      ? `${decisionCount} pending decision${decisionCount === 1 ? "" : "s"}`
      : null,
  ]
    .filter((part) => part !== null)
    .join(" and ");

  return (
    <div
      data-testid="carry-over-banner"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-success)] p-4"
    >
      <span className="text-sm text-[var(--color-primary)]">
        {summary} from the previous period{" "}
        {itemCount + decisionCount === 1 ? "has" : "have"} not been copied into
        this period.
      </span>
      <button
        type="button"
        className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => {
          if (data.sourceReportId === null) return;
          executeMut.mutate({
            sourceReportId: data.sourceReportId,
            targetReportId: reportId,
          });
        }}
        disabled={executeMut.isPending}
      >
        {executeMut.isPending ? "Copying…" : "Copy forward unfinished"}
      </button>
    </div>
  );
}
