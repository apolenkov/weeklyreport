"use client";

import { useQuery } from "@tanstack/react-query";
import type { Role } from "@weeklyreport/shared";
import type { ReactNode } from "react";

import { useTRPC } from "../../lib/trpc/trpc-context";

// Uses auth.me (same query as SessionProvider) so React Query dedupes the fetch.
// `loadingFallback` is shown only while auth.me is pending; errors and loaded
// sessions keep the plain gate behaviour.
export function IfRole({
  forRole,
  children,
  loadingFallback,
}: {
  readonly forRole: Role | readonly Role[];
  readonly children: ReactNode;
  readonly loadingFallback?: ReactNode;
}) {
  const trpc = useTRPC();
  const me = useQuery(trpc.auth.me.queryOptions());

  const allowed = me.data
    ? Array.isArray(forRole)
      ? forRole.includes(me.data.role)
      : me.data.role === forRole
    : false;
  const content: ReactNode = allowed ? children : null;
  return me.isPending ? (loadingFallback ?? null) : content;
}
