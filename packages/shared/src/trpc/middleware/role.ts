import type {
  TRPCMiddlewareBuilder,
  TRPCMiddlewareFunction,
} from "@trpc/server";
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
 * `assertRole` is the runtime contract. `requireRole` is the tRPC adapter
 * that wraps it into a middleware bound to a caller-supplied `t` instance.
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

/**
 * Builds a tRPC middleware that enforces a role check via `assertRole`.
 *
 * The factory is generic over the caller's tRPC builder `t`. The constraint
 * on `t.middleware` declares the `$ContextOverrides` generic and ties it into
 * the return `TRPCMiddlewareBuilder`, so TypeScript can infer `TContext` /
 * `TMeta` from the call-site `t` and bind `$ContextOverrides` from the
 * explicit `<{ session: UserSession }>` instantiation. That preserves the
 * chain narrowing — call-site `.use(middleware)` sees ctx.session as
 * non-null in downstream procedures.
 *
 * adminProcedure === headProcedure for v6.0 per D-AUTH-03; admin is reserved
 * as an alias until Phase 29 (AUTH-02) splits it.
 */
export function requireRole<
  TContext extends { session: UserSession | null },
  TMeta = object,
>(
  t: {
    middleware: <$ContextOverrides>(
      fn: TRPCMiddlewareFunction<
        TContext,
        TMeta,
        object,
        $ContextOverrides,
        unknown
      >,
    ) => TRPCMiddlewareBuilder<TContext, TMeta, $ContextOverrides, unknown>;
  },
  allowed: Role | Role[],
): {
  middleware: TRPCMiddlewareBuilder<
    TContext,
    TMeta,
    { session: UserSession },
    unknown
  >;
} {
  const middleware = t.middleware<{ session: UserSession }>(
    async ({ ctx, next }) => {
      const session = assertRole(ctx.session, allowed);
      return next({ ctx: { session } });
    },
  );
  return { middleware };
}
