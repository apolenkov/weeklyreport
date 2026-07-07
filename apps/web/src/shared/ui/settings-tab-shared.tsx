"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../lib/cache-keys";
import { useTRPC } from "../../lib/trpc-context";

// ─── Sub-tab plumbing ────────────────────────────────────────────────────
//
// The three settings sub-tabs share an updateSettings mutation helper. We
// keep the per-tab state local (each sub-tab owns its own draft + dirty flag)
// but the mutation itself is a thin reusable wrapper so the "Saved" toasts
// and onError messages stay consistent across tabs.
export function useUpdateSettingsMut(label: string) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return useMutation(
    trpc.admin.updateSettings.mutationOptions({
      onSuccess: async () => {
        invalidateAdmin(qc, trpc);
        // invalidate landing page cache on any settings change
        await fetch("/api/revalidate-org", { method: "POST" });
        toast.success(`${label} saved`);
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
