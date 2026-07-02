"use client";

import type { SectionActivity } from "@customreport/shared";

type TrafficLightStatus = "green" | "yellow" | "red";

const STATUS_OPTIONS: readonly {
  readonly value: TrafficLightStatus;
  readonly label: string;
  readonly dotClass: string;
}[] = [
  { value: "green", label: "On Track", dotClass: "bg-[var(--color-primary)]" },
  {
    value: "yellow",
    label: "At Risk",
    dotClass: "bg-[var(--color-status-dot-at-risk)]",
  },
  {
    value: "red",
    label: "Blocked",
    dotClass: "bg-[var(--color-destructive)]",
  },
];

interface ActivityStatusSectionProps {
  /** The author's seeded activities — the only rows offered for status entry. */
  readonly activities: readonly SectionActivity[];
  readonly readOnly: boolean;
  readonly onStatusChange: (
    activityId: string,
    status: TrafficLightStatus,
  ) => void;
}

/**
 * Weekly status entry for the lead's attached Project Activities — the
 * stage-less reporting units beside products. One row per seeded activity with
 * a three-state traffic-light picker; there is no add/remove affordance
 * because attachment is admin-provisioned.
 */
export function ActivityStatusSection({
  activities,
  readOnly,
  onStatusChange,
}: ActivityStatusSectionProps) {
  if (activities.length === 0) return null;

  return (
    <ul className="space-y-2" data-testid="activity-status-list">
      {activities.map((activity) => (
        <li
          key={activity.activityId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-white/80 px-4 py-3"
        >
          <span className="min-w-0 truncate text-sm font-medium text-[var(--color-foreground)]">
            {activity.activityName}
          </span>
          <div
            role="group"
            aria-label={`Status for ${activity.activityName}`}
            className="inline-flex items-center gap-1.5"
          >
            {STATUS_OPTIONS.map((option) => {
              const isActive = activity.status === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  disabled={readOnly}
                  onClick={() =>
                    onStatusChange(activity.activityId, option.value)
                  }
                  className={[
                    "inline-flex min-h-[var(--touch-target-min)] md:min-h-[34px] items-center gap-1.5 rounded-[var(--radius-pill)] border px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    isActive
                      ? "border-[var(--color-primary)] bg-[var(--color-success)] text-[var(--color-primary)]"
                      : "border-[rgba(0,0,0,0.10)] bg-white/70 text-[var(--color-muted-foreground)] hover:border-[var(--color-border)] hover:bg-white",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "inline-block h-2 w-2 shrink-0 rounded-full",
                      option.dotClass,
                    ].join(" ")}
                  />
                  {option.label}
                </button>
              );
            })}
          </div>
        </li>
      ))}
    </ul>
  );
}
