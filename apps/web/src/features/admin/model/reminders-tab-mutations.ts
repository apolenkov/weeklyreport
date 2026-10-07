import type { ReminderPolicy } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toastMutationError } from "../../../shared/lib/errors/mutation-error-message";
import { invalidateAdmin } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import type { AdminReminderPolicyView } from "./admin-types";

export function toggledPayload(
  policy: AdminReminderPolicyView,
): ReminderPolicy {
  return {
    id: policy.id,
    kind: policy.kind,
    offsetMinutes: policy.offsetMinutes,
    timezone: policy.timezone,
    audience: policy.audience,
    active: !policy.active,
    validFrom: policy.validFrom,
    validUntil: policy.validUntil,
  };
}

export function useReminderPolicyMutations() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const savePolicyMutationOptions = trpc.admin.savePolicy.mutationOptions({
    onSuccess: () => invalidateAdmin(qc, trpc),
    onError: toastMutationError("Failed to save reminder"),
  });
  // Editor saves and row toggles share transport behavior but keep independent
  // pending state and per-call completion ownership.
  const editorSaveMut = useMutation(savePolicyMutationOptions);
  const toggleMut = useMutation(savePolicyMutationOptions);

  const removeMut = useMutation(
    trpc.admin.removePolicy.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Reminder removed");
      },
      onError: toastMutationError("Failed to remove reminder"),
    }),
  );

  return { editorSaveMut, toggleMut, removeMut };
}
