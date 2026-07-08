import type {
  DraftSaveInput,
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
  // lead-form-stage-access-integrity: a new or changed item/risk/decision row
  // carries a stage the section author does not own on that row's product.
  | "STAGE_NOT_OWNED"
  // The activity-status slice carries an activityId that is not attached/seeded
  // for the section author — the client payload is never trusted for ids.
  | "ACTIVITY_NOT_ATTACHED"
  // Resolve-not-delete: the payload drops (or rewrites the stableId of) an
  // item/decision whose lineage appeared in a published report. A published
  // позиция can be resolved (done) or carried forward, never deleted.
  | "PUBLISHED_RECORD_LOCKED";

export interface DraftSaveValidationError {
  code: DraftSaveValidationErrorCode;
  message: string;
}

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

  const projectErrors = section.projects.flatMap((project) => {
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
  });

  // activity-first-class: an activity has no SDLC stage and no current-item
  // requirement, but every attached activity must carry a traffic-light status at
  // submit. Server-authoritative — schema tightening alone cannot catch an
  // OMITTED attached activity (a payload that simply drops the status entry).
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
 * The record-parent activity write guard (activity-first-class, Decision 7),
 * shared by BOTH `saveDraft` and `submitSection`. Every item/risk/decision row
 * whose parent is an activity must reference an `activityId` already seeded on
 * the section for its author (`section.activities` is the reference) — the
 * delete-recreate never trusts a client-supplied id. Product-parented rows
 * (null `activityId`) are ignored here; their product is checked by the stage
 * guard. Mirrors `validateActivityStatuses` for record parents.
 * @param section - the server-loaded section read model (seeded activities)
 * @param input - the parsed draft-save / submit payload being validated
 * @returns one error per offending row; the caller hard-rejects on the first
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
 * The activity-status write guard, shared by BOTH `saveDraft` and
 * `submitSection`. Every written `activityId` must be one already seeded on the
 * section for its author (the server-loaded `section.activities` is the
 * reference) — the delete-recreate never trusts client-supplied ids, closing
 * the same client-trust gap the stage-ownership guard closes for stages.
 * @param section - the server-loaded section read model (seeded activities)
 * @param input - the parsed draft-save / submit payload being validated
 * @returns one error per offending entry; the caller hard-rejects on the first
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

// lead-form-stage-access-integrity: a normalized view of one stage-bearing
// child row (item / risk / decision) used by the ownership guard. `projectId`
// is a decision's `productId` (undefined when department-scoped).
interface StageOwnershipRow {
  readonly stableId?: string;
  readonly projectId: string | undefined;
  readonly stageIds: readonly string[];
}

const toRow = (
  stableId: string | undefined,
  projectId: string | undefined,
  stageIds: readonly string[] | undefined,
): StageOwnershipRow => ({ stableId, projectId, stageIds: stageIds ?? [] });

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
const canonicalStageKey = (stageIds: readonly string[]): string =>
  [...stageIds]
    .map(normalizeStageName)
    .sort((a, b) => a.localeCompare(b))
    .join("|");

// A row is grandfathered — skipped by the guard — only when an existing server
// row shares its stableId AND its product AND its exact stage set. stableId is
// client-authoritative, so an id match alone is NOT enough: a payload that keeps
// a stableId but swaps in an unowned stage (or moves the row to another product)
// changes the key and is re-validated.
function isGrandfathered(
  row: StageOwnershipRow,
  serverByStableId: Map<string, StageOwnershipRow>,
): boolean {
  if (row.stableId === undefined) return false;
  const serverRow = serverByStableId.get(row.stableId);
  return (
    serverRow !== undefined &&
    serverRow.projectId === row.projectId &&
    canonicalStageKey(serverRow.stageIds) === canonicalStageKey(row.stageIds)
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
    const offending = row.stageIds.find(
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

// lead-form-stage-access-integrity: the server-side stage-ownership guard,
// shared by BOTH `saveDraft` and `submitSection`. For every new/changed item /
// risk / decision row it confirms each stage name is one the SECTION AUTHOR owns
// on that row's product (canonical compare against the server-loaded
// `ownedStages`). Unchanged legacy/cross rows (identical stableId, product, and
// stage set) are grandfathered so `fix-lead-surface-name-resolution` rows
// survive. Returns one error per offending row; the caller hard-rejects on the
// first — never clamps.
export function validateStageOwnership(
  section: ReportSectionReadModel,
  input: DraftSaveInput | SubmitSectionInput,
): DraftSaveValidationError[] {
  return [
    ...validateStageRows(
      input.items.map((r) =>
        toRow(r.stableId, r.projectId ?? undefined, r.stageIds),
      ),
      section.items.map((r) =>
        toRow(r.stableId, r.projectId ?? undefined, r.stageIds),
      ),
      section,
    ),
    ...validateStageRows(
      input.risks.map((r) =>
        toRow(r.stableId, r.projectId ?? undefined, r.stageIds),
      ),
      section.risks.map((r) =>
        toRow(r.stableId, r.projectId ?? undefined, r.stageIds),
      ),
      section,
    ),
    ...validateStageRows(
      input.decisions.map((r) =>
        toRow(r.stableId, r.productId ?? undefined, r.stageIds),
      ),
      section.decisions.map((r) =>
        toRow(r.stableId, r.productId ?? undefined, r.stageIds),
      ),
      section,
    ),
  ];
}
