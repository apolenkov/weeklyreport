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

/**
 * The lead form's foreign-content purge guard, split from `useLeadFormData`
 * only to keep both files inside the max-lines standard. The two effects and
 * their dependency arrays are load-bearing security behavior (7c.6) and move
 * verbatim; `lead-form-visibility.test.tsx` (7d.7) pins them end-to-end.
 */
export function useLeadFormForeignContentPurge({
  isEveryone,
  visibilityHydrated,
  targetReportId,
  currentUserId,
  sessionRole,
}: UseLeadFormForeignContentPurgeInput): void {
  const trpc = useTRPC();
  const qc = useQueryClient();

  // 7c.6: purge the fetched foreign full content from the query cache whenever
  // the toggle leaves Everyone OR is not yet hydrated for the current context.
  // `enabled:false` (in useLeadFormData) stops a refetch; removing the cached
  // query drops the data so the merged display arrays recompute to own-only. A
  // later return to Everyone re-fetches rather than serving stale. The purge
  // uses the bare procedure prefix (`queryKey()`, no input) so a report switch
  // also drops the PRIOR report's cached content, not just the current
  // report's.
  useEffect(() => {
    if (isEveryone && visibilityHydrated) return;
    qc.removeQueries({
      queryKey: trpc.leadForm.crossAuthorContent.queryKey(),
    });
  }, [isEveryone, visibilityHydrated, targetReportId, qc, trpc]);

  // 7c.6 (identity guard): the `crossAuthorContent` cache key is scoped by
  // reportId only, NOT by user — so two identities on the SAME browser + same
  // QueryClient + same report could otherwise share a cache entry. On ANY
  // identity change (logout, role switch, authz downgrade) drop ALL cached
  // foreign content unconditionally, so user B can never read user A's foreign
  // records even while both sit in Everyone. The dev switcher / logout do a
  // full reload (fresh QueryClient) today; this guard makes the invariant hold
  // regardless of the navigation mechanism. The lead form shows all assigned
  // products at once (no per-product selector), so identity + report purges
  // cover every real context-switch surface.
  useEffect(() => {
    qc.removeQueries({
      queryKey: trpc.leadForm.crossAuthorContent.queryKey(),
    });
  }, [currentUserId, sessionRole, qc, trpc]);
}
