import type { OrganizationService } from "../../../modules/organization/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { publicProcedure, router } from "../trpc.middleware.js";

export interface OrganizationRouterDeps {
  /**
   * Organization identity surface.
   *  - `org.getPublic` (publicProcedure) reads shortName/fullName for the
   *    anonymous landing hero.
   *  - `admin.getOrganization` / `admin.updateOrganization` manage the
   *    singleton row from the Settings → Identity tab.
   */
  organizationService: OrganizationService;
}

// Public read-only surface for the anonymous landing page. Returns
// only the `{ shortName, fullName }` pair — no timestamps, no ids —
// so future schema fields cannot leak unintentionally to the public.

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
