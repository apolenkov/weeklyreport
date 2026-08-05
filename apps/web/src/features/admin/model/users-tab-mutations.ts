import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";

// Each mutation wires its own cache invalidation and toast feedback so the
// Users tab component only has to call `.mutate`.
const onError = (err: { message: string }) => toast.error(err.message);

export function useUserMutations(onSaved: () => void) {
  const trpc = useTRPC();
  const qc = useQueryClient();

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
