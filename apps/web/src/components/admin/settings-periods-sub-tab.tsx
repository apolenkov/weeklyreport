"use client";

import { useEffect, useState } from "react";

import type { MockSettings } from "./mock-data";
import { PeriodBaseFields } from "./settings-periods-fields-base";
import { PeriodCycleFields } from "./settings-periods-fields-cycle";
import { CheckIcon, useUpdateSettingsMut } from "./settings-tab-shared";

export function PeriodsSubTab({
  serverSettings,
}: {
  readonly serverSettings: MockSettings;
}) {
  const [draft, setDraft] = useState<MockSettings>(serverSettings);
  useEffect(() => setDraft(serverSettings), [serverSettings]);
  const updateSettingsMut = useUpdateSettingsMut("Period settings");

  function handleSave() {
    // PATCH semantics — only fields owned by this sub-tab go on the wire.
    // UFB-047 / Phase 49-01: `departmentName` is no longer part of the
    // payload; brand identity lives on the Organization singleton (Identity
    // tab) and is mutated via `admin.updateOrganization`.
    // UFB-051 (Phase 51-A): the 8 new period-cycle knobs are bundled into
    // this same PATCH because they live on the Periods tab. Cron consumers
    // arrive in 51-C; today these only flow through the wire and persist.
    updateSettingsMut.mutate({
      autoCreatePeriods: draft.autoCreatePeriods,
      defaultDeadlineDays: draft.defaultDeadlineDays,
      periodLengthDays: draft.periodLengthDays,
      workingDays: draft.workingDays,
      gracePeriodHours: draft.gracePeriodHours,
      allowLateSubmissions: draft.allowLateSubmissions,
      autoPublishAfterDeadline: draft.autoPublishAfterDeadline,
      autoArchiveWeeksAfterPublish: draft.autoArchiveWeeksAfterPublish,
      firstDayOfWeek: draft.firstDayOfWeek,
      deadlineDayOfWeek: draft.deadlineDayOfWeek,
      deadlineTime: draft.deadlineTime,
      maxOpenPeriods: draft.maxOpenPeriods,
      requireAllSectionsToPublish: draft.requireAllSectionsToPublish,
      allowReopenAfterPublish: draft.allowReopenAfterPublish,
      reopenWindowHours: draft.reopenWindowHours,
    });
  }

  const isSaving = updateSettingsMut.isPending;

  return (
    <div className="max-w-lg space-y-5">
      {/* UFB-047 / Phase 49-01: legacy `departmentName` deprecation banner
          + input removed alongside the AppSettings column. Brand identity
          (short + full name) is owned by the Identity tab. */}

      <PeriodBaseFields draft={draft} setDraft={setDraft} />

      {/* ─────────────────────────────────────────────────────────────
          UFB-051 (Phase 51-A) — Period-cycle knobs.

          These inputs persist the new AppSettings columns landed in
          migration 20260510215245_period_model_expansion. Consumers
          (PeriodCreator cadence-aware step, publish/reopen gating)
          ship in Phase 51-C — today the values only round-trip.
          ───────────────────────────────────────────────────────────── */}
      <PeriodCycleFields draft={draft} setDraft={setDraft} />

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Save period settings"
        >
          {isSaving ? "Saving…" : "Save Period Settings"}
        </button>
        {updateSettingsMut.isSuccess && (
          <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
            <CheckIcon />
            Period settings saved
          </span>
        )}
      </div>
    </div>
  );
}
