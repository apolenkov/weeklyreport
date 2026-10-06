"use client";

import {
  MAX_FULL_NAME_LENGTH,
  MAX_SHORT_NAME_LENGTH,
} from "@customreport/shared";

import { CheckIcon } from "../../../shared/ui/settings/settings-tab";
import { useOrgIdentityForm } from "./use-org-identity-form";

// Labelled text input with the hint and a live length counter; the counter
// turns red once the value is past its cap (only reachable from server data —
// typing is capped by maxLength).
function OrgIdentityField({
  id,
  label,
  hint,
  maxLength,
  value,
  isOver,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly maxLength: number;
  readonly value: string;
  readonly isOver: boolean;
  readonly onChange: (next: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        autoComplete="off"
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
      />
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-[var(--color-muted-foreground)]">{hint}</span>
        <span
          className={
            isOver
              ? "text-[var(--color-destructive)]"
              : "text-[var(--color-muted-foreground)]"
          }
        >
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}

function SaveIdentityRow({
  canSave,
  isSaving,
  isSaved,
  onSave,
}: {
  readonly canSave: boolean;
  readonly isSaving: boolean;
  readonly isSaved: boolean;
  readonly onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Save organization identity"
      >
        {isSaving ? "Saving…" : "Save Identity"}
      </button>
      {isSaved && (
        <span
          className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]"
          role="status"
          aria-live="polite"
        >
          <CheckIcon />
          Identity saved
        </span>
      )}
    </div>
  );
}

type OrgIdentityFormModel = ReturnType<typeof useOrgIdentityForm>;

function IdentityLoadError() {
  return (
    <div className="max-w-lg space-y-5">
      <p
        className="text-sm text-[var(--color-destructive)]"
        role="alert"
        data-testid="org-identity-load-error"
      >
        Organization identity could not be loaded. Refresh the page and try
        again.
      </p>
    </div>
  );
}

function IdentityLoading() {
  return (
    <div className="max-w-lg space-y-5">
      <p
        className="text-sm text-[var(--color-muted-foreground)]"
        role="status"
        aria-busy="true"
        aria-label="Loading organization identity"
      >
        Loading organization identity
      </p>
    </div>
  );
}

function IdentityFields({ form }: { readonly form: OrgIdentityFormModel }) {
  return (
    <fieldset disabled={form.isSaving} className="min-w-0 max-w-4xl space-y-5">
      <p className="max-w-[65ch] text-sm text-[var(--color-muted-foreground)]">
        These values brand the application chrome: the nav-bar shows the short
        name, the landing page hero shows both, and PDF report headers use the
        full name.
      </p>

      <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <OrgIdentityField
          id="org-short-name"
          label="Short name"
          hint={`Shown in the nav-bar brand pill (max ${MAX_SHORT_NAME_LENGTH} chars).`}
          maxLength={MAX_SHORT_NAME_LENGTH}
          value={form.shortName}
          isOver={form.shortNameOver}
          onChange={form.editShortName}
        />

        <OrgIdentityField
          id="org-full-name"
          label="Full name"
          hint={`Shown on the landing hero and in PDF report headers (max ${MAX_FULL_NAME_LENGTH} chars).`}
          maxLength={MAX_FULL_NAME_LENGTH}
          value={form.fullName}
          isOver={form.fullNameOver}
          onChange={form.editFullName}
        />
      </div>

      <SaveIdentityRow
        canSave={form.canSave}
        isSaving={form.isSaving}
        isSaved={form.isSaved}
        onSave={form.save}
      />
    </fieldset>
  );
}

export function IdentitySubTab() {
  const form = useOrgIdentityForm();
  if (form.loadError) return <IdentityLoadError />;
  if (!form.isHydrated) return <IdentityLoading />;
  return <IdentityFields form={form} />;
}
