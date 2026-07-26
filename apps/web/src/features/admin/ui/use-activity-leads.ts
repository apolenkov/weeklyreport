"use client";

import type { ProjectActivity } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import type { MockUser } from "../model/admin-types";

interface ActivityLeadsArgs {
  readonly activity: ProjectActivity;
  readonly users: readonly MockUser[];
}

function useActivityLeadMutations() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const invalidateList = () =>
    qc.invalidateQueries(trpc.projectActivity.list.pathFilter());

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
  const activeLeads = useMemo(
    () => users.filter((user) => user.role === "lead" && user.isActive),
    [users],
  );

  const attachedIds = useMemo(
    () => new Set(activity.leadIds),
    [activity.leadIds],
  );

  const { attach, detach, mutating } = useActivityLeadMutations();

  const isOutOfGroup = (lead: MockUser): boolean =>
    lead.groupId !== activity.groupId;

  function toggle(leadId: string, nextChecked: boolean): void {
    const lead = activeLeads.find((candidate) => candidate.id === leadId);
    if (!lead) return;
    if (nextChecked && isOutOfGroup(lead)) {
      toast.error(`${lead.name} belongs to another reporting group.`);
      return;
    }
    if (nextChecked) {
      attach({ activityId: activity.id, leadId });
    } else {
      detach({ activityId: activity.id, leadId });
    }
  }

  return { activeLeads, attachedIds, isOutOfGroup, mutating, toggle };
}
