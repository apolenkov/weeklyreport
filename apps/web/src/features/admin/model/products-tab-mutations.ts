import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toastMutationError } from "../../../shared/lib/errors/mutation-error-message";
import { invalidateAdmin } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";

// Save/archive mutations for the Products tab: each wires cache invalidation
// and toast feedback so the tab only has to call `.mutate`.
export function useProductMutations(onSaved: () => void) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const saveProjectMut = useMutation(
    trpc.admin.saveProject.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Product saved");
        onSaved();
      },
      onError: toastMutationError("Failed to save product"),
    }),
  );

  const deleteProjectMut = useMutation(
    trpc.admin.deleteProject.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Product archived");
      },
      onError: toastMutationError("Failed to archive product"),
    }),
  );

  return { saveProjectMut, deleteProjectMut };
}
