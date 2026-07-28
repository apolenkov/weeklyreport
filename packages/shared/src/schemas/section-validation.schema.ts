import type {
  DraftSaveInput,
  ProjectReadModel,
  ReportSectionReadModel,
  SubmitSectionInput,
  SubmitSectionPayload,
} from "./section.schema";
import { normalizeStageName, stageNamesMatch } from "./stage-names";

export type DraftSaveValidationErrorCode =
  | "SECTION_ALREADY_SUBMITTED"
  | "MISSING_TRAFFIC_LIGHT"
  | "MISSING_CURRENT_ITEM"
  // A child-row create tripped a unique constraint (P2002) — a malformed
  // payload (e.g. duplicate projectId). Surfaced as BAD_REQUEST, not a 500.
  | "DUPLICATE_CHILD_ROW"
  // A new or changed item/risk/decision row carries a stage the section
  // author does not own on that row's product.
  | "STAGE_NOT_OWNED"
  // The activity-status slice carries an activityId that is not attached/seeded
  // for the section author — the client payload is never trusted for ids.
  | "ACTIVITY_NOT_ATTACHED"
  // The payload drops (or rewrites the stableId of) an item/decision whose
  // lineage appeared in a published report. A published позиция can be
  // resolved (done) or carried forward, never deleted.
  | "PUBLISHED_RECORD_LOCKED";

export interface DraftSaveValidationError {
  code: DraftSaveValidationErrorCode;
  message: string;
}

// Submit-time completeness for one product: a traffic light and at least one
// Current Week item. Neither is expressible in the payload schema, which cannot
// see which products the section carries.
function validateProjectSubmission(
  project: ProjectReadModel,
  input: SubmitSectionInput | SubmitSectionPayload,
): DraftSaveValidationError[] {
  const matchingStatus = input.projectStatuses.find(
    (status) => status.projectId === project.projectId,
  );

  const hasCurrentItem = input.items.some(
    (item) => item.projectId === project.projectId && item.type === "current",
  );

  return [
    ...(!matchingStatus?.status
      ? [
          {
            code: "MISSING_TRAFFIC_LIGHT" as const,
            message: `Project ${project.projectName} must have a traffic light status.`,
          },
        ]
      : []),
    ...(!hasCurrentItem
      ? [
          {
            code: "MISSING_CURRENT_ITEM" as const,
            message: `Project ${project.projectName} needs at least one Current Week item.`,
          },
        ]
      : []),
  ];
}

/**
 * Validate a section submit payload against draft completeness rules.
 * @param section - Server read model supplying the projects and activities
 *   the author must cover.
 * @param input - Payload under validation; the tRPC input and the applied
 *   payload shapes are both accepted.
 */
export function validateSubmitInput(
  section: ReportSectionReadModel,
  input: SubmitSectionInput | SubmitSectionPayload,
): DraftSaveValidationError[] {
  if (section.status === "submitted") {
    return [
      {
        code: "SECTION_ALREADY_SUBMITTED",
        message: "Section has already been submitted.",
      },
    ];
  }

  const projectErrors = section.projects.flatMap((project) =>
    validateProjectSubmission(project, input),
  );

  // Activities need a traffic light at submit; schema alone cannot catch an omitted entry.
  const activityErrors = section.activities.flatMap((activity) => {
    const matchingStatus = (input.activityStatuses ?? []).find(
      (status) => status.activityId === activity.activityId,
    );

    return matchingStatus?.status
      ? []
      : [
          {
            code: "MISSING_TRAFFIC_LIGHT" as const,
            message: `Activity ${activity.activityName} must have a traffic light status.`,
          },
        ];
  });

  return [...projectErrors, ...activityErrors];
}

/**
 * Reject activity-parented draft rows whose activityId is not seeded on the section.
 * Product-parented rows (null activityId) are out of scope here.
 * @param section - Server read model whose `activities` are the only ids the
 *   author may reference.
 * @param input - Payload whose item, risk and decision rows are checked.
 */
export function validateRecordActivityIds(
  section: ReportSectionReadModel,
  input: DraftSaveInput | SubmitSectionInput,
): DraftSaveValidationError[] {
  const seededIds = new Set(
    section.activities.map((activity) => activity.activityId),
  );
  const check = (
    activityId: string | null | undefined,
  ): DraftSaveValidationError[] =>
    activityId == null || seededIds.has(activityId)
      ? []
      : [
          {
            code: "ACTIVITY_NOT_ATTACHED" as const,
            message:
              "Activity is not attached to you for this section. Contact an admin to change activity attachments.",
          },
        ];
  return [
    ...input.items.flatMap((row) => check(row.activityId)),
    ...input.risks.flatMap((row) => check(row.activityId)),
    ...input.decisions.flatMap((row) => check(row.activityId)),
  ];
}

/**
 * Reject activityStatuses entries whose activityId is not seeded on the section.
 * @param section - Server read model whose `activities` are the only ids the
 *   author may reference.
 * @param input - Payload whose `activityStatuses` entries are checked.
 */
