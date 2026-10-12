import { searchQueryInputSchema } from "@customreport/shared";
import { TRPCError } from "@trpc/server";

import {
  SearchAuthorizationError,
  type SearchService,
} from "../../../modules/search/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { protectedProcedure, router } from "../trpc.middleware.js";

export interface SearchRouterDeps {
  searchService: SearchService;
}

// Service applies role/scope authorization via SearchAuthorizationError →
// FORBIDDEN; protectedProcedure is enough because the service is the authz gate.

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
              resourceId: "search.query",
            });
            throw new TRPCError({
              code: "FORBIDDEN",
              message: error.message,
              cause: error,
            });
          }
          throw mapDomainError(error);
        }
      }),
  });
}
