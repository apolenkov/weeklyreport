"use client";

import type { CanonicalStatus, TrafficLightStatus } from "@customreport/shared";

import {
  statusDotClassName,
  statusLabel,
} from "../../../shared/lib/status/status-presentation";
import type { SlideActivityPill } from "../model/section-slide-contracts";

type PillStatus = TrafficLightStatus | "empty";

// Worst-first so blocked activities read first on the status slide.
const GROUP_ORDER: readonly PillStatus[] = ["red", "yellow", "green", "empty"];

function toPillStatus(status: SlideActivityPill["status"]): PillStatus {
  return status ?? "empty";
}

function pillToStatus(pill: PillStatus): CanonicalStatus {
  if (pill === "red") return "blocked";
  if (pill === "yellow") return "at-risk";
  if (pill === "green") return "on-track";
  return "empty";
}

function pillLabel(pill: PillStatus): string {
  return statusLabel(pillToStatus(pill), "screen");
}

function ActivityPill({ activity }: { readonly activity: SlideActivityPill }) {
  const status = toPillStatus(activity.status);
  return (
    <span
      role="listitem"
      title={activity.name}
      className="inline-flex min-w-0 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--card-surface-border)] bg-[color-mix(in_srgb,var(--color-card)_70%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)]"
    >
      <span
        aria-hidden="true"
        className={[
          "inline-block h-2 w-2 shrink-0 rounded-full",
          statusDotClassName(pillToStatus(status)),
        ].join(" ")}
      />
      <span className="truncate">{activity.name}</span>
      {activity.linkedProducts.length > 0 && (
        <span className="truncate text-[10px] text-[var(--color-muted-foreground)]">
          {activity.linkedProducts.join(", ")}
        </span>
      )}
      <span className="sr-only">{pillLabel(status)}</span>
    </span>
  );
}

// Worst-first grouping; display-only (no edit affordance on the slide).
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
          aria-label={`${pillLabel(group.status)} activities`}
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
