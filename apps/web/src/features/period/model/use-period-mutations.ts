"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";

// Periods-tab lifecycle mutations; dialog close via injected success callbacks.
/**
 * Use Period Mutations.
 * @param options - The options argument.
 */
export function usePeriodMutations({
  onCreateSuccess,
  onEditSuccess,
  onDeleteSuccess,
}: {
  readonly onCreateSuccess: () => void;
  readonly onEditSuccess: () => void;
  readonly onDeleteSuccess: () => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  function invalidatePeriodLists() {
    void qc.invalidateQueries(trpc.admin.listPeriodsByState.pathFilter());
    invalidateAdmin(qc, trpc);
  }

  const publishMut = useMutation(
    trpc.period.publish.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period published");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const reopenMut = useMutation(
    trpc.period.reopen.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period reopened");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const archiveMut = useMutation(
    trpc.admin.archivePeriod.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period archived");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const unarchiveMut = useMutation(
    trpc.admin.unarchivePeriod.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period unarchived");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  // onError pipes server messages verbatim (overlap ranges, policy rejections, etc.).
  const createMut = useMutation(
    trpc.admin.createPeriodManual.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period created");
        onCreateSuccess();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const updateMut = useMutation(
    trpc.admin.updatePeriodManual.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period updated");
        onEditSuccess();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const deleteMut = useMutation(
    trpc.admin.deleteReport.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period deleted");
        onDeleteSuccess();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  return {
    publishMut,
    reopenMut,
    archiveMut,
    unarchiveMut,
    createMut,
    updateMut,
    deleteMut,
  };
}
