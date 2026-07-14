import { DEFAULT_ORGANIZATION_IDENTITY } from "@customreport/shared";

import type { OrganizationService } from "../../../modules/organization/organization.service.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { publicProcedure, router } from "../trpc.middleware.js";

export interface OrganizationRouterDeps {
  /**
   * Organization identity surface.
   *  - `org.getPublic` (publicProcedure) reads shortName/fullName for the
   *    anonymous landing hero.
   *  - `admin.getOrganization` / `admin.updateOrganization` manage the
   *    singleton row from the Settings → Identity tab.
   * Optional so existing role-coverage test fixtures that build the
   * router with `{}` deps keep compiling — those tests stub the entire
   * `deps` argument and never exercise the org.* paths.
   */
  organizationService?: OrganizationService;
}

// Public read-only surface for the anonymous landing page. Returns
// only the `{ shortName, fullName }` pair — no timestamps, no ids —
// so future schema fields cannot leak unintentionally to the public.

export function createOrganizationRouter(deps: OrganizationRouterDeps) {
  return router({
    getPublic: publicProcedure.query(async () => {
      try {
        if (!deps.organizationService) {
          // Fallback for in-memory test fixtures. Generic
          // identity — the concrete tenant brand lives in the seed
          // file / admin-edited Organization row, never here.
          return DEFAULT_ORGANIZATION_IDENTITY;
        }
        return await deps.organizationService.getPublic();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
  });
}
