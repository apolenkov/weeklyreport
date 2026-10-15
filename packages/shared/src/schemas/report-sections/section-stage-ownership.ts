import type {
  DraftSaveInput,
  ReportSectionReadModel,
  SubmitSectionInput,
} from "./section.schema.js";
import type { DraftSaveValidationError } from "./section-validation.types.js";

interface StageOwnershipRow {
  readonly stableId: string | undefined;
  readonly projectId: string | undefined;
  readonly stageNames: readonly string[];
}

interface StageOwnershipSource {
  readonly stableId?: string | undefined;
  readonly stageNames?: readonly string[] | undefined;
}

const toRow = (
  row: StageOwnershipSource,
  projectId: string | null | undefined,
): StageOwnershipRow => ({
  stableId: row.stableId,
  projectId: projectId ?? undefined,
  stageNames: row.stageNames ?? [],
});

const sameStages = (
  left: readonly string[],
  right: readonly string[],
): boolean =>
  left.length === right.length && left.every((stage) => right.includes(stage));

// A row saved back exactly as stored (same lineage, product and stages) was
// validated when it was written; revalidating it would let one assignment
// removal block every save of the section.
const isUnchanged = (
  row: StageOwnershipRow,
  stored: readonly StageOwnershipRow[],
): boolean =>
  row.stableId !== undefined &&
  stored.some(
    (candidate) =>
      candidate.stableId === row.stableId &&
      candidate.projectId === row.projectId &&
      sameStages(candidate.stageNames, row.stageNames),
  );

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
  storedRows: readonly StageOwnershipRow[],
  section: ReportSectionReadModel,
): readonly DraftSaveValidationError[] => {
  return Object.freeze(
    payloadRows.flatMap((row) => {
      if (isUnchanged(row, storedRows)) return [];
      const owned = authorOwnedStages(section, row.projectId);
      const offending = row.stageNames.find((stage) => !owned.includes(stage));
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

const recordRows = (
  records: Pick<DraftSaveInput, "items" | "risks" | "decisions">,
) =>
  [
    records.items.map((row) => toRow(row, row.projectId)),
    records.risks.map((row) => toRow(row, row.projectId)),
    records.decisions.map((row) => toRow(row, row.productId)),
  ] as const;

/** Rejects new or changed payload record stages that the section author does not own. */
export function validateStageOwnership(
  section: ReportSectionReadModel,
  input: DraftSaveInput | SubmitSectionInput,
): readonly DraftSaveValidationError[] {
  const stored = recordRows(section);
  return Object.freeze(
    recordRows(input).flatMap((rows, kind) =>
      validateStageRows(rows, stored[kind], section),
    ),
  );
}
