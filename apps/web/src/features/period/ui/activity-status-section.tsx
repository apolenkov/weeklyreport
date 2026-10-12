"use client";

import type { TrafficLightStatus } from "@weeklyreport/shared";
import {
  CANONICAL_STATUS_PRECEDENCE,
  trafficLightToCanonical,
} from "@weeklyreport/shared";
import { useState } from "react";

import type { LeadActivityCard } from "../../report-sections";

const STATUS_OPTIONS: readonly {
  readonly value: TrafficLightStatus;
  readonly label: string;
  readonly dotClass: string;
}[] = [
  { value: "green", label: "On track", dotClass: "bg-[var(--color-primary)]" },
  {
    value: "yellow",
    label: "At risk",
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
  // Unbacked raise (At risk/Blocked with no covering risk) routes here so the
  // host can open risk creation instead of writing status alone.
  readonly onRaiseRequiresRisk: (
    activityId: string,
    severity: "at-risk" | "blocked",
  ) => void;
  // Weekly title override; null resets to the catalogue name.
  readonly onTitleChange: (
    activityId: string,
    titleOverride: string | null,
  ) => void;
  // Weekly description (the note column).
  readonly onDescriptionChange: (
    activityId: string,
    note: string | null,
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

interface ActivityPillsProps extends ActivityStatusHandlers {
  readonly card: LeadActivityCard;
}

function ActivityStatusPills({
  card,
  readOnly,
  onStatusChange,
  onRaiseRequiresRisk,
}: Pick<
  ActivityPillsProps,
  "card" | "readOnly" | "onStatusChange" | "onRaiseRequiresRisk"
>) {
  // The refusal notice explains the floor observed at pick time. Keeping the
  // observed floor beside it lets an observed floor change invalidate the
  // stored explanation — a stale "resolve the risk" hint must not outlive the
  // risk it referred to, nor return when a floor reappears without a new pick.
  const [refusal, setRefusal] = useState<{
    readonly floor: TrafficLightStatus | null;
    readonly refused: boolean;
  }>({ floor: card.alarmFloor, refused: false });
  // The enforceable floor is the RECORD-ONLY alarmFloor (covering risks/blockers),
  // NOT derivedStatus — which folds in the lead's own stored choice and would
  // wrongly lock a status the lead raised themselves.
  const floor = card.alarmFloor;
  if (refusal.floor !== floor) {
    setRefusal({ floor, refused: false });
  }
  const stored: TrafficLightStatus = card.status ?? "green";
  // Display the lead's current pick floored by the alarm, computed client-side so
  // the active pill tracks a local pick immediately (no save+refetch needed).
  const displayStatus: TrafficLightStatus =
    floor != null && trafficRank(floor) > trafficRank(stored) ? floor : stored;

  function pick(next: TrafficLightStatus) {
    const outcome = resolveStatusPick(next, stored, floor);
    setRefusal({ floor, refused: outcome.kind === "refused" });
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
      {refusal.refused && (
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

// Status-only card plus the weekly title/description overrides; full records
// live under the activity lane, not here.
function ActivityCard({
  card,
  readOnly,
  onStatusChange,
  onRaiseRequiresRisk,
  onTitleChange,
  onDescriptionChange,
}: ActivityCardProps) {
  const linkedNames = card.linkedProducts.map((p) => p.productName).join(", ");
  return (
    <li className="rounded-[var(--radius)] border border-[var(--card-surface-border)] bg-[color-mix(in_srgb,var(--color-card)_80%,transparent)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-[var(--color-foreground)]">
            {card.displayTitle}
          </span>
          {/* Catalogue identity stays visible beside the weekly override. */}
          <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
            Catalogue activity: {card.activityName}
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
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <label className="block text-xs font-medium text-[var(--color-muted-foreground)]">
          Weekly title
          <input
            type="text"
            value={card.titleOverride ?? ""}
            placeholder={card.activityName}
            disabled={readOnly}
            onChange={(event) =>
              onTitleChange(card.activityId, event.target.value)
            }
            data-testid={`activity-title-${card.activityId}`}
            className="mt-1 block w-full rounded-[var(--radius)] border border-[var(--card-surface-border)] bg-[var(--color-card)] px-2 py-1 text-sm text-[var(--color-foreground)] disabled:opacity-60"
          />
        </label>
        <label className="block text-xs font-medium text-[var(--color-muted-foreground)]">
          Description
          <textarea
            value={card.note ?? ""}
            rows={2}
            disabled={readOnly}
            onChange={(event) =>
              onDescriptionChange(card.activityId, event.target.value)
            }
            data-testid={`activity-description-${card.activityId}`}
            className="mt-1 block w-full rounded-[var(--radius)] border border-[var(--card-surface-border)] bg-[var(--color-card)] px-2 py-1 text-sm text-[var(--color-foreground)] disabled:opacity-60"
          />
        </label>
        {card.titleOverride != null ? (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onTitleChange(card.activityId, null)}
            data-testid={`activity-title-reset-${card.activityId}`}
            className="justify-self-start rounded-[var(--radius-pill)] border border-[var(--card-surface-border)] px-3 py-1 text-xs font-semibold text-[var(--color-muted-foreground)] hover:border-[var(--color-border)] hover:bg-[var(--color-card)] disabled:opacity-60"
          >
            Reset to catalogue name
          </button>
        ) : null}
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
  onTitleChange,
  onDescriptionChange,
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
          onTitleChange={onTitleChange}
          onDescriptionChange={onDescriptionChange}
        />
      ))}
    </ul>
  );
}
