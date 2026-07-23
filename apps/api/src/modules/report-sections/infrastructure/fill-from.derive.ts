// Pure row-mappers and predicates behind
// LeadFormPrismaRepository.fillFromSection. No Prisma import: these build the
// plain createMany payloads and the carry/remap decisions, leaving the
// transaction/lock-order/CAS/P2002 handling in the repository method.

/**
 * Fill From flips next → current, so next-only statuses must land in the
 * current vocabulary (same remap as carry-over): planned/postponed →
 * in_progress, every other value passes through unchanged.
 */
export function remapNextToCurrentStatus<WF extends string>(
  status: WF,
): WF | "in_progress" {
  return status === "planned" || status === "postponed"
    ? "in_progress"
    : status;
}

/**
 * A source record carries forward only when it is product-parented (activityId
 * null → always) or its activity is still attached to the TARGET section.
 * Dropping activityId to force-carry would collapse the row to no-parent and
 * trip the XOR CHECK, aborting the whole Fill From.
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

/** Maps carryable source items to Current-Week createMany rows on the target. */
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

/** Maps carryable source risks to createMany rows on the target. */
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

/** Maps carryable source decisions to createMany rows on the target. */
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
