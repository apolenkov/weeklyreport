"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AUTHORING_ROLES, type UserSession } from "@weeklyreport/shared";
import { useEffect, useMemo, useState } from "react";

import { useTRPC } from "../trpc/trpc-context";
import { clearPrivateDraftCache } from "./private-draft-cache";

interface ObservedAccess {
  readonly userId: string | null;
  readonly canAuthor: boolean;
}

/** Blocks old mounted state while an observed identity/entitlement loss clears its cache. */
export function usePrivateDraftCacheBoundary(
  session: UserSession | null | undefined,
): boolean {
  const client = useQueryClient();
  const trpc = useTRPC();
  const access = useMemo(
    () =>
      session === undefined
        ? undefined
        : {
            userId: session?.userId ?? null,
            canAuthor: session ? AUTHORING_ROLES.includes(session.role) : false,
          },
    [session],
  );
  const [settled, setSettled] = useState<ObservedAccess>();
  const changed =
    access !== undefined &&
    (access.userId !== settled?.userId ||
      access.canAuthor !== settled.canAuthor);
  const clearing =
    changed &&
    (!access.canAuthor ||
      (settled !== undefined && access.userId !== settled.userId));

  useEffect(() => {
    if (!clearing) return;
    const cleanup = new AbortController();
    const preserveCompleteHistory =
      access.userId !== null && access.userId === settled?.userId;
    void clearPrivateDraftCache(client, trpc, preserveCompleteHistory).then(
      () => {
        if (!cleanup.signal.aborted) setSettled(access);
      },
    );
    return () => {
      cleanup.abort();
    };
  }, [access, changed, clearing, client, settled, trpc]);

  if (changed && !clearing) setSettled(access);
  return clearing;
}
