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

  async saveStageAssignment(data: {
    userId: string;
    stageId: string;
    projectId: string;
  }): Promise<StageAssignment> {
    return stageAssignmentSchema.parse(
      await this.repository.saveStageAssignment(data),
    );
  }

  async deleteStageAssignment(id: string): Promise<{ success: true }> {
    await this.repository.deleteStageAssignment(id);
    return { success: true };
  }

  async listStageAssignments(projectId: string): Promise<StageAssignment[]> {
    const rows = await this.repository.listStageAssignments(projectId);
    return rows.map((r) => stageAssignmentSchema.parse(r));
  }

  // Unique-tuple upsert keeps UI double-clicks idempotent.
  async attachProductToGroup(
    input: GroupProductEdgeInput,
  ): Promise<GroupProduct> {
    this.logger.info("attached product to group", input);
    return groupProductSchema.parse(
      await this.repository.attachProductToGroup(input),
    );
  }

  // No-op when the edge is already absent.
  async detachProductFromGroup(
    input: GroupProductEdgeInput,
  ): Promise<{ success: true }> {
    this.logger.info("detached product from group", input);
    await this.repository.detachProductFromGroup(input);
    return { success: true };
  }

  // AdminProject shape so the UI reuses project rows without a second snapshot.
  async listGroupProducts(groupId: string): Promise<AdminProject[]> {
    const rows = await this.repository.listGroupProducts(groupId);
    return rows.map((row) => adminProjectSchema.parse(row));
  }

  async listProductGroups(productId: string): Promise<ReportingGroup[]> {
    const rows = await this.repository.listProductGroups(productId);
    return rows.map((row) => reportingGroupSchema.parse(row));
  }

  // One query for the catalog editor instead of per-product listProductGroups.
  async listProductGroupOwnership(
    productIds: readonly string[],
  ): Promise<ProductGroupOwnership[]> {
    return this.repository.listProductGroupOwnership(productIds);
  }

  // Full catalogue including unassigned stages.
  listStages(): Promise<StageRow[]> {
    return this.repository.listStages();
  }

  // GROUP BY only — products-tab header without loading every assignment.
  listStageAssignmentCounts(): Promise<StageAssignmentCountRow[]> {
    return this.repository.listStageAssignmentCounts();
  }
}
