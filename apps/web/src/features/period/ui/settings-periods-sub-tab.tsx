"use client";

import {
  CheckIcon,
  useUpdateSettingsMut,
} from "../../../shared/ui/settings-tab-shared";
import { useServerSeededDraft } from "../../../shared/ui/use-server-seeded-draft";
import type { MockSettings } from "../../admin";
import { PeriodBaseFields } from "./settings-periods-fields-base";
import { PeriodCycleFields } from "./settings-periods-fields-cycle";

function UnifiedActivityViewToggle({
  checked,
  onCheckedChange,
}: {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)]">
      <input
        name="unified-activity-view"
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
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
  );
}

function SavePeriodPolicyRow({
  isSaving,
  isSaved,
  onSave,
}: {
  readonly isSaving: boolean;
  readonly isSaved: boolean;
  readonly onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Save period policy"
      >
        {isSaving ? "Saving…" : "Save Period Policy"}
      </button>
      {isSaved && (
        <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
          <CheckIcon />
          Period policy saved
        </span>
      )}
    </div>
  );
}

export function PeriodsSubTab({
  serverSettings,
}: {
  readonly serverSettings: MockSettings;
}) {
  const { draft, setDraft, markClean } =
    useServerSeededDraft<MockSettings>(serverSettings);
  const updateSettingsMut = useUpdateSettingsMut("Period policy");

  function handleSave() {
    // PATCH — only this sub-tab's fields. Brand identity lives on Organization.
    updateSettingsMut.mutate(
      {
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
      },
      { onSuccess: () => markClean() },
    );
  }

  const isSaving = updateSettingsMut.isPending;

  return (
    <div className="max-w-lg space-y-5">
      <PeriodBaseFields draft={draft} setDraft={setDraft} />

      <PeriodCycleFields draft={draft} setDraft={setDraft} />

      <UnifiedActivityViewToggle
        checked={draft.unifiedActivityView}
        onCheckedChange={(checked) =>
          setDraft({ ...draft, unifiedActivityView: checked })
        }
      />

      <SavePeriodPolicyRow
        isSaving={isSaving}
        isSaved={updateSettingsMut.isSuccess}
        onSave={handleSave}
      />
    </div>
  );
}
