"use client";

import type { Role } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useTRPC } from "../../lib/trpc-context";

/**
 * Phase 48-C (UFB-038): centralised role-guard wrapper.
 *
 * Renders {children} only when the current session role matches `role`.
 * When `role` is an array, the gate passes if the session role is in the
 * array. Returns `null` while the session is still loading or when the
 * role does not match — this means admin-only affordances disappear
 * completely for head/lead/viewer users, rather than rendering disabled.
 *
 * Source of truth: `auth.me` tRPC query (publicProcedure that returns the
 * `UserSession | null` for the current request). The same query backs
 * `SessionProvider`, so callers do not pay an extra round-trip — React
 * Query dedupes by queryKey.
 *
 * Usage:
 *
 *   <IfRole role="admin">
 *     <a href="/admin?tab=reminders">Configure reminders</a>
 *   </IfRole>
 *
 *   <IfRole role={["admin", "head"]}>
 *     <ReviewControls />
 *   </IfRole>
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
