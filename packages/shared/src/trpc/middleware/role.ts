import { TRPCError } from "@trpc/server";

import type { Role, UserSession } from "../../schemas/auth/auth.js";

/**
 * Narrows an authenticated session after enforcing an allowed role set.
 * Throws `UNAUTHORIZED` without a session and `FORBIDDEN` for a disallowed role.
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
