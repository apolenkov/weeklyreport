import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";
import { toReminderPolicyInput } from "./admin";
import type { MockReminderPolicy } from "./admin-types";
import { isoFromDate } from "./reminders-tab-format";

/**
 * Toggled Payload.
 * @param policy - The policy argument.
 */
export function toggledPayload(policy: MockReminderPolicy) {
  return toReminderPolicyInput(
    {
      kind: policy.kind,
      offsetMinutes: policy.offsetMinutes,
      timezone: policy.timezone,
      audience: policy.audience,
      active: !policy.active,
      validFromIso: isoFromDate(policy.validFrom),
      validUntilIso:
        policy.validUntil === null ? null : isoFromDate(policy.validUntil),
    },
    policy.id,
  );
}

/**
 * Use Reminder Policy Mutations.
 */
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
