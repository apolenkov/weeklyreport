"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProjectActivity } from "@weeklyreport/shared";
import { useMemo } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import type { AdminUserView } from "../model/admin-types";

interface ActivityLeadsArgs {
  readonly activity: ProjectActivity;
  readonly users: readonly AdminUserView[];
}

function useActivityLeadMutations() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const invalidateList = () =>
    qc
      .invalidateQueries(trpc.projectActivity.list.pathFilter())
      .catch(() => undefined);

  const attachMut = useMutation(
    trpc.projectActivity.attachLead.mutationOptions({
      onSuccess: () => invalidateList(),
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const detachMut = useMutation(
    trpc.projectActivity.detachLead.mutationOptions({
      onSuccess: () => invalidateList(),
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  return {
    attach: attachMut.mutate,
    detach: detachMut.mutate,
    mutating: attachMut.isPending || detachMut.isPending,
  };
}

// The server accepts an attachment only when the lead's reporting group is the
// activity's group, so out-of-group leads are listed but locked — hiding them
// would read as "the lead vanished" after a group move.
export function useActivityLeads({ activity, users }: ActivityLeadsArgs) {
  const attachedIds = useMemo(
    () => new Set(activity.leadIds),
    [activity.leadIds],
  );

  // An attached lead stays listed after deactivation so the edge can still be
  // removed; inactive leads that were never attached are not candidates.
  const visibleLeads = useMemo(
    () =>
      users.filter(
        (user) =>
          user.role === "lead" && (user.isActive || attachedIds.has(user.id)),
      ),
    [users, attachedIds],
  );

  const { attach, detach, mutating } = useActivityLeadMutations();

  const isOutOfGroup = (lead: AdminUserView): boolean =>
    lead.groupId !== activity.groupId;

  function toggle(leadId: string, nextChecked: boolean): void {
    if (!nextChecked) {
      // Detach only removes an existing edge, so it stays allowed for a lead
      // deactivated while attached.
      if (attachedIds.has(leadId)) {
        detach({ activityId: activity.id, leadId });
      }
      return;
    }
    const lead = visibleLeads.find(
      (candidate) => candidate.id === leadId && candidate.isActive,
    );
    if (!lead) return;
    if (isOutOfGroup(lead)) {
      toast.error(`${lead.name} belongs to another reporting group.`);
      return;
    }
    attach({ activityId: activity.id, leadId });
  }

  return { visibleLeads, attachedIds, isOutOfGroup, mutating, toggle };
}
