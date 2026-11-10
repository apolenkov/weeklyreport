"use client";

import { useState } from "react";

import { joinPeriodLabel } from "../../../../shared/lib/format/format-date";
import { countLabel } from "../../../../shared/lib/format/pluralize";
import type { HistoryEntry } from "../../../report-sections";
import {
  RetainedDraftsDialog,
  type RetainedDraftsSource,
} from "./retained-drafts-dialog";

// Under the card, never inside its link: what the author's own section still
// keeps unfinished, or, once those drafts are gone, what the publication left
// out. The two are different facts and are never derived from each other.
export function UnfinishedDraftsRow({
  entry,
  onView,
}: {
  readonly entry: HistoryEntry;
  readonly onView: (source: RetainedDraftsSource) => void;
}) {
  const periodLabel = joinPeriodLabel(entry.weekLabel, entry.dateRange);
  if (entry.retainedDrafts) {
    const kept = entry.retainedDrafts.risks + entry.retainedDrafts.decisions;
    return (
      <button
        type="button"
        className="mt-1.5 inline-flex min-h-[var(--touch-target-min)] items-center gap-1.5 self-start rounded-[var(--radius-pill)] px-2 text-[13px] font-semibold text-[var(--color-starbucks-accent)] underline-offset-2 hover:underline sm:min-h-8"
        aria-label={`View ${countLabel(kept, "unfinished draft", "unfinished drafts")} kept in ${periodLabel}`}
        onClick={() =>
          onView({
            reportId: entry.periodId,
            reportSectionId: entry.id,
            periodLabel,
          })
        }
      >
        {countLabel(kept, "unfinished draft", "unfinished drafts")} kept · View
      </button>
    );
  }
  const omitted =
    (entry.publishedOmissions?.risks ?? 0) +
    (entry.publishedOmissions?.decisions ?? 0);
  if (omitted === 0) return null;
  return (
    <p className="mt-1.5 px-2 text-[13px] text-[var(--color-muted-foreground)]">
      Published without{" "}
      {countLabel(omitted, "unfinished record", "unfinished records")}; the{" "}
      {omitted === 1 ? "draft is" : "drafts are"} no longer available.
    </p>
  );
}

// Owns which source's kept drafts are open; the dialog mounts, and reads, only
// after the author asks for it.
export function RetainedDraftsHost({
  children,
}: {
  readonly children: (
    onView: (source: RetainedDraftsSource) => void,
  ) => React.ReactNode;
}) {
  const [source, setSource] = useState<RetainedDraftsSource | null>(null);
  return (
    <>
      {children(setSource)}
      {source && (
        <RetainedDraftsDialog source={source} onClose={() => setSource(null)} />
      )}
    </>
  );
}
