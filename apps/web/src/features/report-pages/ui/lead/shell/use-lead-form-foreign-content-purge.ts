"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { SessionUser } from "../../../../../shared/lib/auth/session-provider";
import { useTRPC } from "../../../../../shared/lib/trpc/trpc-context";

interface UseLeadFormForeignContentPurgeInput {
  readonly isEveryone: boolean;
  readonly visibilityHydrated: boolean;
  readonly targetReportId: string | null;
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

  // Mine/unhydrated removes the procedure prefix across reports. Everyone may
  // retain other report variants only while they belong to this trusted viewer.
  useEffect(() => {
    const queryKey = trpc.leadForm.crossAuthorContent.queryKey();
    if (!isEveryone || !visibilityHydrated || !currentUserId || !sessionRole) {
      qc.removeQueries({ queryKey });
      return;
    }
    qc.removeQueries({
      queryKey,
      predicate: (query) => {
        const scope = query.queryKey[1];
        if (
          typeof scope !== "object" ||
          scope === null ||
          !("clientViewer" in scope)
        )
          return true;
        const viewer = scope.clientViewer;
        return (
          typeof viewer !== "object" ||
          viewer === null ||
          !("userId" in viewer) ||
          !("role" in viewer) ||
          viewer.userId !== currentUserId ||
          viewer.role !== sessionRole
        );
      },
    });
  }, [
    isEveryone,
    visibilityHydrated,
    targetReportId,
    currentUserId,
    sessionRole,
    qc,
    trpc,
  ]);
}
