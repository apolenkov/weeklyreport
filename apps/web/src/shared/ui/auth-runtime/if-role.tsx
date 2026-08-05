"use client";

import type { Role } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useTRPC } from "../../../lib/trpc-context";

// Uses auth.me (same query as SessionProvider) so React Query dedupes the fetch.
export function IfRole({
  forRole,
  children,
}: {
  readonly forRole: Role | readonly Role[];
  readonly children: ReactNode;
}) {
  const trpc = useTRPC();
  const me = useQuery(trpc.auth.me.queryOptions());

  if (!me.data) return null;

  const allowed = Array.isArray(forRole)
    ? forRole.includes(me.data.role)
    : me.data.role === forRole;

  return allowed ? children : null;
}
