import {
  projectActivityArchiveSchema,
  projectActivityCreateSchema,
  projectActivityLeadEdgeSchema,
  projectActivityUpdateSchema,
} from "@customreport/shared";

import type { ProjectActivityService } from "../../../modules/project-activity/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { adminProcedure, router } from "../trpc.middleware.js";

export interface ProjectActivityRouterDeps {
  projectActivityService: ProjectActivityService;
}

// Stage-less, group-scoped reporting units beside products — deliberately
// not under activity.* (that namespace is the live-status feed). Attachment
// and reference validation live in ProjectActivityService.

// Every procedure funnels domain failures through one mapper so the router stays
// a thin binding layer; each leaf still names `adminProcedure` literally, which
// the role-coverage gate matches by reference identity.
async function mapErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw mapDomainError(error);
  }
}

/**
 * Create Project Activity Router.
 * @param deps - The deps argument.
 */
export function createProjectActivityRouter(deps: ProjectActivityRouterDeps) {
  return router({
    list: adminProcedure.query(() =>
      mapErrors(() => deps.projectActivityService.list()),
    ),

    create: adminProcedure
      .input(projectActivityCreateSchema)
      .mutation(({ input }) =>
        mapErrors(() => deps.projectActivityService.create(input)),
      ),

    update: adminProcedure
      .input(projectActivityUpdateSchema)
      .mutation(({ input }) =>
        mapErrors(() => deps.projectActivityService.update(input)),
      ),

    archive: adminProcedure
      .input(projectActivityArchiveSchema)
      .mutation(({ input }) =>
        mapErrors(() => deps.projectActivityService.archive(input)),
      ),

    attachLead: adminProcedure
      .input(projectActivityLeadEdgeSchema)
      .mutation(({ input }) =>
        mapErrors(async () => {
          await deps.projectActivityService.attachLead(input);
          return { success: true as const };
        }),
      ),

    detachLead: adminProcedure
      .input(projectActivityLeadEdgeSchema)
      .mutation(({ input }) =>
        mapErrors(async () => {
          await deps.projectActivityService.detachLead(input);
          return { success: true as const };
        }),
      ),
  });
}