export function validateActivityStatuses(
  section: ReportSectionReadModel,
  input: DraftSaveInput | SubmitSectionInput,
): DraftSaveValidationError[] {
  const seededIds = new Set(
    section.activities.map((activity) => activity.activityId),
  );
  return input.activityStatuses.flatMap((status) =>
    seededIds.has(status.activityId)
      ? []
      : [
          {
            code: "ACTIVITY_NOT_ATTACHED" as const,
            message:
              "Activity is not attached to you for this section. Contact an admin to change activity attachments.",
          },
        ],
  );
}

// A normalized view of one stage-bearing child row (item / risk / decision)
// used by the ownership guard. `projectId` is a decision's `productId`
// (undefined when department-scoped).
interface StageOwnershipRow {
  readonly stableId?: string;
  readonly projectId: string | undefined;
  readonly stageNames: readonly string[];
}

const toRow = (
  stableId: string | undefined,
  projectId: string | undefined,
  stageNames: readonly string[] | undefined,
): StageOwnershipRow => ({ stableId, projectId, stageNames: stageNames ?? [] });

// The stage names the SECTION AUTHOR owns on a row's product. `ownedStages` is
// server-authoritative (StageAssignment-derived); an undefined projectId (a
// department-scoped decision) unions the owned stages across every project.
function authorOwnedStages(
  section: ReportSectionReadModel,
  projectId: string | undefined,
): string[] {
  const scoped =
    projectId === undefined
      ? section.projects
      : section.projects.filter((project) => project.projectId === projectId);
  return scoped.flatMap((project) =>
    (project.ownedStages ?? []).map((stage) => stage.stageName),
  );
}

// Order-independent canonical key for a row's stage set (Dev↔Development folded),
// so a grandfather match compares stage CONTENT, not element order.
const canonicalStageKey = (stageNames: readonly string[]): string =>
  [...stageNames]
    .map(normalizeStageName)
    .sort((a, b) => a.localeCompare(b))
    .join("|");

// Grandfather only on stableId + product + exact stage set; id alone is client-authoritative.
function isGrandfathered(
  row: StageOwnershipRow,
  serverByStableId: Map<string, StageOwnershipRow>,
): boolean {
  if (row.stableId === undefined) return false;
  const serverRow = serverByStableId.get(row.stableId);
  return (
    serverRow !== undefined &&
    serverRow.projectId === row.projectId &&
    canonicalStageKey(serverRow.stageNames) ===
      canonicalStageKey(row.stageNames)
  );
}

function stageNotOwnedMessage(
  stage: string,
  section: ReportSectionReadModel,
  projectId: string | undefined,
): string {
  const productName =
    section.projects.find((project) => project.projectId === projectId)
      ?.projectName ??
    section.referencedProjects?.find(
      (project) => project.projectId === projectId,
    )?.projectName;
  const where = productName ? ` on ${productName}` : "";
  return `Stage "${stage}" is not one you own${where}. Contact an admin to change your stage assignments.`;
}

function validateStageRows(
  payloadRows: readonly StageOwnershipRow[],
  serverRows: readonly StageOwnershipRow[],
  section: ReportSectionReadModel,
): DraftSaveValidationError[] {
  const serverByStableId = new Map(
    serverRows.flatMap((row) =>
      row.stableId === undefined ? [] : [[row.stableId, row] as const],
    ),
  );
  return payloadRows.flatMap((row) => {
    if (isGrandfathered(row, serverByStableId)) return [];
    const owned = authorOwnedStages(section, row.projectId);
    const offending = row.stageNames.find(
      (stage) => !owned.some((own) => stageNamesMatch(own, stage)),
    );
    return offending === undefined
      ? []
      : [
          {
            code: "STAGE_NOT_OWNED" as const,
            message: stageNotOwnedMessage(offending, section, row.projectId),
          },
        ];
  });
}

/**
 * Stage ownership for saveDraft/submit: changed rows need author-owned stages;
 * unchanged stableId+product+stages rows are grandfathered (never clamps).
 * @param section - Server-authoritative read model: owned stages plus the
 *   stored rows a payload row is compared against for grandfathering.
 * @param input - Payload whose item, risk and decision stages are checked.
 */
export function validateStageOwnership(
  section: ReportSectionReadModel,
  input: DraftSaveInput | SubmitSectionInput,
): DraftSaveValidationError[] {
  return [
    ...validateStageRows(
      input.items.map((r) =>
        toRow(r.stableId, r.projectId ?? undefined, r.stageNames),
      ),
      section.items.map((r) =>
        toRow(r.stableId, r.projectId ?? undefined, r.stageNames),
      ),
      section,
    ),
    ...validateStageRows(
      input.risks.map((r) =>
        toRow(r.stableId, r.projectId ?? undefined, r.stageNames),
      ),
      section.risks.map((r) =>
        toRow(r.stableId, r.projectId ?? undefined, r.stageNames),
      ),
      section,
    ),
    ...validateStageRows(
      input.decisions.map((r) =>
        toRow(r.stableId, r.productId ?? undefined, r.stageNames),
      ),
      section.decisions.map((r) =>
        toRow(r.stableId, r.productId ?? undefined, r.stageNames),
      ),
      section,
    ),
  ];
}
