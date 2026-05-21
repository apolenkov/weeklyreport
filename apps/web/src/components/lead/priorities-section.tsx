"use client";

import { MetaRow } from "../report-shell/meta-row";
import type { PriorityEntry } from "./mock-data";
import { splitStageNames } from "./stage-tags";

type PrioritiesSectionProps = {
  readonly priorities: PriorityEntry[];
  readonly sectionAuthorName?: string;
};

const RANK_TINT: Record<1 | 2 | 3 | "rest", string> = {
  1: "#cba258",
  2: "#dfc49d",
  3: "var(--color-muted)",
  rest: "var(--color-muted)",
};

const RANK_TEXT: Record<1 | 2 | 3 | "rest", string> = {
  1: "#fff",
  2: "#8a6d1b",
  3: "var(--color-muted-foreground)",
  rest: "var(--color-muted-foreground)",
};

/**
 * Read-only derived view: renders items with priorityRank != null, grouped by
 * product and sorted by rank. Priorities are now attributes of action items —
 * see Item.priorityRank in the Prisma schema.
 */
export function PrioritiesSection({
  priorities,
  sectionAuthorName,
}: PrioritiesSectionProps) {
  const sorted = [...priorities].sort((a, b) => a.rank - b.rank);

  const productGroups = new Map<string, PriorityEntry[]>();
  for (const entry of sorted) {
    const key = entry.productName ?? "(no product)";
    let bucket = productGroups.get(key);
    if (!bucket) {
      bucket = [];
      productGroups.set(key, bucket);
    }
    bucket.push(entry);
  }
  const sortedGroupKeys = [...productGroups.keys()].sort((a, b) =>
    a.localeCompare(b),
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
        No priorities reported.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedGroupKeys.map((productName, groupIdx) => {
        const group = productGroups.get(productName) ?? [];
        return (
          <div key={productName}>
            <h3
              className={`mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]${groupIdx > 0 ? " mt-4" : ""}`}
            >
              {productName === "(no product)" ? "Unassigned" : productName}
            </h3>
            <div className="space-y-3">
              {group.map((entry) => {
                const tintKey =
                  entry.rank === 1 || entry.rank === 2 || entry.rank === 3
                    ? entry.rank
                    : "rest";
                const stageTags =
                  entry.stageIds && entry.stageIds.length > 0
                    ? entry.stageIds
                    : splitStageNames(entry.stageName);
                return (
                  <div
                    key={
                      entry.foreign
                        ? `foreign:${entry.authorId ?? ""}:${entry.rank}`
                        : `own:${entry.rank}`
                    }
                    data-testid="priority-row"
                    className="rounded-lg p-4"
                    style={{
                      background: entry.rank <= 2 ? "#faf6ee" : "#f4f1eb",
                      opacity: entry.foreign ? 0.7 : 1,
                    }}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {entry.foreign ? (
                        <span
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)]"
                          aria-label="Foreign priority — authored by another lead"
                        />
                      ) : (
                        <span
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-sans)] text-sm font-bold tabular-nums"
                          style={{
                            background: RANK_TINT[tintKey],
                            color: RANK_TEXT[tintKey],
                          }}
                        >
                          {entry.rank}
                        </span>
                      )}
                    </div>
                    <div className="rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-3">
                      <div className="space-y-1.5">
                        {entry.text.trim().length > 0 ? (
                          <span className="block break-words text-sm text-[var(--color-foreground)]">
                            {entry.text}
                          </span>
                        ) : (
                          <span className="block text-sm text-[var(--color-muted-foreground)]">
                            — pending
                          </span>
                        )}
                        <MetaRow
                          authorName={entry.authorName ?? sectionAuthorName}
                          stageTags={stageTags}
                          ariaLabel={`Priority ${entry.rank} stages: ${stageTags.length === 0 ? "all stages" : stageTags.join(", ")}`}
                          className="pt-1"
                          foreign={entry.foreign === true}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
