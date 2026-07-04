"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { invalidateAdmin } from "../../lib/cache-keys";
import { useTRPC } from "../../lib/trpc-context";
import { CheckIcon } from "./settings-tab-shared";

const MAX_SHORT_NAME_LENGTH = 16;
const MAX_FULL_NAME_LENGTH = 200;

export function IdentitySubTab() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const orgQ = useQuery(trpc.admin.getOrganization.queryOptions());

  const [shortName, setShortName] = useState("");
  const [fullName, setFullName] = useState("");

  // Re-seed the form whenever the source query revalidates so a successful
  // save (which triggers invalidateAdmin) is reflected in the inputs.
  useEffect(() => {
    if (orgQ.data) {
      setShortName(orgQ.data.shortName);
      setFullName(orgQ.data.fullName);
    }
  }, [orgQ.data]);

  const updateOrgMut = useMutation(
    trpc.admin.updateOrganization.mutationOptions({
      onSuccess: async () => {
        invalidateAdmin(qc, trpc);
        // A9: invalidate landing page cache after org name change
        await fetch("/api/revalidate-org", { method: "POST" });
        toast.success("Organization identity saved");
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
          maxLength={16}
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-[var(--color-muted-foreground)]">
            Shown in the nav-bar brand pill (max 16 chars).
          </span>
          <span
            className={
              shortNameOver
                ? "text-red-600"
                : "text-[var(--color-muted-foreground)]"
            }
          >
            {shortName.length}/16
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
          maxLength={200}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-[var(--color-muted-foreground)]">
            Shown on the landing hero and in PDF report headers (max 200 chars).
          </span>
          <span
            className={
              fullNameOver
                ? "text-red-600"
                : "text-[var(--color-muted-foreground)]"
            }
          >
            {fullName.length}/200
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
