import { TRPCError } from "@trpc/server";

import type { Role, UserSession } from "../../schemas/auth";

/**
 * AUTH-03 (Phase 27): pure role assertion — testable without tRPC.
 *
 * Throws:
 *   - UNAUTHORIZED when session is null/undefined.
 *   - FORBIDDEN when the role is not in the allowed set.
 * Returns the narrowed (non-null) session on success.
 *
 * `assertRole` is the runtime contract. Use `buildRoleMiddleware` (api) to
 * compose it into a tRPC middleware bound to a caller-supplied `t` instance.
 * @param session - the caller's session, or null when unauthenticated
 * @param allowed - the role or set of roles permitted to proceed
 * @returns the narrowed, non-null session on success
 */
export function assertRole(
  session: UserSession | null,
  allowed: Role | Role[],
): UserSession {
  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  const allowedSet = new Set<Role>(
    Array.isArray(allowed) ? allowed : [allowed],
  );

  if (!allowedSet.has(session.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Role required: ${[...allowedSet].join(" | ")}`,
    });
  }

  return session;
}
