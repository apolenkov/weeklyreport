import {
  adminProjectSchema,
  groupProductEdgeInputSchema,
  reportingGroupSchema,
} from "@weeklyreport/shared";
import { z } from "zod";

import type { ProjectAdminService } from "../../../../modules/admin/index.js";
import { withDomainErrorMapping } from "../../trpc.error-mapper.js";
import {
  adminProcedure,
  captureMutationAuditInputMiddleware,
} from "../../trpc.middleware.js";

export interface AdminCatalogDeps {
  readonly projectAdminService: ProjectAdminService;
}

function reportingGroupProcedures(deps: AdminCatalogDeps) {
  return {
    saveReportingGroup: adminProcedure
      .input(reportingGroupSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          deps.projectAdminService.upsertReportingGroup(input),
        ),
      ),

    archiveReportingGroup: adminProcedure
      .input(z.object({ groupId: z.uuid() }))
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          deps.projectAdminService.archiveReportingGroup(input.groupId),
        ),
      ),
  };
}

function projectProcedures(deps: AdminCatalogDeps) {
  return {
    saveProject: adminProcedure
      .input(adminProjectSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          deps.projectAdminService.upsertProject(input),
        ),
      ),

    deleteProject: adminProcedure
      .input(z.object({ projectId: z.uuid() }))
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          deps.projectAdminService.removeProject(input.projectId),
        ),
      ),
  };
}

function stageAssignmentProcedures(deps: AdminCatalogDeps) {
  return {
    saveStageAssignment: adminProcedure
      .input(
        z.object({
          userId: z.uuid(),
          stageId: z.uuid(),
          projectId: z.uuid(),
        }),
      )
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          deps.projectAdminService.saveStageAssignment(input),
        ),
      ),

    deleteStageAssignment: adminProcedure
      .input(z.object({ id: z.uuid() }))
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          deps.projectAdminService.deleteStageAssignment(input.id),
        ),
      ),

    listStageAssignments: adminProcedure
      .input(z.object({ projectId: z.uuid() }))
      .query(({ input }) =>
        withDomainErrorMapping(() =>
          deps.projectAdminService.listStageAssignments(input.projectId),
        ),
      ),

    // Full SDLC stage catalogue. Used by the Stage Assignment editor so it
    // can render *every* stage (including unassigned ones), not just the
    // stages that already have an assignment row for the project.
    listStages: adminProcedure.query(() =>
      withDomainErrorMapping(() => deps.projectAdminService.listStages()),
    ),

    // Per-project assignment count for the products-tab "X/7 stages"
    // header. Light query (single GROUP BY) so we can render the count
    // without loading every assignment row.
    listStageAssignmentCounts: adminProcedure.query(() =>
      withDomainErrorMapping(() =>
        deps.projectAdminService.listStageAssignmentCounts(),
      ),
    ),
  };
}

// Group↔Product edges: attach upserts / detach deleteMany so double-click
// is harmless. Generic mutation audit only (no dedicated SIEM event).
function groupProductEdgeProcedures(deps: AdminCatalogDeps) {
  return {
    attachProductToGroup: adminProcedure
      .input(groupProductEdgeInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          deps.projectAdminService.attachProductToGroup(input),
        ),
      ),

    detachProductFromGroup: adminProcedure
      .input(groupProductEdgeInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          deps.projectAdminService.detachProductFromGroup(input),
        ),
      ),

    listGroupProducts: adminProcedure
      .input(z.object({ groupId: z.uuid() }))
      .query(({ input }) =>
        withDomainErrorMapping(() =>
          deps.projectAdminService.listGroupProducts(input.groupId),
        ),
      ),

    listProductGroups: adminProcedure
      .input(z.object({ productId: z.uuid() }))
      .query(({ input }) =>
        withDomainErrorMapping(() =>
          deps.projectAdminService.listProductGroups(input.productId),
        ),
      ),

    // Batched owning-group lookup: one query resolves the owning group for
    // every requested product, so the "products attached" editor no longer
    // fans out one listProductGroups call per active product.
    listProductGroupOwnership: adminProcedure
      .input(z.object({ productIds: z.array(z.uuid()) }))
      .query(({ input }) =>
        withDomainErrorMapping(() =>
          deps.projectAdminService.listProductGroupOwnership(input.productIds),
        ),
      ),
  };
}

export function createAdminCatalogProcedures(deps: AdminCatalogDeps) {
  return {
    ...reportingGroupProcedures(deps),
    ...projectProcedures(deps),
    ...stageAssignmentProcedures(deps),
    ...groupProductEdgeProcedures(deps),
  };
}
