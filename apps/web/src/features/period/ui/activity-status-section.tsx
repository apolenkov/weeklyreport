"use client";

import type { TrafficLightStatus } from "@customreport/shared";
import {
  CANONICAL_STATUS_PRECEDENCE,
  trafficLightToCanonical,
} from "@customreport/shared";
import { useState } from "react";

import type { LeadActivityCard } from "../../report-sections";

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

// green < yellow < red — the risk/blocker floor forbids a manual lower below
// it. The ordering comes from the shared canonical ladder; this is a lookup,
// not a private precedence table.
function trafficRank(status: TrafficLightStatus): number {
  return CANONICAL_STATUS_PRECEDENCE[trafficLightToCanonical(status)];
}

interface ActivityStatusHandlers {
  readonly readOnly: boolean;
  readonly onStatusChange: (
    activityId: string,
    status: TrafficLightStatus,
  ) => void;
  // Unbacked raise (At Risk/Blocked with no covering risk) routes here so the
  // host can open risk creation instead of writing status alone.
  readonly onRaiseRequiresRisk: (
    activityId: string,
    severity: "at-risk" | "blocked",
  ) => void;
}

interface ActivityStatusSectionProps extends ActivityStatusHandlers {
  readonly activities: readonly LeadActivityCard[];
}

interface ActivityCardProps extends ActivityStatusHandlers {
  readonly card: LeadActivityCard;
}

// What a pill click means, given the lead's stored pick and the record-only
// alarm floor. Pure so the pill row stays presentation-only.
type StatusPickOutcome =
  | { readonly kind: "refused" }
  | { readonly kind: "requires-risk"; readonly severity: "at-risk" | "blocked" }
  | { readonly kind: "ignored" }
  | { readonly kind: "write" };

function resolveStatusPick(
  next: TrafficLightStatus,
  stored: TrafficLightStatus,
  floor: TrafficLightStatus | null,
): StatusPickOutcome {
  if (floor != null && trafficRank(next) < trafficRank(floor)) {
    return { kind: "refused" };
  }
  // A raise is never the only record of an alarm: yellow needs any covering
  // risk, red a covering blocker. An unbacked raise routes through risk
  // creation, then lands via the render-time floor once the risk is saved.
  if (next !== "green" && trafficRank(next) > trafficRank(floor ?? "green")) {
    return {
      kind: "requires-risk",
      severity: next === "red" ? "blocked" : "at-risk",
    };
  }
  // A floor ABOVE the stored choice means the pill is showing the floor, not
  // the lead's pick — clicking it must not overwrite the lower stored value,
  // so clearing the covering risk restores it.
  if (
    floor != null &&
    trafficRank(floor) > trafficRank(stored) &&
    trafficRank(next) === trafficRank(floor)
  ) {
    return { kind: "ignored" };
  }
  return { kind: "write" };
}

function StatusPill({
  option,
  isActive,
  disabled,
  onSelect,
}: {
  readonly option: (typeof STATUS_OPTIONS)[number];
  readonly isActive: boolean;
  readonly disabled: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      disabled={disabled}
      onClick={onSelect}
      className={[
        "inline-flex min-h-[var(--touch-target-min)] md:min-h-[34px] items-center gap-1.5 rounded-[var(--radius-pill)] border px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        isActive
          ? "border-[var(--color-primary)] bg-[var(--color-success)] text-[var(--color-primary)]"
          : "border-[var(--card-surface-border)] bg-[color-mix(in_srgb,var(--color-card)_70%,transparent)] text-[var(--color-muted-foreground)] hover:border-[var(--color-border)] hover:bg-[var(--color-card)]",
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
}

function ActivityStatusPills({
  card,
  readOnly,
  onStatusChange,
  onRaiseRequiresRisk,
}: ActivityCardProps) {
  const [refused, setRefused] = useState(false);
  // The enforceable floor is the RECORD-ONLY alarmFloor (covering risks/blockers),
  // NOT derivedStatus — which folds in the lead's own stored choice and would
  // wrongly lock a status the lead raised themselves.
  const floor = card.alarmFloor;
  const stored: TrafficLightStatus = card.status ?? "green";
  // Display the lead's current pick floored by the alarm, computed client-side so
  // the active pill tracks a local pick immediately (no save+refetch needed).
  const displayStatus: TrafficLightStatus =
    floor != null && trafficRank(floor) > trafficRank(stored) ? floor : stored;

  function pick(next: TrafficLightStatus) {
    const outcome = resolveStatusPick(next, stored, floor);
    setRefused(outcome.kind === "refused");
    if (outcome.kind === "requires-risk") {
      onRaiseRequiresRisk(card.activityId, outcome.severity);
      return;
    }
    if (outcome.kind === "write") onStatusChange(card.activityId, next);
  }

  return (
    <div>
      <div
        role="group"
        aria-label={`Status for ${card.activityName}`}
        className="inline-flex items-center gap-1.5"
      >
        {STATUS_OPTIONS.map((option) => (
          <StatusPill
            key={option.value}
            option={option}
            isActive={displayStatus === option.value}
            disabled={readOnly}
            onSelect={() => pick(option.value)}
          />
        ))}
      </div>
      {refused && (
        <p
          role="status"
          // w-0 + min-w-full: the message adopts the pill row's width instead
          // of contributing its own intrinsic width — a long message must
          // never widen this flex cell and shove the pills leftward.
          className="mt-1 w-0 min-w-full text-right text-xs text-[var(--color-destructive)]"
        >
          Resolve the covering risk/blocker first to lower this status.
        </p>
      )}
    </div>
  );
}

// Status-only card; full records live under the activity lane, not here.
function ActivityCard({
  card,
  readOnly,
  onStatusChange,
  onRaiseRequiresRisk,
}: ActivityCardProps) {
  const linkedNames = card.linkedProducts.map((p) => p.productName).join(", ");
  return (
    <li className="rounded-[var(--radius)] border border-[var(--card-surface-border)] bg-[color-mix(in_srgb,var(--color-card)_80%,transparent)] px-4 py-3">
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
          onRaiseRequiresRisk={onRaiseRequiresRisk}
        />
      </div>
    </li>
  );
}

// No add/remove: activity attachment is admin-provisioned.
export function ActivityStatusSection({
  activities,
  readOnly,
  onStatusChange,
  onRaiseRequiresRisk,
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
          onRaiseRequiresRisk={onRaiseRequiresRisk}
        />
      ))}
    </ul>
  );
}
