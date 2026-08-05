import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type { ImportOptions } from "./import-ai-driver-options.ts";

export type { ImportOptions } from "./import-ai-driver-options.ts";

import { type CoverageCell, coverageCellSchema } from "../source/contracts.ts";
import {
  CandidateVerificationError,
  candidateVerificationSchema,
  createImportedCandidateVerifier,
  verifyDriverCandidates,
} from "../support/candidate-verification.ts";
import {
  DriverResultValidationError,
  type DriverValidationInput,
  mergeDriverReport,
  parseAiDriverReport,
  writeMergedDriverCells,
} from "./driver-results.ts";

interface ReportDocument {
  readonly path: string;
  readonly text: string;
  readonly assignedCellIds: readonly string[];
  readonly candidateIds: readonly string[];
}

interface ImportState {
  readonly merged: readonly CoverageCell[];
  readonly seenCellIds: ReadonlySet<string>;
}

const reportIdentitySchema = z.object({
  assignedCells: z.array(z.looseObject({ cellId: z.string().min(1) })).min(1),
  candidates: z
    .array(z.looseObject({ candidateId: z.string().min(1) }))
    .readonly(),
});

const pathContains = (parent: string, child: string): boolean =>
  child === parent || child.startsWith(`${parent}${path.sep}`);

