import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  COVERAGE_VERDICTS,
  type CoverageCell,
  coverageCellSchema,
  type CoverageVerdict,
  sourceShaSchema,
} from "./contracts.ts";

export interface LedgerOptions {
  readonly sourceSha: string;
  readonly expectedCellIds?: readonly string[];
  readonly requireFinalPass?: boolean;
}

export interface LedgerSummary {
  readonly cells: readonly CoverageCell[];
  readonly counts: Readonly<Record<CoverageVerdict, number>>;
  readonly missingCellIds: readonly string[];
  readonly extraCellIds: readonly string[];
}

export class LedgerValidationError extends Error {
  override readonly name = "LedgerValidationError";

  constructor(readonly issues: readonly string[]) {
    super(`Coverage ledger rejected: ${issues.join("; ")}`);
  }
}

const TERMINAL_VERDICTS = new Set<CoverageVerdict>([
  "pass",
  "fail",
  "blocked",
  "confirmed",
  "excluded",
]);
const REQUIRED_DIMENSIONS = ["function", "accessibility", "visual"] as const;

function allEvidence(cell: CoverageCell) {
  return [
    ...cell.evidence.before,
    ...cell.evidence.action,
    ...cell.evidence.after,
  ];
}

function cellIssues(
  cell: CoverageCell,
  sourceSha: string,
  requireFinalPass: boolean,
): readonly string[] {
  const evidence = allEvidence(cell);
  const issues = [
    ...(cell.sourceSha !== sourceSha
      ? [`${cell.cellId} has source SHA ${cell.sourceSha}`]
      : []),
    ...(requireFinalPass && cell.verdict !== "pass"
      ? [`${cell.cellId} has final verdict ${cell.verdict}`]
      : []),
  ];
  const bindingIssues = evidence.flatMap((artifact) => {
    const bindingFields: readonly (readonly [string, boolean])[] = [
      ["source SHA", artifact.sourceSha === sourceSha],
      ["cell id", artifact.cellId === cell.cellId],
      ["profile", artifact.profile === cell.profile],
      ["role", artifact.role === cell.role],
      ["catalog route", artifact.catalogRoute === cell.catalogRoute],
      ["resolved route", artifact.resolvedRoute === cell.resolvedRoute],
    ];
    return bindingFields
      .filter(([, matches]) => !matches)
      .map(
        ([field]) =>
          `${cell.cellId} evidence ${artifact.artifactId} has mismatched ${field}`,
      );
  });
  const missingEvidence = TERMINAL_VERDICTS.has(cell.verdict)
    ? REQUIRED_DIMENSIONS.flatMap((dimension) => {
        const required = cell.oracle[dimension].required;
        const present = evidence.some(
          (artifact) => artifact.dimension === dimension,
        );
        const explained = cell.evidence.inapplicable.some(
          (entry) =>
            entry.dimension === dimension && entry.reason.trim() !== "",
        );
        return required && !present && !explained
          ? [
              `${cell.cellId} is missing ${dimension} evidence or a reasoned inapplicable entry`,
            ]
          : [];
      })
    : [];
  const controlIssues = cell.controls.flatMap((control) => [
    ...(control.accessibleName.trim() === ""
      ? [`${cell.cellId} control ${control.controlKey} has no accessible name`]
      : []),
    ...(requireFinalPass && control.actionResult.kind === "not-exercised"
      ? [
          `${cell.cellId} control ${control.controlKey} is not exercised in the final ledger`,
        ]
      : []),
    ...(control.actionResult.kind === "not-exercised" &&
    control.actionResult.reason.trim() === ""
      ? [
          `${cell.cellId} control ${control.controlKey} has an unreasoned omission`,
        ]
      : []),
  ]);
  return [...issues, ...bindingIssues, ...missingEvidence, ...controlIssues];
}

function counts(
  cells: readonly CoverageCell[],
): Readonly<Record<CoverageVerdict, number>> {
  return COVERAGE_VERDICTS.reduce(
    (result, verdict) => ({
      ...result,
      [verdict]: cells.filter((cell) => cell.verdict === verdict).length,
    }),
    {
      pending: 0,
      candidate: 0,
      confirmed: 0,
      pass: 0,
      fail: 0,
      blocked: 0,
      excluded: 0,
    },
  );
}

export function verifyCoverageLedger(
  cells: readonly CoverageCell[],
  options: LedgerOptions,
): LedgerSummary {
  const issues = sourceShaSchema.safeParse(options.sourceSha).success
    ? []
    : ["campaign source SHA is not a lowercase 40-character SHA"];
  const duplicateIds = cells
    .map((cell) => cell.cellId)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  const uniqueExpected = options.expectedCellIds ?? [];
  const actualIds = new Set(cells.map((cell) => cell.cellId));
  const expectedIds = new Set(uniqueExpected);
  const missingCellIds = uniqueExpected.filter((id) => !actualIds.has(id));
  const extraCellIds =
    uniqueExpected.length === 0
      ? []
      : cells.map((cell) => cell.cellId).filter((id) => !expectedIds.has(id));
  const allIssues = [
    ...issues,
    ...duplicateIds.map((id) => `duplicate cell id ${id}`),
    ...missingCellIds.map((id) => `missing expected cell ${id}`),
    ...extraCellIds.map((id) => `unexpected cell ${id}`),
    ...cells.flatMap((cell) =>
      cellIssues(cell, options.sourceSha, options.requireFinalPass ?? false),
    ),
  ];
  if (allIssues.length > 0) throw new LedgerValidationError(allIssues);
  return { cells, counts: counts(cells), missingCellIds, extraCellIds };
}

export async function readCoverageLedger(
  path: string,
): Promise<readonly CoverageCell[]> {
  const text = await readFile(path, "utf8");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => coverageCellSchema.parse(JSON.parse(line)));
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function existingCells(path: string): Promise<readonly CoverageCell[]> {
  try {
    return await readCoverageLedger(path);
  } catch (error) {
    if (isMissingFile(error)) return [];
    throw error;
  }
}

export async function appendCoverageCell(
  path: string,
  cell: CoverageCell,
  options: LedgerOptions,
): Promise<void> {
  const existing = await existingCells(path);
  verifyCoverageLedger([...existing, cell], {
    ...options,
    requireFinalPass: false,
  });
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(cell)}\n`, "utf8");
}
