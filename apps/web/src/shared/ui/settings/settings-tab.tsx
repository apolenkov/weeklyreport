"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../lib/query/cache-keys";
import { useTRPC } from "../../lib/trpc/trpc-context";
import { CheckIcon as SharedCheckIcon } from "../icons/action-icons";

const REVALIDATION_FAILED_MESSAGE =
  "Saved, but the landing page cache may be stale — revalidation failed.";

// Post-save cache invalidation only: failures warn, never reclassify a successful write.
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

export function CheckIcon() {
  return <SharedCheckIcon strokeWidth={2.5} />;
}
