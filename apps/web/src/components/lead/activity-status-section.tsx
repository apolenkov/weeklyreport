"use client";

import { useState } from "react";

import type { LeadActivityCard } from "../../lib/mappers/lead-form";

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
  { value: "red", label: "Blocked", dotClass: "bg-[var(--color-destructive)]" },
];

// green < yellow < red — the risk/blocker floor forbids a manual lower below it.
const SEVERITY_RANK: Record<TrafficLightStatus, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

interface ActivityStatusSectionProps {
  /** The author's attached activities as full record cards. */
  readonly activities: readonly LeadActivityCard[];
  readonly readOnly: boolean;
  readonly onStatusChange: (
    activityId: string,
    status: TrafficLightStatus,
  ) => void;
}

/**
 * The activity's traffic-light pill row. Renders the FLOORED value
 * (`derivedStatus ?? status`) and refuses a manual pick below the floor — the
 * pill analogue of the stage-chip click interception (Decision 5). The stored
 * status is preserved, so clearing the covering risk restores the lead's choice.
 */
function ActivityStatusPills({
  card,
  readOnly,
  onStatusChange,
}: {
  readonly card: LeadActivityCard;
  readonly readOnly: boolean;
  readonly onStatusChange: (
    activityId: string,
    status: TrafficLightStatus,
  ) => void;
}) {
  const [refused, setRefused] = useState(false);
  // The enforceable floor is the RECORD-ONLY alarmFloor (covering risks/blockers),
  // NOT derivedStatus — which folds in the lead's own stored choice and would
  // wrongly lock a status the lead raised themselves (Decision 5).
  const floor = card.alarmFloor;
  const stored: TrafficLightStatus = card.status ?? "green";
  // Display the lead's current pick floored by the alarm, computed client-side so
  // the active pill tracks a local pick immediately (no save+refetch needed).
  const displayStatus: TrafficLightStatus =
    floor != null && SEVERITY_RANK[floor] > SEVERITY_RANK[stored]
      ? floor
      : stored;

  function pick(next: TrafficLightStatus) {
    if (floor != null && SEVERITY_RANK[next] < SEVERITY_RANK[floor]) {
      setRefused(true);
      return;
    }
    setRefused(false);
    // When the alarm floor sits ABOVE the lead's stored choice the pill is showing
    // the floor, not their pick — clicking it must NOT overwrite the lower stored
    // value, so clearing the covering risk restores it (Decision 5). When stored
    // is at/above the floor, a pick is a genuine change and writes through.
    if (
      floor != null &&
      SEVERITY_RANK[floor] > SEVERITY_RANK[stored] &&
      SEVERITY_RANK[next] === SEVERITY_RANK[floor]
    ) {
      return;
    }
    onStatusChange(card.activityId, next);
  }

  return (
    <div>
      <div
        role="group"
        aria-label={`Status for ${card.activityName}`}
        className="inline-flex items-center gap-1.5"
      >
        {STATUS_OPTIONS.map((option) => {
          const isActive = displayStatus === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              disabled={readOnly}
              onClick={() => pick(option.value)}
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
      {refused && (
        <p
          role="status"
          className="mt-1 text-xs text-[var(--color-destructive)]"
        >
          Resolve the covering risk/blocker first to lower this status.
        </p>
      )}
    </div>
  );
}

/** One attached activity as a status-only card: name, linked products, pill.
 * Records live in the main Current/Next/Risks/Decisions sections under the
 * activity's lane, never here. */
function ActivityCard({
  card,
  readOnly,
  onStatusChange,
}: {
  readonly card: LeadActivityCard;
  readonly readOnly: boolean;
  readonly onStatusChange: (
    activityId: string,
    status: TrafficLightStatus,
  ) => void;
}) {
  const linkedNames = card.linkedProducts.map((p) => p.productName).join(", ");
  return (
    <li className="rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-white/80 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-[var(--color-foreground)]">
            {card.activityName}
          </span>
          {linkedNames ? (
            <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
              Products: {linkedNames}
            </span>
          ) : null}
        </div>
        <ActivityStatusPills
          card={card}
          readOnly={readOnly}
          onStatusChange={onStatusChange}
        />
      </div>
    </li>
  );
}

/**
 * Weekly reporting for the lead's attached Project Activities — the stage-less
 * reporting units beside products. Each activity is a full card: its own
 * records/risks/blockers, linked products, and a risk/blocker-floored status
 * pill. No add/remove affordance because attachment is admin-provisioned.
 */
export function ActivityStatusSection({
  activities,
  readOnly,
  onStatusChange,
}: ActivityStatusSectionProps) {
  if (activities.length === 0) return null;

  return (
    <ul className="space-y-3" data-testid="activity-status-list">
      {activities.map((card) => (
        <ActivityCard
          key={card.activityId}
          card={card}
          readOnly={readOnly}
          onStatusChange={onStatusChange}
        />
      ))}
    </ul>
  );
}
