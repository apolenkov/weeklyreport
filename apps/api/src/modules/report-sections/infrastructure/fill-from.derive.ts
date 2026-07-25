// Pure row-mappers and predicates behind
// LeadFormPrismaRepository.fillFromSection. No Prisma import: these build the
// plain createMany payloads and the carry/remap decisions, leaving the
// transaction/lock-order/CAS/P2002 handling in the repository method.

// planned/postponed → in_progress when next flips to current (same as carry-over).
export function remapNextToCurrentStatus<WF extends string>(
  status: WF,
): WF | "in_progress" {
  return status === "planned" || status === "postponed"
    ? "in_progress"
    : status;
}

// Carry only if product-parented or activity still on target (XOR CHECK).
/**
 * Is Carryable.
 * @param row - The row argument.
 * @param targetActivityIds - The targetActivityIds argument.
 */
export function isCarryable(
  row: { activityId: string | null },
  targetActivityIds: ReadonlySet<string>,
): boolean {
  return row.activityId === null || targetActivityIds.has(row.activityId);
}

interface SourceItem<WF extends string> {
  projectId: string | null;
  activityId: string | null;
  text: string;
  tag: string;
  workflowStatus: WF;
  stageNames: string[];
}

export function toFilledItemRows<WF extends string>(
  sourceRows: readonly SourceItem<WF>[],
  targetSectionId: string,
) {
  return sourceRows.map((i) => ({
    reportSectionId: targetSectionId,
    projectId: i.projectId,
    activityId: i.activityId,
    type: "current" as const,
    text: i.text,
    tag: i.tag,
    workflowStatus: remapNextToCurrentStatus(i.workflowStatus),
    carriedOver: false,
    stageNames: i.stageNames,
  }));
}

interface SourceRisk {
  projectId: string | null;
  activityId: string | null;
  risk: string;
  impact: string;
  mitigation: string;
  severity: string;
  stageNames: string[];
}

/**
 * To Filled Risk Rows.
 * @param sourceRows - The sourceRows argument.
 * @param targetSectionId - The targetSectionId argument.
 */
export function toFilledRiskRows(
  sourceRows: readonly SourceRisk[],
  targetSectionId: string,
) {
  return sourceRows.map((r) => ({
    reportSectionId: targetSectionId,
    projectId: r.projectId,
    activityId: r.activityId,
    risk: r.risk,
    impact: r.impact,
    mitigation: r.mitigation,
    severity: r.severity,
    stageNames: r.stageNames,
  }));
}

interface SourceDecision {
  text: string;
  owner: string;
  deadline: Date | null;
  impact: string;
  resolvedAt: Date | null;
  stageNames: string[];
  productId: string | null;
  activityId: string | null;
}

/**
 * To Filled Decision Rows.
 * @param sourceRows - The sourceRows argument.
 * @param targetSectionId - The targetSectionId argument.
 */
export function toFilledDecisionRows(
  sourceRows: readonly SourceDecision[],
  targetSectionId: string,
) {
  return sourceRows.map((d) => ({
    reportSectionId: targetSectionId,
    text: d.text,
    owner: d.owner,
    deadline: d.deadline,
    impact: d.impact,
    resolvedAt: d.resolvedAt,
    stageNames: d.stageNames,
    productId: d.productId,
    activityId: d.activityId,
  }));
}
