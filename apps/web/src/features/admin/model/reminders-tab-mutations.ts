import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../lib/cache-keys";
import { toIsoDateString } from "../../../lib/format-date";
import { useTRPC } from "../../../lib/trpc-context";
import { toReminderPolicyInput } from "./admin";
import type { AdminReminderPolicyView } from "./admin-types";

export function toggledPayload(policy: AdminReminderPolicyView) {
  return toReminderPolicyInput(
    {
      kind: policy.kind,
      offsetMinutes: policy.offsetMinutes,
      timezone: policy.timezone,
      audience: policy.audience,
      active: !policy.active,
      validFromIso: toIsoDateString(policy.validFrom),
      validUntilIso:
        policy.validUntil === null ? null : toIsoDateString(policy.validUntil),
    },
    policy.id,
  );
}

export function useReminderPolicyMutations() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const saveMut = useMutation(
    trpc.admin.savePolicy.mutationOptions({
      onSuccess: () => invalidateAdmin(qc, trpc),
      onError: (err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to save reminder";
        toast.error(message);
      },
    }),
  );

  const removeMut = useMutation(
    trpc.admin.removePolicy.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Reminder removed");
      },
      onError: (err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to remove reminder";
        toast.error(message);
      },
    }),
  );

  return { saveMut, removeMut };
}