const assertFreshOutput = async (options: ImportOptions): Promise<void> => {
  const output = path.resolve(options.outputPath);
  const cells = path.resolve(options.cellsPath);
  if (pathContains(output, cells) || pathContains(cells, output))
    throw new Error("--output must not overlap --cells");
  try {
    await access(output);
    throw new Error(`output directory already exists: ${output}`);
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
};

const cellPaths = async (cellsPath: string): Promise<readonly string[]> => {
  const metadata = await stat(cellsPath);
  if (metadata.isFile()) return [cellsPath];
  if (!metadata.isDirectory())
    throw new Error(`--cells must be a JSON file or directory: ${cellsPath}`);
  return (await readdir(cellsPath, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(cellsPath, entry.name))
    .toSorted((left, right) => left.localeCompare(right));
};

const readCells = async (
  cellsPath: string,
): Promise<readonly CoverageCell[]> => {
  const paths = await cellPaths(cellsPath);
  if (paths.length === 0)
    throw new Error(`No cell JSON files found at ${cellsPath}`);
  const cells = await Promise.all(
    paths.map(async (cellPath) =>
      coverageCellSchema.parse(JSON.parse(await readFile(cellPath, "utf8"))),
    ),
  );
  const duplicateIds = cells
    .map(({ cellId }) => cellId)
    .filter((cellId, index, ids) => ids.indexOf(cellId) !== index);
  if (duplicateIds.length > 0)
    throw new DriverResultValidationError(
      [...new Set(duplicateIds)].map((cellId) => `duplicate cell ${cellId}`),
    );
  return cells;
};

const uniqueIds = (
  ids: readonly string[],
  label: string,
): readonly string[] => {
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0)
    throw new DriverResultValidationError(
      [...new Set(duplicates)].map((id) => `duplicate ${label} ${id}`),
    );
  return ids;
};

const readReport = async (reportPath: string): Promise<ReportDocument> => {
  const text = await readFile(reportPath, "utf8");
  const parsed = reportIdentitySchema.parse(JSON.parse(text));
  return {
    path: reportPath,
    text,
    assignedCellIds: uniqueIds(
      parsed.assignedCells.map(({ cellId }) => cellId),
      "assigned cell",
    ),
    candidateIds: uniqueIds(
      parsed.candidates.map(({ candidateId }) => candidateId),
      "candidate",
    ),
  };
};

const readVerificationValues = async (
  verificationPath: string,
): Promise<readonly unknown[]> => {
  const parsed: unknown = JSON.parse(await readFile(verificationPath, "utf8"));
  if (!Array.isArray(parsed))
    throw new CandidateVerificationError([
      "verification import must be a JSON array",
    ]);
  return z.array(z.unknown()).parse(parsed);
};

const verifyImportIdentity = (
  reports: readonly ReportDocument[],
  values: readonly unknown[],
): void => {
  const expectedIds = uniqueIds(
    reports.flatMap(({ candidateIds }) => candidateIds),
    "candidate across reports",
  );
  const records = values.map((value) =>
    candidateVerificationSchema.parse(value),
  );
  const importedIds = uniqueIds(
    records.map(({ candidateId }) => candidateId),
    "imported verification",
  );
  const expected = new Set(expectedIds);
  const imported = new Set(importedIds);
  const missing = expectedIds.filter((id) => !imported.has(id));
  const extra = importedIds.filter((id) => !expected.has(id));
  if (missing.length > 0 || extra.length > 0)
    throw new CandidateVerificationError([
      ...missing.map((id) => `missing imported verification ${id}`),
      ...extra.map((id) => `unused imported verification ${id}`),
    ]);
};

const importReport = async (
  document: ReportDocument,
  allCells: readonly CoverageCell[],
  options: ImportOptions,
  verificationValues: readonly unknown[] | undefined,
): Promise<readonly CoverageCell[]> => {
  const ids = new Set(document.assignedCellIds);
  const cells = allCells.filter(({ cellId }) => ids.has(cellId));
  if (cells.length !== document.assignedCellIds.length)
    throw new DriverResultValidationError([
      `report ${document.path} references a cell missing from --cells`,
    ]);
  const validation: DriverValidationInput = {
    sourceSha: options.sourceSha,
    profile: options.profile,
    role: options.role,
    cells,
  };
  const report = parseAiDriverReport(document.text, validation);
  const reportVerificationValues = (verificationValues ?? []).filter(
    (value) => {
      const parsed = candidateVerificationSchema.parse(value);
      return document.candidateIds.includes(parsed.candidateId);
    },
  );
  const verifiedReport =
    report.candidates.length === 0
      ? report
      : {
          ...report,
          candidates: (
            await verifyDriverCandidates(
              report.candidates,
              { ...validation, repoRoot: path.resolve(".") },
              createImportedCandidateVerifier(
                reportVerificationValues,
                report.candidates,
              ),
            )
          ).confirmed.map(({ candidate }) => candidate),
        };
  return mergeDriverReport(cells, verifiedReport, {
    ...validation,
    reportText: document.text,
    reportArchivePath: document.path,
  });
};

const importReports = async (
  reports: readonly ReportDocument[],
  allCells: readonly CoverageCell[],
  options: ImportOptions,
  verificationValues: readonly unknown[] | undefined,
): Promise<readonly CoverageCell[]> => {
  const initial: ImportState = { merged: [], seenCellIds: new Set() };
  const state = await reports.reduce<Promise<ImportState>>(
    async (pending, document) => {
      const current = await pending;
      const repeated = document.assignedCellIds.filter((id) =>
        current.seenCellIds.has(id),
      );
      if (repeated.length > 0)
        throw new DriverResultValidationError(
          [...new Set(repeated)].map(
            (id) => `cell ${id} is present in more than one report`,
          ),
        );
      const merged = await importReport(
        document,
        allCells,
        options,
        verificationValues,
      );
      return {
        merged: [...current.merged, ...merged],
        seenCellIds: new Set([
          ...current.seenCellIds,
          ...document.assignedCellIds,
        ]),
      };
    },
    Promise.resolve(initial),
  );
  return state.merged.toSorted((left, right) =>
    left.cellId.localeCompare(right.cellId),
  );
};

export async function importAiDriverReports(
  options: ImportOptions,
): Promise<readonly CoverageCell[]> {
  await assertFreshOutput(options);
  const [allCells, reports] = await Promise.all([
    readCells(options.cellsPath),
    Promise.all(options.reportPaths.map(readReport)),
  ]);
  const candidateIds = reports.flatMap(({ candidateIds }) => candidateIds);
  const verificationValues = options.verificationPath
    ? await readVerificationValues(options.verificationPath)
    : undefined;
  if (candidateIds.length > 0 && verificationValues === undefined)
    throw new CandidateVerificationError([
      "candidate report requires an explicit --verification import",
    ]);
  if (candidateIds.length === 0 && verificationValues !== undefined)
    throw new CandidateVerificationError([
      "--verification import cannot be supplied for reports without candidates",
    ]);
  if (verificationValues) verifyImportIdentity(reports, verificationValues);
  const merged = await importReports(
    reports,
    allCells,
    options,
    verificationValues,
  );
  await writeMergedDriverCells(options.outputPath, merged);
  return merged;
}
