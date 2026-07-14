import {
  type AdminProject,
  adminProjectSchema,
  type AdminSnapshot,
  adminSnapshotSchema,
  type GroupProduct,
  type GroupProductEdgeInput,
  groupProductSchema,
  type ReportingGroup,
  reportingGroupSchema,
  type StageAssignment,
  stageAssignmentSchema,
} from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../lib/logger";
import type {
  AdminRepository,
  ProductGroupOwnership,
  StageAssignmentCountRow,
  StageRow,
} from "./admin-shared";

/**
 * Owns projects, reporting groups, stage assignments, and the
 * Group ↔ Product M:M surface.
 */
export class ProjectAdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: AdminRepository,
    logger?: AppLogger,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  private async getSnapshot(): Promise<AdminSnapshot> {
    return adminSnapshotSchema.parse(await this.repository.getSnapshot());
  }

  async upsertReportingGroup(group: ReportingGroup): Promise<ReportingGroup> {
    const parsedGroup = reportingGroupSchema.parse(group);
    this.logger.info("upserted reporting group", { groupId: parsedGroup.id });
    return reportingGroupSchema.parse(
      await this.repository.saveReportingGroup(parsedGroup),
    );
  }

  async archiveReportingGroup(groupId: string): Promise<ReportingGroup> {
    this.logger.info("archived reporting group", { groupId });
    return reportingGroupSchema.parse(
      await this.repository.archiveReportingGroup(groupId),
    );
  }

  async upsertProject(project: AdminProject): Promise<AdminSnapshot> {
    const parsedProject = adminProjectSchema.parse(project);
    this.logger.info("upserted project", { projectId: parsedProject.id });
    await this.repository.upsertProject(parsedProject);
    return this.getSnapshot();
  }

  async removeProject(projectId: string): Promise<AdminSnapshot> {
    await this.repository.removeProject(projectId);
    return this.getSnapshot();
  }

  /** Upsert a stage assignment (unique on stageId+projectId). */
  async saveStageAssignment(data: {
    userId: string;
    stageId: string;
    projectId: string;
  }): Promise<StageAssignment> {
    return stageAssignmentSchema.parse(
      await this.repository.saveStageAssignment(data),
    );
  }

  /** Delete a stage assignment by ID. */
  async deleteStageAssignment(id: string): Promise<{ success: true }> {
    await this.repository.deleteStageAssignment(id);
    return { success: true };
  }

  /** List stage assignments for a project. */
  async listStageAssignments(projectId: string): Promise<StageAssignment[]> {
    const rows = await this.repository.listStageAssignments(projectId);
    return rows.map((r) => stageAssignmentSchema.parse(r));
  }

  // -----------------------------------------------------------------
  // Group ↔ Product M:M surface
  // -----------------------------------------------------------------

  /**
   * Attach a Product to a ReportingGroup. The repository upserts on the
   * (groupId, productId) unique tuple so re-calls are idempotent — useful
   * for the UI toggle that may race against itself if a user clicks
   * twice. Returns the canonical {@link GroupProduct} row so the caller
   * can echo `createdAt` into the audit envelope.
   */
  async attachProductToGroup(
    input: GroupProductEdgeInput,
  ): Promise<GroupProduct> {
    if (!this.repository.attachProductToGroup) {
      throw new Error(
        "AdminRepository.attachProductToGroup is not implemented for this repository.",
      );
    }
    this.logger.info("attached product to group", input);
    return groupProductSchema.parse(
      await this.repository.attachProductToGroup(input),
    );
  }

  /**
   * Detach a Product from a ReportingGroup. No-op when the edge is
   * already absent (repository swallows the delete-not-found). Returns
   * `{ success: true }` so the tRPC mutation has a non-undefined
   * response shape that audit / toast handlers can key off.
   */
  async detachProductFromGroup(
    input: GroupProductEdgeInput,
  ): Promise<{ success: true }> {
    if (!this.repository.detachProductFromGroup) {
      throw new Error(
        "AdminRepository.detachProductFromGroup is not implemented for this repository.",
      );
    }
    this.logger.info("detached product from group", input);
    await this.repository.detachProductFromGroup(input);
    return { success: true };
  }

  /**
   * List the Products attached to a ReportingGroup via the explicit
   * `GroupProduct` edge. Used by the admin Groups tab's «Products
   * attached» section. Returns `AdminProject` rows so the UI gets the
   * existing project shape (id, name, archived, leadId, leadName)
   * without a second snapshot call.
   */
  async listGroupProducts(groupId: string): Promise<AdminProject[]> {
    if (!this.repository.listGroupProducts) return [];
    const rows = await this.repository.listGroupProducts(groupId);
    return rows.map((row) => adminProjectSchema.parse(row));
  }

  /**
   * List the ReportingGroups that own a given Product via the explicit
   * `GroupProduct` edge. Used by the admin Products tab's «Groups»
   * column. Returns full `ReportingGroup` rows so the chip renderer can
   * show the group name without a join.
   */
  async listProductGroups(productId: string): Promise<ReportingGroup[]> {
    if (!this.repository.listProductGroups) return [];
    const rows = await this.repository.listProductGroups(productId);
    return rows.map((row) => reportingGroupSchema.parse(row));
  }

  /**
   * Batched owning-group lookup for the admin Groups tab's «Products
   * attached» editor. One repository query resolves the single owning group
   * for every requested product, replacing the per-product
   * `listProductGroups` fan-out. Falls back to an empty list when the repo
   * predates the batched read, mirroring `listProductGroups`.
   */
  async listProductGroupOwnership(
    productIds: readonly string[],
  ): Promise<ProductGroupOwnership[]> {
    if (!this.repository.listProductGroupOwnership) return [];
    return this.repository.listProductGroupOwnership(productIds);
  }

  /**
   * Full SDLC stage catalogue. Used by the Stage Assignment editor so it can
   * render *every* stage (including unassigned ones), not just the stages
   * that already have an assignment row for the project.
   */
  listStages(): Promise<StageRow[]> {
    return this.repository.listStages();
  }

  /**
   * Per-project assignment count for the products-tab "X/7 stages" header.
   * Light query (single GROUP BY) so we can render the count without
   * loading every assignment row.
   */
  listStageAssignmentCounts(): Promise<StageAssignmentCountRow[]> {
    return this.repository.listStageAssignmentCounts();
  }
}
