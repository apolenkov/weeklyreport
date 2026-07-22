"use client";

import { MAX_SHORT_NAME_LENGTH } from "@customreport/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";
import {
  CheckIcon,
  revalidateOrgLandingPage,
} from "../../../shared/ui/settings-tab-shared";

const MAX_FULL_NAME_LENGTH = 200;

export function IdentitySubTab() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const orgQ = useQuery(trpc.admin.getOrganization.queryOptions());

  const [shortName, setShortName] = useState("");
  const [fullName, setFullName] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Re-seed the form only from FRESH server data: skip while the form is
  // dirty (a background refetch must not overwrite an in-progress edit) and
  // skip data already seeded — otherwise the dirty flag's post-save flip
  // re-fires this effect while the query cache still holds the pre-save
  // values and the just-typed field flickers back to the old value.
  const lastSeeded = useRef<typeof orgQ.data>(undefined);
  useEffect(() => {
    if (orgQ.data && !isDirty && orgQ.data !== lastSeeded.current) {
      lastSeeded.current = orgQ.data;
      setShortName(orgQ.data.shortName);
      setFullName(orgQ.data.fullName);
    }
  }, [orgQ.data, isDirty]);

  const updateOrgMut = useMutation(
    trpc.admin.updateOrganization.mutationOptions({
      onSuccess: async () => {
        setIsDirty(false);
        invalidateAdmin(qc, trpc);
        toast.success("Organization identity saved");
        await revalidateOrgLandingPage();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const isSaving = updateOrgMut.isPending;
  const isLoading = orgQ.isLoading;

  function handleSave() {
    updateOrgMut.mutate({
      shortName: shortName.trim(),
      fullName: fullName.trim(),
    });
  }

  const shortNameOver = shortName.length > MAX_SHORT_NAME_LENGTH;
  const fullNameOver = fullName.length > MAX_FULL_NAME_LENGTH;
  const canSave =
    !isSaving &&
    !isLoading &&
    shortName.trim().length > 0 &&
    fullName.trim().length > 0 &&
    !shortNameOver &&
    !fullNameOver;

  return (
    <div className="max-w-lg space-y-5">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        These values brand the application chrome: the nav-bar shows the short
        name, the landing page hero shows both, and PDF report headers use the
        full name.
      </p>

      <div>
        <label
          htmlFor="org-short-name"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Short name
        </label>
        <input
          id="org-short-name"
          name="org-short-name"
          type="text"
          autoComplete="off"
          maxLength={MAX_SHORT_NAME_LENGTH}
          value={shortName}
          onChange={(e) => {
            setIsDirty(true);
            setShortName(e.target.value);
          }}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-[var(--color-muted-foreground)]">
            Shown in the nav-bar brand pill (max {MAX_SHORT_NAME_LENGTH} chars).
          </span>
          <span
            className={
              shortNameOver
                ? "text-red-600"
                : "text-[var(--color-muted-foreground)]"
            }
          >
            {shortName.length}/{MAX_SHORT_NAME_LENGTH}
          </span>
        </div>
      </div>

      <div>
        <label
          htmlFor="org-full-name"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Full name
        </label>
        <input
          id="org-full-name"
          name="org-full-name"
          type="text"
          autoComplete="off"
          maxLength={MAX_FULL_NAME_LENGTH}
          value={fullName}
          onChange={(e) => {
            setIsDirty(true);
            setFullName(e.target.value);
          }}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-[var(--color-muted-foreground)]">
            Shown on the landing hero and in PDF report headers (max{" "}
            {MAX_FULL_NAME_LENGTH} chars).
          </span>
          <span
            className={
              fullNameOver
                ? "text-red-600"
                : "text-[var(--color-muted-foreground)]"
            }
          >
            {fullName.length}/{MAX_FULL_NAME_LENGTH}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Save organization identity"
        >
          {isSaving ? "Saving…" : "Save Identity"}
        </button>
        {updateOrgMut.isSuccess && (
          <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
            <CheckIcon />
            Identity saved
          </span>
        )}
      </div>
    </div>
  );
}
