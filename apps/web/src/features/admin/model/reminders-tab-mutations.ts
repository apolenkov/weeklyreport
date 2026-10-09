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

export function useReminderPolicyMutations(
  onRowSettled: (policyId: string) => void,
) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const savePolicyMutationOptions = trpc.admin.savePolicy.mutationOptions({
    onSuccess: () => invalidateAdmin(qc, trpc),
    onError: toastMutationError("Failed to save reminder"),
  });
  // Editor saves and row toggles share transport behavior but keep independent
  // pending state and per-call completion ownership.
  const editorSaveMut = useMutation(savePolicyMutationOptions);
  // Mutation-level callbacks run for every request; mutate-level callbacks
  // belong only to the latest observer when row operations overlap.
  const toggleMut = useMutation({
    ...savePolicyMutationOptions,
    onSettled: (_data, _error, policy) => onRowSettled(policy.id),
  });

  const removeMut = useMutation(
    trpc.admin.removePolicy.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Reminder removed");
      },
      onError: toastMutationError("Failed to remove reminder"),
      onSettled: (_data, _error, policy) => onRowSettled(policy.id),
    }),
  );

  return { editorSaveMut, toggleMut, removeMut };
}
