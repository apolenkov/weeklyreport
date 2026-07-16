import {
  adminProjectSchema,
  groupProductEdgeInputSchema,
  reportingGroupSchema,
} from "@customreport/shared";
import { z } from "zod";

import type { ProjectAdminService } from "../../../../modules/admin/index.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import { adminProcedure } from "../../trpc.middleware.js";

export interface AdminCatalogDeps {
  projectAdminService: ProjectAdminService;
}

export function createAdminCatalogProcedures(deps: AdminCatalogDeps) {
  return {
    saveReportingGroup: adminProcedure
      .input(reportingGroupSchema)
      .mutation(async ({ input }) => {
        try {
          return await deps.projectAdminService.upsertReportingGroup(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    archiveReportingGroup: adminProcedure
      .input(z.object({ groupId: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          return await deps.projectAdminService.archiveReportingGroup(
            input.groupId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    saveProject: adminProcedure
      .input(adminProjectSchema)
      .mutation(async ({ input }) => {
        try {
          return await deps.projectAdminService.upsertProject(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    deleteProject: adminProcedure
      .input(z.object({ projectId: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          return await deps.projectAdminService.removeProject(input.projectId);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    saveStageAssignment: adminProcedure
      .input(
        z.object({
          userId: z.uuid(),
          stageId: z.uuid(),
          projectId: z.uuid(),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await deps.projectAdminService.saveStageAssignment(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    deleteStageAssignment: adminProcedure
      .input(z.object({ id: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          return await deps.projectAdminService.deleteStageAssignment(input.id);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    listStageAssignments: adminProcedure
      .input(z.object({ projectId: z.uuid() }))
      .query(async ({ input }) => {
        try {
          return await deps.projectAdminService.listStageAssignments(
            input.projectId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    // Full SDLC stage catalogue. Used by the Stage Assignment editor so it
    // can render *every* stage (including unassigned ones), not just the
    // stages that already have an assignment row for the project.
    listStages: adminProcedure.query(async () => {
      try {
        return await deps.projectAdminService.listStages();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

    // Per-project assignment count for the products-tab "X/7 stages"
    // header. Light query (single GROUP BY) so we can render the count
    // without loading every assignment row.
    listStageAssignmentCounts: adminProcedure.query(async () => {
      try {
        return await deps.projectAdminService.listStageAssignmentCounts();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

    // -----------------------------------------------------------------
    // Explicit Group ↔ Product M:M surface.
    //
    // Mutations are idempotent (attach upserts on the unique tuple;
    // detach uses deleteMany so a double-click is harmless). Reads are
    // straight findMany joins ordered by name. All four procedures are
    // gated by adminProcedure — head/admin only, like saveProject and
    // saveReportingGroup. The generic mutationAuditMiddleware captures
    // the {procedure, targetId} envelope; no dedicated audit event is
    // emitted yet (consistent with saveProject — added later only if
    // SIEM needs the split).
    // -----------------------------------------------------------------

    attachProductToGroup: adminProcedure
      .input(groupProductEdgeInputSchema)
      .mutation(async ({ input }) => {
        try {
          return await deps.projectAdminService.attachProductToGroup(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    detachProductFromGroup: adminProcedure
      .input(groupProductEdgeInputSchema)
      .mutation(async ({ input }) => {
        try {
          return await deps.projectAdminService.detachProductFromGroup(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    listGroupProducts: adminProcedure
      .input(z.object({ groupId: z.uuid() }))
      .query(async ({ input }) => {
        try {
          return await deps.projectAdminService.listGroupProducts(
            input.groupId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    listProductGroups: adminProcedure
      .input(z.object({ productId: z.uuid() }))
      .query(async ({ input }) => {
        try {
          return await deps.projectAdminService.listProductGroups(
            input.productId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    // Batched owning-group lookup: one query resolves the owning group for
    // every requested product, so the "products attached" editor no longer
    // fans out one listProductGroups call per active product.
    listProductGroupOwnership: adminProcedure
      .input(z.object({ productId: z.array(z.uuid()) }))
      .query(async ({ input }) => {
        try {
          return await deps.projectAdminService.listProductGroupOwnership(
            input.productId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  };
}
