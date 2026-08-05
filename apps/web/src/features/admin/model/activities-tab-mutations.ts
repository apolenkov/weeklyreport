"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";

// Activities live outside admin.snapshot, so `invalidateAdmin` would refetch
// six unrelated caches and still miss the list this tab reads.
export function useActivityMutations(onSaved: () => void) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const invalidateList = () =>
    qc.invalidateQueries(trpc.projectActivity.list.pathFilter());

  const createMut = useMutation(
    trpc.projectActivity.create.mutationOptions({
      onSuccess: async () => {
        await invalidateList();
        toast.success("Activity saved");
        onSaved();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const updateMut = useMutation(
    trpc.projectActivity.update.mutationOptions({
      onSuccess: async () => {
        await invalidateList();
        toast.success("Activity saved");
        onSaved();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const archiveMut = useMutation(
    trpc.projectActivity.archive.mutationOptions({
      onSuccess: async (_data, variables) => {
        await invalidateList();
        toast.success(
          variables.archived ? "Activity archived" : "Activity restored",
        );
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  return { createMut, updateMut, archiveMut };
}
