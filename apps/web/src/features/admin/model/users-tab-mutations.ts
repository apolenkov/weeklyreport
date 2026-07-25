import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";

/**
 * Save/delete/deactivate/activate mutations for the Users tab: each wires
 * cache invalidation and toast feedback so the tab component only has to
 * call `.mutate`.
 * @param onSaved - The onSaved argument.
 */
export function useUserMutations(onSaved: () => void) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const onError = (err: { message: string }) => toast.error(err.message);
  const onSuccess = (message: string, after?: () => void) => () => {
    invalidateAdmin(qc, trpc);
    toast.success(message);
    after?.();
  };

  const saveUserMut = useMutation(
    trpc.admin.saveUser.mutationOptions({
      onSuccess: onSuccess("User saved", onSaved),
      onError,
    }),
  );

  const deleteUserMut = useMutation(
    trpc.admin.deleteUser.mutationOptions({
      onSuccess: onSuccess("User deleted"),
      onError,
    }),
  );

  const deactivateUserMut = useMutation(
    trpc.admin.deactivateUser.mutationOptions({
      onSuccess: onSuccess("User deactivated"),
      onError,
    }),
  );

  const activateUserMut = useMutation(
    trpc.admin.activateUser.mutationOptions({
      onSuccess: onSuccess("User activated"),
      onError,
    }),
  );

  return { saveUserMut, deleteUserMut, deactivateUserMut, activateUserMut };
}
