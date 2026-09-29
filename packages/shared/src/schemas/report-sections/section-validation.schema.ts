import type {
  DraftSaveInput,
  ProjectReadModel,
  ReportSectionReadModel,
  SubmitSectionInput,
} from "./section.schema";
import type {
  DraftSaveValidationError,
  DraftSaveValidationErrorCode,
} from "./section-validation.types";

export type { DraftSaveValidationError } from "./section-validation.types";

const validationError = (
  code: DraftSaveValidationErrorCode,
  message: string,
): DraftSaveValidationError => Object.freeze({ code, message });

// Submit-time completeness for one product: a traffic light and at least one
// Current Week item. Neither is expressible in the payload schema, which cannot
// see which products the section carries.
function validateProjectSubmission(
  project: ProjectReadModel,
  input: SubmitSectionInput,
): readonly DraftSaveValidationError[] {
  const matchingStatus = input.projectStatuses.find(
    (status) => status.projectId === project.projectId,
  );

  const hasCurrentItem = input.items.some(
    (item) => item.projectId === project.projectId && item.type === "current",
  );

  return Object.freeze([
    ...(!matchingStatus?.status
      ? [
          validationError(
            "MISSING_TRAFFIC_LIGHT",
            `Project ${project.projectName} must have a traffic light status.`,
          ),
        ]
      : []),
    ...(!hasCurrentItem
      ? [
          validationError(
            "MISSING_CURRENT_ITEM",
            `Project ${project.projectName} needs at least one Current Week item.`,
          ),
        ]
      : []),
  ]);
}

/** Validates a section submit payload against project and activity completeness rules. */
export function validateSubmitInput(
  section: ReportSectionReadModel,
  input: SubmitSectionInput,
): readonly DraftSaveValidationError[] {
  if (section.status === "submitted") {
    return Object.freeze([
      validationError(
        "SECTION_ALREADY_SUBMITTED",
        "Section has already been submitted.",
      ),
    ]);
  }

  const projectErrors = section.projects.flatMap((project) =>
    validateProjectSubmission(project, input),
  );
  const confirmationErrors = input.items.some(
    (item) => item.type === "current" && item.carriedOver,
  )
    ? [
        validationError(
          "UNCONFIRMED_CARRIED_ITEM",
          "Confirm carried Current Week items before submitting.",
        ),
      ]
    : [];

  // Activities need a traffic light at submit; schema alone cannot catch an omitted entry.
  const activityErrors = section.activities.flatMap((activity) => {
    const matchingStatus = input.activityStatuses.find(
      (status) => status.activityId === activity.activityId,
    );

    return matchingStatus?.status
      ? []
      : [
          validationError(
            "MISSING_TRAFFIC_LIGHT",
            `Activity ${activity.activityName} must have a traffic light status.`,
          ),
        ];
  });

  return Object.freeze([
    ...projectErrors,
    ...confirmationErrors,
    ...activityErrors,
  ]);
}

/**
 * Reject activity-parented draft rows whose activityId is not seeded on the section.
 * Product-parented rows (null activityId) are out of scope here.
 */
export function validateRecordActivityIds(
  section: ReportSectionReadModel,
  input: DraftSaveInput | SubmitSectionInput,
): readonly DraftSaveValidationError[] {
  const seededIds = new Set(
    section.activities.map((activity) => activity.activityId),
  );
  const check = (
    activityId: string | null | undefined,
  ): readonly DraftSaveValidationError[] =>
    activityId == null || seededIds.has(activityId)
      ? []
      : [
          validationError(
            "ACTIVITY_NOT_ATTACHED",
            "Activity is not attached to you for this section. Contact an admin to change activity attachments.",
          ),
        ];
  return Object.freeze([
    ...input.items.flatMap((row) => check(row.activityId)),
    ...input.risks.flatMap((row) => check(row.activityId)),
    ...input.decisions.flatMap((row) => check(row.activityId)),
  ]);
}

/** Rejects activity statuses that reference activities outside the section. */
export function validateActivityStatuses(
  section: ReportSectionReadModel,
  input: DraftSaveInput | SubmitSectionInput,
): readonly DraftSaveValidationError[] {
  const seededIds = new Set(
    section.activities.map((activity) => activity.activityId),
  );
  return Object.freeze(
    input.activityStatuses.flatMap((status) =>
      seededIds.has(status.activityId)
        ? []
        : [
            validationError(
              "ACTIVITY_NOT_ATTACHED",
              "Activity is not attached to you for this section. Contact an admin to change activity attachments.",
            ),
          ],
    ),
  );
}

export { validateStageOwnership } from "./section-stage-ownership";
