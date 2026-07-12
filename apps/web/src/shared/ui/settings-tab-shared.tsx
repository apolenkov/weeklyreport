"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../lib/cache-keys";
import { useTRPC } from "../../lib/trpc-context";

const REVALIDATION_FAILED_MESSAGE =
  "Saved, but the landing page cache may be stale — revalidation failed.";

// Best-effort landing-page cache invalidation after a settings write. The
// settings mutation has already succeeded by the time this runs, so a non-ok
// response or a thrown fetch must not turn the successful save into an error:
// it surfaces a distinct warning instead, so the admin knows the public
// landing page may lag without the save itself being reported as failed.
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

// ─── Sub-tab plumbing ────────────────────────────────────────────────────
//
// The three settings sub-tabs share an updateSettings mutation helper. We
// keep the per-tab state local (each sub-tab owns its own draft + dirty flag)
// but the mutation itself is a thin reusable wrapper so the "Saved" toasts
// and onError messages stay consistent across tabs. `onSaved` lets a caller
// clear its local dirty flag once the write lands.
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
