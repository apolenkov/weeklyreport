import type { OrganizationService } from "../../../modules/organization/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { publicProcedure, router } from "../trpc.middleware.js";

export interface OrganizationRouterDeps {
  readonly organizationService: OrganizationService;
}

// Public surface returns only shortName/fullName so future schema fields
// cannot leak to the anonymous landing page.

export function createOrganizationRouter(deps: OrganizationRouterDeps) {
  return router({
    getPublic: publicProcedure.query(async () => {
      try {
        return await deps.organizationService.getPublic();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
  });
}
