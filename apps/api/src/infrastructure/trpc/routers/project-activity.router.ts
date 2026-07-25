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

export function createProjectActivityRouter(deps: ProjectActivityRouterDeps) {
  return router({
    list: adminProcedure.query(async () => {
      try {
        return await deps.projectActivityService.list();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

    create: adminProcedure
      .input(projectActivityCreateSchema)
      .mutation(async ({ input }) => {
        try {
          return await deps.projectActivityService.create(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    update: adminProcedure
      .input(projectActivityUpdateSchema)
      .mutation(async ({ input }) => {
        try {
          return await deps.projectActivityService.update(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    archive: adminProcedure
      .input(projectActivityArchiveSchema)
      .mutation(async ({ input }) => {
        try {
          return await deps.projectActivityService.archive(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    attachLead: adminProcedure
      .input(projectActivityLeadEdgeSchema)
      .mutation(async ({ input }) => {
        try {
          await deps.projectActivityService.attachLead(input);
          return { success: true as const };
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    detachLead: adminProcedure
      .input(projectActivityLeadEdgeSchema)
      .mutation(async ({ input }) => {
        try {
          await deps.projectActivityService.detachLead(input);
          return { success: true as const };
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  });
}
