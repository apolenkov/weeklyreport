"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { SessionUser } from "../../../lib/session-provider";
import { useTRPC } from "../../../lib/trpc-context";

interface UseLeadFormForeignContentPurgeInput {
  readonly isEveryone: boolean;
  readonly visibilityHydrated: boolean;
  readonly targetReportId: string;
  readonly currentUserId: string | null;
  readonly sessionRole: SessionUser["role"] | null;
}

export function useLeadFormForeignContentPurge({
  isEveryone,
  visibilityHydrated,
  targetReportId,
  currentUserId,
  sessionRole,
}: UseLeadFormForeignContentPurgeInput): void {
  const trpc = useTRPC();
  const qc = useQueryClient();

  // `enabled:false` only stops refetching: removing the cached query is what
  // drops the data so display arrays recompute to own-only. The bare procedure
  // prefix (no input) also drops the PRIOR report's cache on a report switch.
  useEffect(() => {
    if (isEveryone && visibilityHydrated) return;
    qc.removeQueries({
      queryKey: trpc.leadForm.crossAuthorContent.queryKey(),
    });
  }, [isEveryone, visibilityHydrated, targetReportId, qc, trpc]);

  // Identity guard: the `crossAuthorContent` key is scoped by reportId only,
  // NOT by user, so two identities sharing a browser + QueryClient could read
  // each other's records. Drop everything on ANY identity change, even though
  // logout / role switch full-reload into a fresh QueryClient today.
  useEffect(() => {
    qc.removeQueries({
      queryKey: trpc.leadForm.crossAuthorContent.queryKey(),
    });
  }, [currentUserId, sessionRole, qc, trpc]);
}
