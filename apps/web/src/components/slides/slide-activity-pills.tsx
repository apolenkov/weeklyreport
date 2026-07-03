"use client";

import type { SlideActivityPill } from "./section-slide-utils";

type PillStatus = "green" | "yellow" | "red" | "empty";

const PILL_DOT_CLASS: Record<PillStatus, string> = {
  green: "bg-[var(--color-primary)]",
  yellow: "bg-[var(--color-status-dot-at-risk)]",
  red: "bg-[var(--color-destructive)]",
  empty: "bg-[var(--color-muted-foreground)] opacity-50",
};

const PILL_STATUS_LABEL: Record<PillStatus, string> = {
  green: "On track",
  yellow: "At risk",
  red: "Blocked",
  empty: "No status",
};

// Worst-first so blocked activities read first on the status slide.
const GROUP_ORDER: readonly PillStatus[] = ["red", "yellow", "green", "empty"];

function toPillStatus(status: SlideActivityPill["status"]): PillStatus {
  return status ?? "empty";
}

function ActivityPill({ activity }: { readonly activity: SlideActivityPill }) {
  const status = toPillStatus(activity.status);
  return (
    <span
      role="listitem"
      title={activity.name}
      className="inline-flex min-w-0 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.10)] bg-white/70 px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)]"
    >
      <span
        aria-hidden="true"
        className={[
          "inline-block h-2 w-2 shrink-0 rounded-full",
          PILL_DOT_CLASS[status],
        ].join(" ")}
      />
      <span className="truncate">{activity.name}</span>
      {activity.linkedProducts.length > 0 && (
        <span className="truncate text-[10px] text-[var(--color-muted-foreground)]">
          {activity.linkedProducts.join(", ")}
        </span>
      )}
      <span className="sr-only">{PILL_STATUS_LABEL[status]}</span>
    </span>
  );
}

/**
 * Activity status-pill lane on a section slide — one neutral pill per attached
 * Project Activity, grouped by traffic-light status (worst first) with the
 * risk/blocker-floored dot, linked product names, and an sr-only status label.
 * Display-only; self-suppresses when the section carries no activities.
 */
export function SlideActivityPills({
  activities,
}: {
  readonly activities: readonly SlideActivityPill[] | undefined;
}) {
  if (!activities || activities.length === 0) return null;

  const groups = GROUP_ORDER.map((status) => ({
    status,
    pills: activities.filter((a) => toPillStatus(a.status) === status),
  })).filter((group) => group.pills.length > 0);

  return (
    // A group of per-status lists. Each status cluster is its own `role="list"`
    // so its `role="listitem"` pills stay direct children of a list (a single
    // outer list wrapping the status <div>s trips aria-required-children).
    <div
      role="group"
      aria-label="Project activities"
      data-testid="slide-activity-pills"
      className="flex shrink-0 flex-wrap items-center gap-2"
    >
      {groups.map((group) => (
        <div
          key={group.status}
          role="list"
          aria-label={`${PILL_STATUS_LABEL[group.status]} activities`}
          data-testid={`slide-activity-group-${group.status}`}
          className="flex flex-wrap items-center gap-1.5"
        >
          {group.pills.map((activity) => (
            <ActivityPill key={activity.id} activity={activity} />
          ))}
        </div>
      ))}
    </div>
  );
}
