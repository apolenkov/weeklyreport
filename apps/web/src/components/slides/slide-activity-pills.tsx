"use client";

import type { SlideActivityPill } from "./section-slide-utils";

const PILL_DOT_CLASS: Record<"green" | "yellow" | "red" | "empty", string> = {
  green: "bg-[var(--color-primary)]",
  yellow: "bg-[var(--color-status-dot-at-risk)]",
  red: "bg-[var(--color-destructive)]",
  empty: "bg-[var(--color-muted-foreground)] opacity-50",
};

/**
 * Minimal activity status-pill lane on a section slide — one neutral pill per
 * attached Project Activity with a traffic-light dot. Display-only, no layout
 * rework: the lane keeps natural height and self-suppresses when the section
 * carries no activities.
 */
export function SlideActivityPills({
  activities,
}: {
  readonly activities: readonly SlideActivityPill[] | undefined;
}) {
  if (!activities || activities.length === 0) return null;

  return (
    <div
      role="list"
      aria-label="Project activities"
      data-testid="slide-activity-pills"
      className="flex shrink-0 flex-wrap items-center gap-1.5"
    >
      {activities.map((activity) => (
        <span
          key={activity.id}
          role="listitem"
          title={activity.name}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.10)] bg-white/70 px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)]"
        >
          <span
            aria-hidden="true"
            className={[
              "inline-block h-2 w-2 shrink-0 rounded-full",
              PILL_DOT_CLASS[activity.status ?? "empty"],
            ].join(" ")}
          />
          <span className="truncate">{activity.name}</span>
        </span>
      ))}
    </div>
  );
}
