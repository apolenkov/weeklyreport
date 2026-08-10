"use client";

import {
  MAX_FULL_NAME_LENGTH,
  MAX_SHORT_NAME_LENGTH,
} from "@customreport/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import {
  CheckIcon,
  revalidateOrgLandingPage,
} from "../../../shared/ui/settings/settings-tab";

function useSaveOrgIdentity(onSaved: () => void) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  return useMutation(
    trpc.admin.updateOrganization.mutationOptions({
      onSuccess: async () => {
        onSaved();
        invalidateAdmin(qc, trpc);
        toast.success("Organization identity saved");
        await revalidateOrgLandingPage();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );
}

function useOrgIdentityForm() {
  const trpc = useTRPC();
  const orgQ = useQuery(trpc.admin.getOrganization.queryOptions());

  const [shortName, setShortName] = useState("");
  const [fullName, setFullName] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Seed only fresh server data: skip while dirty (refetch must not clobber
  // edits) and skip already-seeded refs — else post-save dirty flip re-fires
  // against pre-save cache and the field flickers back.
  const lastSeeded = useRef<typeof orgQ.data>(undefined);
  useEffect(() => {
    if (orgQ.data && !isDirty && orgQ.data !== lastSeeded.current) {
      lastSeeded.current = orgQ.data;
      setShortName(orgQ.data.shortName);
      setFullName(orgQ.data.fullName);
    }
  }, [orgQ.data, isDirty]);

  const updateOrgMut = useSaveOrgIdentity(() => setIsDirty(false));
  const shortNameOver = shortName.length > MAX_SHORT_NAME_LENGTH;
  const fullNameOver = fullName.length > MAX_FULL_NAME_LENGTH;

  return {
    shortName,
    fullName,
    shortNameOver,
    fullNameOver,
    isSaving: updateOrgMut.isPending,
    isSaved: updateOrgMut.isSuccess,
    loadError: orgQ.isError,
    isLoading: orgQ.isLoading,
    canSave:
      !updateOrgMut.isPending &&
      !orgQ.isLoading &&
      !orgQ.isError &&
      shortName.trim().length > 0 &&
      fullName.trim().length > 0 &&
      !shortNameOver &&
      !fullNameOver,
    editShortName: (next: string) => {
      setIsDirty(true);
      setShortName(next);
    },
    editFullName: (next: string) => {
      setIsDirty(true);
      setFullName(next);
    },
    save: () =>
      updateOrgMut.mutate({
        shortName: shortName.trim(),
        fullName: fullName.trim(),
      }),
  };
}

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
        <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
          <CheckIcon />
          Identity saved
        </span>
      )}
    </div>
  );
}

export function IdentitySubTab() {
  const form = useOrgIdentityForm();

  if (form.loadError) {
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

  return (
    <div className="max-w-lg space-y-5">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        These values brand the application chrome: the nav-bar shows the short
        name, the landing page hero shows both, and PDF report headers use the
        full name.
      </p>

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

      <SaveIdentityRow
        canSave={form.canSave}
        isSaving={form.isSaving}
        isSaved={form.isSaved}
        onSave={form.save}
      />
    </div>
  );
}
