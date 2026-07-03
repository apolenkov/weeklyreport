import type {
  ProjectActivity,
  ProjectActivityArchiveInput,
  ProjectActivityCreateInput,
  ProjectActivityLeadEdge,
  ProjectActivityUpdateInput,
} from "@customreport/shared";

/** A referenced activity / group / product / lead does not exist. */
export class ProjectActivityNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectActivityNotFoundError";
  }
}

/** A business-rule violation on the admin write path (→ BAD_REQUEST). */
export class ProjectActivityDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectActivityDomainError";
  }
}

export interface ProjectActivityRepository {
  list(): Promise<ProjectActivity[]>;
  findById(activityId: string): Promise<ProjectActivity | null>;
  create(input: {
    name: string;
    groupId: string;
    linkedProductIds: string[];
    jiraAccounts: string[];
  }): Promise<ProjectActivity>;
  update(input: {
    id: string;
    name: string;
    groupId: string;
    linkedProductIds: string[];
    jiraAccounts: string[];
  }): Promise<ProjectActivity>;
  setArchived(activityId: string, archived: boolean): Promise<ProjectActivity>;
  attachLead(edge: ProjectActivityLeadEdge): Promise<void>;
  detachLead(edge: ProjectActivityLeadEdge): Promise<void>;
  groupExists(groupId: string): Promise<boolean>;
  productExists(productId: string): Promise<boolean>;
  getLeadContext(
    leadId: string,
  ): Promise<{ role: string; reportingGroupId: string | null } | null>;
}

/**
 * Admin provisioning of Project Activities — the stage-less reporting units
 * beside products. Exposed as the `projectActivity.*` tRPC namespace (the
 * `activity.*` namespace is the live-status feed and must not be reused).
 * Attachment is constrained to the activity's authoritative group at write:
 * only a lead whose reporting group matches `activity.groupId` can be attached,
 * so the per-period read path never needs its own group filter.
 */
export class ProjectActivityService {
  constructor(private readonly repository: ProjectActivityRepository) {}

  list(): Promise<ProjectActivity[]> {
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
    const existing = await this.getExisting(input.id);
    // Attachment is validated against the activity's group at attach time
    // (lead.reportingGroupId === activity.groupId). Moving the activity to
    // another group while leads are attached would silently strand those
    // attachments outside the constraint — reject; the admin detaches every
    // lead first, then moves.
    if (input.groupId !== existing.groupId && existing.leadIds.length > 0) {
      throw new ProjectActivityDomainError(
        "Detach all leads before moving the activity to another group.",
      );
    }
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
    const activity = await this.getExisting(edge.activityId);
    if (activity.archived) {
      throw new ProjectActivityDomainError(
        "Cannot attach a lead to an archived activity.",
      );
    }
    const lead = await this.repository.getLeadContext(edge.leadId);
    if (!lead) {
      throw new ProjectActivityNotFoundError(
        `Lead ${edge.leadId} was not found.`,
      );
    }
    if (lead.role !== "lead") {
      throw new ProjectActivityDomainError(
        "Only users with the lead role can be attached to an activity.",
      );
    }
    if (lead.reportingGroupId !== activity.groupId) {
      throw new ProjectActivityDomainError(
        "The lead belongs to another reporting group than this activity.",
      );
    }
    await this.repository.attachLead(edge);
  }

  async detachLead(edge: ProjectActivityLeadEdge): Promise<void> {
    await this.getExisting(edge.activityId);
    // The repository also deletes the lead's ActivityStatus rows on editable
    // (open/reopened) periods, so a re-fetched lead form no longer carries the
    // activity and saves cleanly. An IN-FLIGHT save from a form loaded before
    // the detach still carries the stale activityId and fails loudly with
    // ACTIVITY_NOT_ATTACHED — fail-closed by design; the lead reloads and
    // retries rather than silently dropping (or resurrecting) the row.
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
    const existence = await Promise.all(
      linkedProductIds.map((productId) =>
        this.repository.productExists(productId),
      ),
    );
    const missingIndex = existence.findIndex((exists) => !exists);
    if (missingIndex !== -1) {
      throw new ProjectActivityNotFoundError(
        `Product ${linkedProductIds[missingIndex]} was not found.`,
      );
    }
  }
}
