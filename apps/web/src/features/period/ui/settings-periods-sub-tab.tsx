"use client";

import { useEffect, useState } from "react";

import type { MockSettings } from "../../../shared/lib/admin-mock-data";
import {
  CheckIcon,
  useUpdateSettingsMut,
} from "../../../shared/ui/settings-tab-shared";
import { PeriodBaseFields } from "./settings-periods-fields-base";
import { PeriodCycleFields } from "./settings-periods-fields-cycle";

export function PeriodsSubTab({
  serverSettings,
}: {
  readonly serverSettings: MockSettings;
}) {
  const [draft, setDraft] = useState<MockSettings>(serverSettings);
  useEffect(() => setDraft(serverSettings), [serverSettings]);
  const updateSettingsMut = useUpdateSettingsMut("Period policy");

  function handleSave() {
    // PATCH semantics — only fields owned by this sub-tab go on the wire.
    // `departmentName` is not part of the payload; brand identity lives on the
    // Organization singleton (Identity tab) and is mutated via
    // `admin.updateOrganization`.
    // The period-cycle knobs ride the same PATCH because they live on this
    // Periods sub-tab. Each field below has a live consumer (the period-creator
    // / auto-publisher / auto-archiver schedulers and the request-path
    // late-submission and reopen gates).
    updateSettingsMut.mutate({
      autoCreatePeriods: draft.autoCreatePeriods,
      defaultDeadlineDays: draft.defaultDeadlineDays,
      periodLengthDays: draft.periodLengthDays,
      workingDays: draft.workingDays,
      gracePeriodHours: draft.gracePeriodHours,
      allowLateSubmissions: draft.allowLateSubmissions,
      autoPublishAfterDeadline: draft.autoPublishAfterDeadline,
      autoArchiveWeeksAfterPublish: draft.autoArchiveWeeksAfterPublish,
      deadlineTime: draft.deadlineTime,
      allowReopenAfterPublish: draft.allowReopenAfterPublish,
      reopenWindowHours: draft.reopenWindowHours,
      unifiedActivityView: draft.unifiedActivityView,
    });
  }

  const isSaving = updateSettingsMut.isPending;

  return (
    <div className="max-w-lg space-y-5">
      <PeriodBaseFields draft={draft} setDraft={setDraft} />

      {/* ─────────────────────────────────────────────────────────────
          Period-cycle knobs (deadline-time default + reopen gating). All
          have live consumers; see PeriodCycleFields.
          ───────────────────────────────────────────────────────────── */}
      <PeriodCycleFields draft={draft} setDraft={setDraft} />

      {/* Unified by-state lead-form view — an org-wide presentation flag
          (ADR 0011): the lead form folds Current/Next week into one section
          grouped by derived state. Off = the classic two-section format. */}
      <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)]">
        <input
          name="unified-activity-view"
          type="checkbox"
          checked={draft.unifiedActivityView}
          onChange={(e) =>
            setDraft({ ...draft, unifiedActivityView: e.target.checked })
          }
          className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)]"
        />
        <span>
          <span className="block font-medium">Unified activity view</span>
          <span className="block text-xs text-[var(--color-muted-foreground)]">
            Leads see one section grouped by state (done, in progress, blocked,
            planned next, deferred) instead of the classic Current week / Next
            week split. Display only — stored records are unchanged.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Save period policy"
        >
          {isSaving ? "Saving…" : "Save Period Policy"}
        </button>
        {updateSettingsMut.isSuccess && (
          <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
            <CheckIcon />
            Period policy saved
          </span>
        )}
      </div>
    </div>
  );
}
