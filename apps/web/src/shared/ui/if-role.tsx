"use client";

import type { Role } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useTRPC } from "../../lib/trpc-context";

// Uses auth.me (same query as SessionProvider) so React Query dedupes the fetch.
/**
 * If Role.
 * @param options - The options argument.
 */
export function IfRole({
  role,
  children,
}: {
  readonly role: Role | readonly Role[];
  readonly children: ReactNode;
}) {
  const trpc = useTRPC();
  const me = useQuery(trpc.auth.me.queryOptions());

  if (!me.data) return null;

  const allowed = Array.isArray(role)
    ? role.includes(me.data.role)
    : me.data.role === role;

  return allowed ? children : null;
}
