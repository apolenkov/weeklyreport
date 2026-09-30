"use client";

import {
  ACTIVITY_BUCKET_LABELS,
  ACTIVITY_BUCKET_ORDER,
  type ActivityBucket,
} from "../../model/activity/activity-buckets";
import type { UnifiedActivityEntry } from "../../model/activity/unified-activity-entry";
import type { RiskEntry } from "../../model/types";
import { ItemCard } from "../item-card";

interface BucketCardProps {
  readonly risks?: readonly RiskEntry[] | undefined;
  readonly readOnly: boolean;
  readonly publishedLockedIds?: ReadonlySet<string> | undefined;
  readonly onEdit: (entry: UnifiedActivityEntry) => void;
  readonly onDelete: (entry: UnifiedActivityEntry) => void;
  readonly onMarkComplete?: ((id: string) => void) | undefined;
  readonly onMoveToNextWeek?: ((id: string) => void) | undefined;
}

export function EmptyActivityPlaceholder({
  readOnly = false,
}: {
  readonly readOnly?: boolean;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-empty)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
      {readOnly
        ? "No activity items in this report."
        : "No items yet — use the + Add button to create one."}
    </div>
  );
}

function BucketHeading({
  bucket,
  count,
}: {
  readonly bucket: ActivityBucket;
  readonly count: number;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span
        data-testid={`bucket-label-${bucket}`}
        className="font-[family-name:var(--font-sans)] text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]"
      >
        {ACTIVITY_BUCKET_LABELS[bucket]}
      </span>
      <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--color-muted-foreground)]">
        {count}
      </span>
    </div>
  );
}

// Lifecycle shortcuts only make sense on unfinished current-week work.
function hasLifecycleShortcuts(entry: UnifiedActivityEntry): boolean {
  return entry.week === "current" && entry.bucket !== "done";
}

function ActivityBucketGroup({
  bucket,
  entries,
  risks,
  readOnly,
  publishedLockedIds,
  onEdit,
  onDelete,
  onMarkComplete,
  onMoveToNextWeek,
}: BucketCardProps & {
  readonly bucket: ActivityBucket;
  readonly entries: readonly UnifiedActivityEntry[];
}) {
  return (
    <div>
      <BucketHeading bucket={bucket} count={entries.length} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => (
          <ItemCard
            key={`${entry.week}-${entry.item.id}`}
            item={entry.item}
            risks={risks}
            readOnly={readOnly}
            publishedLocked={publishedLockedIds?.has(entry.item.id)}
            onEdit={() => onEdit(entry)}
            onDelete={() => onDelete(entry)}
            onMarkComplete={
              hasLifecycleShortcuts(entry) ? onMarkComplete : undefined
            }
            onMoveToNextWeek={
              hasLifecycleShortcuts(entry) ? onMoveToNextWeek : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

function groupByBucket(
  entries: readonly UnifiedActivityEntry[],
): { bucket: ActivityBucket; entries: UnifiedActivityEntry[] }[] {
  return ACTIVITY_BUCKET_ORDER.map((bucket) => ({
    bucket,
    entries: entries.filter((entry) => entry.bucket === bucket),
  })).filter((group) => group.entries.length > 0);
}

export function ActivityBucketList({
  entries,
  risks,
  readOnly,
  publishedLockedIds,
  onEdit,
  onDelete,
  onMarkComplete,
  onMoveToNextWeek,
}: BucketCardProps & {
  readonly entries: readonly UnifiedActivityEntry[];
}) {
  return (
    <>
      {groupByBucket(entries).map((group) => (
        <ActivityBucketGroup
          key={group.bucket}
          bucket={group.bucket}
          entries={group.entries}
          risks={risks}
          readOnly={readOnly}
          publishedLockedIds={publishedLockedIds}
          onEdit={onEdit}
          onDelete={onDelete}
          onMarkComplete={onMarkComplete}
          onMoveToNextWeek={onMoveToNextWeek}
        />
      ))}
    </>
  );
}
