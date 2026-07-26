"use client";

import type { MockReminder, MockReminderPolicy } from "../model/admin-types";
import {
  describeRecipient,
  formatPolicyTiming,
  nextSendDate,
} from "../model/reminders-tab-format";

interface PolicyRowProps {
  readonly policy: MockReminderPolicy;
  /** Derived rules for this policy — used only to compute the next-send line. */
  readonly derivedRules: readonly MockReminder[];
  /** True only while THIS reminder's own save/remove is in flight. */
  readonly isBusy: boolean;
  /** Injected so the next-send line is deterministic in tests. */
  readonly now: Date;
  readonly onToggleActive: () => void;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
}

const ACTION_BASE =
  "btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border bg-white px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const EDIT_ACTION_CLASS = `${ACTION_BASE} border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-surface-empty)]`;

const REMOVE_ACTION_CLASS = `${ACTION_BASE} border-transparent text-[var(--color-destructive)] hover:border-[rgba(200,32,20,0.3)] hover:bg-red-50`;

function PolicyToggle({
  policy,
  timing,
  isBusy,
  onToggleActive,
}: {
  readonly policy: MockReminderPolicy;
  readonly timing: string;
  readonly isBusy: boolean;
  readonly onToggleActive: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={policy.active}
      // Stable per-reminder name — on/off state is carried by aria-checked,
      // and the timing phrase disambiguates this row from the others.
      aria-label={`Reminder active: ${timing}`}
      data-testid={`toggle-${policy.id}`}
      disabled={isBusy}
      onClick={onToggleActive}
      className="btn-press mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        backgroundColor: policy.active
          ? "var(--color-success)"
          : "var(--color-muted)",
      }}
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
        style={{
          transform: policy.active ? "translateX(16px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

function PolicySummary({
  policy,
  timing,
  headingId,
  nextSendLine,
}: {
  readonly policy: MockReminderPolicy;
  readonly timing: string;
  readonly headingId: string;
  readonly nextSendLine: string;
}) {
  return (
    <div className="min-w-0">
      <h3
        id={headingId}
        className="text-base font-semibold leading-6 text-[var(--color-foreground)]"
      >
        {timing}
      </h3>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {describeRecipient(policy.audience)}
      </p>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        {nextSendLine}
      </p>
    </div>
  );
}

function PolicyActions({
  policyId,
  timing,
  isBusy,
  onEdit,
  onRemove,
}: {
  readonly policyId: string;
  readonly timing: string;
  readonly isBusy: boolean;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
      <button
        type="button"
        onClick={onEdit}
        disabled={isBusy}
        aria-label={`Edit reminder: ${timing}`}
        data-testid={`edit-${policyId}`}
        className={EDIT_ACTION_CLASS}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={isBusy}
        aria-label={`Remove reminder: ${timing}`}
        data-testid={`remove-${policyId}`}
        className={REMOVE_ACTION_CLASS}
      >
        Remove
      </button>
    </div>
  );
}

export function PolicyRow({
  policy,
  derivedRules,
  isBusy,
  now,
  onToggleActive,
  onEdit,
  onRemove,
}: PolicyRowProps) {
  const timing = formatPolicyTiming(policy);
  const next = policy.active ? nextSendDate(derivedRules, now) : null;
  const nextSendLine = next
    ? `Next send: ${next}, then every period`
    : "No upcoming sends";

  return (
    <div
      data-testid={`policy-row-${policy.id}`}
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <PolicyToggle
            policy={policy}
            timing={timing}
            isBusy={isBusy}
            onToggleActive={onToggleActive}
          />
          <PolicySummary
            policy={policy}
            timing={timing}
            headingId={`reminder-${policy.id}-heading`}
            nextSendLine={nextSendLine}
          />
        </div>

        <PolicyActions
          policyId={policy.id}
          timing={timing}
          isBusy={isBusy}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}
