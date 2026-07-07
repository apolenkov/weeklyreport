"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";

/**
 * All seven Periods-tab lifecycle mutations + the shared list-invalidation
 * helper. `createMut`/`updateMut` close the dialog through the injected
 * `onCreateSuccess`/`onEditSuccess` callbacks so the hook stays decoupled
 * from the tab's `setShowCreate`/`setEditingRow` state.
 */
export function usePeriodMutations({
  onCreateSuccess,
  onEditSuccess,
}: {
  readonly onCreateSuccess: () => void;
  readonly onEditSuccess: () => void;
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
        // The reopen-policy gate (master switch + window) surfaces
        // through `PeriodAccessError → BAD_REQUEST` here; the message
        // already explains *why* the reopen was rejected so we pipe it
        // through verbatim.
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

  // «New period» mutation. Pipes the server error message
  // through verbatim so overlap conflicts (server emits the colliding
  // date range) surface in the toast unchanged.
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

  // «Edit period» mutation. Same error-pipe pattern as create —
  // the server-side overlap message identifies the conflicting row and
  // the not-found message names the missing id; both flow through to the
  // toast verbatim.
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

  // Delete period mutation with confirmation guard.
  const deleteMut = useMutation(
    trpc.admin.deleteReport.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period deleted");
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
