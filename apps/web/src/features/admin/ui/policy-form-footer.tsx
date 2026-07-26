import type { PolicyFormState } from "../model/reminders-form-state";

interface PolicyFormFooterProps {
  readonly form: PolicyFormState;
  readonly editing: boolean;
  readonly isSaving: boolean;
  readonly validityValid: boolean;
  readonly onChange: (
    next: PolicyFormState | ((prev: PolicyFormState) => PolicyFormState),
  ) => void;
  readonly onCancel: () => void;
  readonly onSave: () => void;
}

function ActiveToggle({
  form,
  onChange,
}: Pick<PolicyFormFooterProps, "form" | "onChange">) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={form.active}
        onChange={(e) =>
          onChange((prev) => ({ ...prev, active: e.target.checked }))
        }
      />
      <span>Active</span>
    </label>
  );
}

function PolicyFormActions({
  editing,
  isSaving,
  validityValid,
  onCancel,
  onSave,
}: Omit<PolicyFormFooterProps, "form" | "onChange">) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      {!validityValid && (
        <span
          data-testid="policy-validity-hint"
          className="text-xs text-[var(--color-destructive)]"
        >
          End date must be after start date
        </span>
      )}
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving || !validityValid}
        data-testid="policy-save-button"
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving…" : editing ? "Save changes" : "Create reminder"}
      </button>
    </div>
  );
}

export function PolicyFormFooter({
  form,
  onChange,
  editing,
  isSaving,
  validityValid,
  onCancel,
  onSave,
}: PolicyFormFooterProps) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-[var(--color-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
      <ActiveToggle form={form} onChange={onChange} />
      <PolicyFormActions
        editing={editing}
        isSaving={isSaving}
        validityValid={validityValid}
        onCancel={onCancel}
        onSave={onSave}
      />
    </div>
  );
}
