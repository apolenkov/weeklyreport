import {
  projectActivityArchiveSchema,
  projectActivityCreateSchema,
  projectActivityLeadEdgeSchema,
  projectActivityUpdateSchema,
} from "@customreport/shared";

import type { ProjectActivityService } from "../../../modules/project-activity/index.js";
import { withDomainErrorMapping } from "../trpc.error-mapper.js";
import { adminProcedure, router } from "../trpc.middleware.js";

export interface ProjectActivityRouterDeps {
  readonly projectActivityService: ProjectActivityService;
}

// Stage-less, group-scoped reporting units beside products — deliberately
// not under activity.* (that namespace is the live-status feed). Attachment
// and reference validation live in ProjectActivityService.

export function createProjectActivityRouter(deps: ProjectActivityRouterDeps) {
  return router({
    list: adminProcedure.query(() =>
      withDomainErrorMapping(() => deps.projectActivityService.list()),
    ),

    create: adminProcedure
      .input(projectActivityCreateSchema)
      .mutation(({ input }) =>
        withDomainErrorMapping(() => deps.projectActivityService.create(input)),
      ),

    update: adminProcedure
      .input(projectActivityUpdateSchema)
      .mutation(({ input }) =>
        withDomainErrorMapping(() => deps.projectActivityService.update(input)),
      ),

    archive: adminProcedure
      .input(projectActivityArchiveSchema)
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          deps.projectActivityService.archive(input),
        ),
      ),

    attachLead: adminProcedure
      .input(projectActivityLeadEdgeSchema)
      .mutation(({ input }) =>
        withDomainErrorMapping(async () => {
          await deps.projectActivityService.attachLead(input);
          return { success: true as const };
        }),
      ),

    detachLead: adminProcedure
      .input(projectActivityLeadEdgeSchema)
      .mutation(({ input }) =>
        withDomainErrorMapping(async () => {
          await deps.projectActivityService.detachLead(input);
          return { success: true as const };
        }),
      ),
  });
}
