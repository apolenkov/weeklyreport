"use client";

import { type ProjectActivity, shortName } from "@weeklyreport/shared";

import type { AdminUserView } from "../model/admin-types";
import { useActivityLeads } from "./use-activity-leads";

const HINT_CLASS = "block text-xs text-[var(--color-muted-foreground)]";

interface LeadToggleRowProps {
  readonly lead: AdminUserView;
  readonly activityName: string;
  readonly checked: boolean;
  readonly hint: string | undefined;
  readonly locked: boolean;
  readonly mutating: boolean;
  readonly onToggle: (leadId: string, nextChecked: boolean) => void;
}

function LeadToggleRow({
  lead,
  activityName,
  checked,
  hint,
  locked,
  mutating,
  onToggle,
}: LeadToggleRowProps) {
  const hintId = `activity-lead-hint-${lead.id}`;
  const disabled = mutating || locked;

  return (
    <li>
      <label
        className={[
          "flex items-start gap-2 rounded-sm px-1 py-0.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
        ].join(" ")}
        title={hint}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onToggle(lead.id, e.target.checked)}
          aria-label={`Toggle ${shortName(lead)} on ${activityName}`}
          aria-describedby={hint ? hintId : undefined}
          className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-starbucks-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <span className="min-w-0">
          <span>{shortName(lead)}</span>
          {hint && (
            <span id={hintId} className={HINT_CLASS}>
              {hint}
            </span>
          )}
        </span>
      </label>
    </li>
  );
}

export function ActivityLeadsEditor({
  activity,
  users,
}: {
  readonly activity: ProjectActivity;
  readonly users: readonly AdminUserView[];
}) {
  const state = useActivityLeads({ activity, users });

  return (
    <fieldset
      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3"
      data-testid="activity-leads-editor"
    >
      <legend className="px-1 text-sm font-medium text-[var(--color-foreground)]">
        Leads attached
      </legend>
      <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
        Every attached lead reports their own weekly status on this activity.
        Detaching also clears that lead&apos;s status on open periods. Leads
        outside the activity&apos;s reporting group are locked here.
      </p>
      {state.visibleLeads.length === 0 ? (
        <div className="py-1 text-xs text-[var(--color-muted-foreground)]">
          No active leads yet. Create one in the Users tab first.
        </div>
      ) : (
        <ul
          className="max-h-40 space-y-1 overflow-y-auto pr-1"
          data-testid="activity-leads-list"
        >
          {state.visibleLeads.map((lead) => {
            const attached = state.attachedIds.has(lead.id);
            // A hint explains state but does not lock the row by itself: an
            // attached lead must stay detachable even when deactivated.
            const locked = !attached && state.isOutOfGroup(lead);
            const hint = locked
              ? `Belongs to ${lead.department}`
              : lead.isActive
                ? undefined
                : "Inactive";
            return (
              <LeadToggleRow
                key={lead.id}
                lead={lead}
                activityName={activity.name}
                checked={attached}
                hint={hint}
                locked={locked}
                mutating={state.mutating}
                onToggle={state.toggle}
              />
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
