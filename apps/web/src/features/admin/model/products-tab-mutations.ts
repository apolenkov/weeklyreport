import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";

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
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const deleteProjectMut = useMutation(
    trpc.admin.deleteProject.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Product archived");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  return { saveProjectMut, deleteProjectMut };
}
