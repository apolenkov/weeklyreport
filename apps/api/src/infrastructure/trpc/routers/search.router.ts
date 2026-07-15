import { searchQueryInputSchema } from "@customreport/shared";
import { TRPCError } from "@trpc/server";

import {
  SearchAuthorizationError,
  type SearchService,
} from "../../../modules/search/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { protectedProcedure, router } from "../trpc.middleware.js";

export interface SearchRouterDeps {
  /**
   * Full-text search across Item / Risk / Decision
   * / Project. tsvector + GIN, Russian text-search config. Role-gated
   * scope via SearchAuthorizationError → FORBIDDEN.
   */
  searchService: SearchService;
}

// Full-text search across Item / Risk / Decision / Project. The service
// layer validates the input and gates `scope='all'` to head/admin via
// SearchAuthorizationError; the router maps that to FORBIDDEN.
//
// protectedProcedure (any authenticated user) is the right baseline:
// every authenticated session can search their own content
// (`scope='mine'`); the role check inside the service is the gate that
// matters. anyRoleProcedure would be equivalent here but the simpler
// protectedProcedure mirrors the rest of the search-style read paths.

export function createSearchRouter(deps: SearchRouterDeps) {
  return router({
    query: protectedProcedure
      .input(searchQueryInputSchema)
      .query(async ({ input, ctx }) => {
        try {
          return await deps.searchService.query(input, ctx.session);
        } catch (error) {
          if (error instanceof SearchAuthorizationError) {
            ctx.auditLogger.scopeDenied({
              userId: ctx.session.userId,
              role: ctx.session.role,
              ip: ctx.ip,
              attemptedScope: "search",
              resourceId: input.q,
            });
            throw new TRPCError({
              code: "FORBIDDEN",
              message: error.message,
            });
          }
          throw mapDomainError(error);
        }
      }),
  });
}
