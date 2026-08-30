import { stageNamesMatch } from "../stages/stage-names";
import type {
  DraftSaveInput,
  ReportSectionReadModel,
  SubmitSectionInput,
} from "./section.schema";
import type { DraftSaveValidationError } from "./section-validation.types";

interface StageOwnershipRow {
  readonly stableId?: string;
  readonly projectId: string | undefined;
  readonly stageNames: readonly string[];
}

const toRow = (
  stableId: string | undefined,
  projectId: string | undefined,
  stageNames: readonly string[] | undefined,
): StageOwnershipRow => ({
  ...(stableId === undefined ? {} : { stableId }),
  projectId,
  stageNames: stageNames ?? [],
});

const authorOwnedStages = (
  section: ReportSectionReadModel,
  projectId: string | undefined,
): readonly string[] =>
  (projectId === undefined
    ? section.projects
    : section.projects.filter((project) => project.projectId === projectId)
  ).flatMap((project) => project.ownedStages.map((stage) => stage.stageName));

const stageNotOwnedMessage = (
  stage: string,
  section: ReportSectionReadModel,
  projectId: string | undefined,
): string => {
  const productName =
    section.projects.find((project) => project.projectId === projectId)
      ?.projectName ??
    section.referencedProjects.find(
      (project) => project.projectId === projectId,
    )?.projectName;
  const productContext = productName ? ` on ${productName}` : "";
  return `Stage "${stage}" is not one you own${productContext}. Contact an admin to change your stage assignments.`;
};

const validateStageRows = (
  payloadRows: readonly StageOwnershipRow[],
  section: ReportSectionReadModel,
): readonly DraftSaveValidationError[] => {
  return Object.freeze(
    payloadRows.flatMap((row) => {
      const owned = authorOwnedStages(section, row.projectId);
      const offending = row.stageNames.find(
        (stage) =>
          !owned.some((candidate) => stageNamesMatch(candidate, stage)),
      );
      return offending === undefined
        ? []
        : [
            Object.freeze({
              code: "STAGE_NOT_OWNED" as const,
              message: stageNotOwnedMessage(offending, section, row.projectId),
            }),
          ];
    }),
  );
};

const inputRows = (input: DraftSaveInput | SubmitSectionInput) =>
  [
    input.items.map((row) =>
      toRow(row.stableId, row.projectId ?? undefined, row.stageNames),
    ),
    input.risks.map((row) =>
      toRow(row.stableId, row.projectId ?? undefined, row.stageNames),
    ),
    input.decisions.map((row) =>
      toRow(row.stableId, row.productId ?? undefined, row.stageNames),
    ),
  ] as const;

/** Rejects changed record stages that the section author does not own. */
export function validateStageOwnership(
  section: ReportSectionReadModel,
  input: DraftSaveInput | SubmitSectionInput,
): readonly DraftSaveValidationError[] {
  return Object.freeze(
    inputRows(input).flatMap((rows) => validateStageRows(rows, section)),
  );
}
