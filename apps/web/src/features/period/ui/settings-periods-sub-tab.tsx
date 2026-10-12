"use client";

import type { AppSettings } from "@customreport/shared";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import { useServerSeededDraft } from "../../../shared/hooks/drafts/use-server-seeded-draft";
import {
  CheckIcon,
  useUpdateSettingsMut,
} from "../../../shared/ui/settings/settings-tab";
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
    <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm text-[var(--color-foreground)]">
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
  disabled,
  onSave,
}: {
  readonly isSaving: boolean;
  readonly isSaved: boolean;
  readonly disabled: boolean;
  readonly onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving || disabled}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Save period policy"
      >
        {isSaving ? "Saving…" : "Save Period Policy"}
      </button>
      {isSaved && (
        <span
          className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]"
          role="status"
          aria-live="polite"
        >
          <CheckIcon />
          Period policy saved
        </span>
      )}
    </div>
  );
}

// PATCH shape — only this sub-tab's fields. Brand identity lives on Organization.
function toPeriodPolicyPatch(draft: AppSettings) {
  return {
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
  };
}

function usePeriodPolicyForm(serverSettings: AppSettings) {
  const { draft, setDraft, markClean } =
    useServerSeededDraft<AppSettings>(serverSettings);
  const updateSettingsMut = useUpdateSettingsMut("Period policy");
  const [showSaved, setShowSaved] = useState(false);
  const [invalidFields, setInvalidFields] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [saveAcknowledgement, setSaveAcknowledgement] = useState<{
    readonly sequence: number;
    readonly reopenWindowHours: number;
  } | null>(null);

  function handleValidityChange(id: string, valid: boolean) {
    if (!valid) {
      // Invalid raw text never reaches onChange, so it never dirties the
      // draft — a background reseed would clobber it. Dirty-mark here, same
      // as useReopenWindowState's setDraft((c) => c).
      setDraft((current) => current);
    }
    setInvalidFields((previous) => {
      const next = new Set(previous);
      valid ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSave() {
    const submitted = toPeriodPolicyPatch(draft);
    updateSettingsMut.mutate(submitted, {
      onSuccess: () => {
        markClean();
        setSaveAcknowledgement((current) => ({
          sequence: (current?.sequence ?? 0) + 1,
          reopenWindowHours: submitted.reopenWindowHours,
        }));
        setShowSaved(true);
      },
    });
  }

  const updateDraft: Dispatch<SetStateAction<AppSettings>> = (next) => {
    setShowSaved(false);
    setDraft(next);
  };

  // The shared draft hook installs only accepted clean server values by reference.
  const acceptedServerSeed = draft === serverSettings ? serverSettings : null;

  return {
    acceptedServerSeed,
    draft,
    handleValidityChange,
    handleSave,
    hasInvalidField: invalidFields.size > 0,
    isSaving: updateSettingsMut.isPending,
    isSaved: showSaved,
    saveAcknowledgement,
    updateDraft,
  };
}

export function PeriodsSubTab({
  serverSettings,
}: {
  readonly serverSettings: AppSettings;
}) {
  const {
    acceptedServerSeed,
    draft,
    updateDraft,
    handleValidityChange,
    handleSave,
    hasInvalidField,
    isSaving,
    isSaved,
    saveAcknowledgement,
  } = usePeriodPolicyForm(serverSettings);

  return (
    <fieldset disabled={isSaving} className="min-w-0 max-w-lg space-y-5">
      <PeriodBaseFields
        draft={draft}
        setDraft={updateDraft}
        onValidityChange={handleValidityChange}
      />

      <PeriodCycleFields
        acceptedServerSeed={acceptedServerSeed}
        draft={draft}
        saveAcknowledgement={saveAcknowledgement}
        setDraft={updateDraft}
        onValidityChange={handleValidityChange}
      />

      <UnifiedActivityViewToggle
        checked={draft.unifiedActivityView}
        onCheckedChange={(checked) =>
          updateDraft({ ...draft, unifiedActivityView: checked })
        }
      />

      {hasInvalidField && (
        <p
          className="text-xs text-[var(--color-destructive)]"
          data-testid="period-policy-invalid-hint"
        >
          Fix the highlighted numeric fields before saving.
        </p>
      )}

      <SavePeriodPolicyRow
        isSaving={isSaving}
        isSaved={isSaved}
        disabled={hasInvalidField}
        onSave={handleSave}
      />
    </fieldset>
  );
}
