import type {
  ProjectActivity,
  ProjectActivityArchiveInput,
  ProjectActivityCreateInput,
  ProjectActivityLeadEdge,
  ProjectActivityUpdateInput,
} from "@weeklyreport/shared";

import { ProjectActivityNotFoundError } from "./project-activity.errors.js";
export {
  ProjectActivityDomainError,
  ProjectActivityNotFoundError,
} from "./project-activity.errors.js";

export interface ProjectActivityRepository {
  list(): Promise<readonly ProjectActivity[]>;
  findById(activityId: string): Promise<ProjectActivity | null>;
  create(input: {
    name: string;
    groupId: string;
    linkedProductIds: readonly string[];
    jiraAccounts: readonly string[];
  }): Promise<ProjectActivity>;
  update(input: {
    id: string;
    name: string;
    groupId: string;
    linkedProductIds: readonly string[];
    jiraAccounts: readonly string[];
  }): Promise<ProjectActivity>;
  setArchived(activityId: string, archived: boolean): Promise<ProjectActivity>;
  attachLead(edge: ProjectActivityLeadEdge): Promise<void>;
  detachLead(edge: ProjectActivityLeadEdge): Promise<void>;
  groupExists(groupId: string): Promise<boolean>;
  findExistingProductIds(
    productIds: readonly string[],
  ): Promise<readonly string[]>;
}

// projectActivity.* is admin provisioning; activity.* is the live-status feed
// and must not be reused. Attachment is group-constrained at write so the
// per-period read path needs no group filter.
export class ProjectActivityService {
  constructor(private readonly repository: ProjectActivityRepository) {}

  list(): Promise<readonly ProjectActivity[]> {
    return this.repository.list();
  }

  async create(input: ProjectActivityCreateInput): Promise<ProjectActivity> {
    await this.assertReferencesExist(input.groupId, input.linkedProductIds);
    return this.repository.create({
      name: input.name,
      groupId: input.groupId,
      linkedProductIds: input.linkedProductIds,
      jiraAccounts: input.jiraAccounts,
    });
  }

  async update(input: ProjectActivityUpdateInput): Promise<ProjectActivity> {
    await this.assertReferencesExist(input.groupId, input.linkedProductIds);
    return this.repository.update({
      id: input.id,
      name: input.name,
      groupId: input.groupId,
      linkedProductIds: input.linkedProductIds,
      jiraAccounts: input.jiraAccounts,
    });
  }

  async archive(input: ProjectActivityArchiveInput): Promise<ProjectActivity> {
    await this.getExisting(input.id);
    return this.repository.setArchived(input.id, input.archived);
  }

  async attachLead(edge: ProjectActivityLeadEdge): Promise<void> {
    await this.repository.attachLead(edge);
  }

  async detachLead(edge: ProjectActivityLeadEdge): Promise<void> {
    await this.getExisting(edge.activityId);
    // The repository also deletes the lead's ActivityStatus rows on editable
    // periods, so a re-fetched form saves cleanly. An in-flight save with the
    // stale activityId fails loudly (ACTIVITY_NOT_ATTACHED) — fail-closed by design.
    await this.repository.detachLead(edge);
  }

  private async getExisting(activityId: string): Promise<ProjectActivity> {
    const activity = await this.repository.findById(activityId);
    if (!activity) {
      throw new ProjectActivityNotFoundError(
        `Project activity ${activityId} was not found.`,
      );
    }
    return activity;
  }

  private async assertReferencesExist(
    groupId: string,
    linkedProductIds: readonly string[],
  ): Promise<void> {
    if (!(await this.repository.groupExists(groupId))) {
      throw new ProjectActivityNotFoundError(
        `Reporting group ${groupId} was not found.`,
      );
    }
    // Every linked product must exist — a stale id in the multi-select must
    // fail loud, never silently drop the link on reconcile.
    const existingProductIds = new Set(
      await this.repository.findExistingProductIds(linkedProductIds),
    );
    const missingId = linkedProductIds.find(
      (productId) => !existingProductIds.has(productId),
    );
    if (missingId !== undefined) {
      throw new ProjectActivityNotFoundError(
        `Product ${missingId} was not found.`,
      );
    }
  }
}
