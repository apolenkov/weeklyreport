"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../lib/cache-keys";
import { useTRPC } from "../../lib/trpc-context";

const REVALIDATION_FAILED_MESSAGE =
  "Saved, but the landing page cache may be stale — revalidation failed.";

// Post-save cache invalidation only: failures warn, never reclassify a successful write.
/**
 * Revalidate Org Landing Page.
 */
export async function revalidateOrgLandingPage(): Promise<void> {
  try {
    const response = await fetch("/api/revalidate-org", { method: "POST" });
    if (!response.ok) {
      toast.warning(REVALIDATION_FAILED_MESSAGE);
    }
  } catch {
    toast.warning(REVALIDATION_FAILED_MESSAGE);
  }
}

// Shared updateSettings wrapper so toast copy stays consistent; onSaved clears tab dirty state.
/**
 * Use Update Settings Mut.
 * @param label - The label argument.
 * @param onSaved - The onSaved argument.
 */
export function useUpdateSettingsMut(label: string, onSaved?: () => void) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return useMutation(
    trpc.admin.updateSettings.mutationOptions({
      onSuccess: async () => {
        invalidateAdmin(qc, trpc);
        toast.success(`${label} saved`);
        onSaved?.();
        await revalidateOrgLandingPage();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );
}

/**
 * Check Icon.
 */
export function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      fill="none"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
