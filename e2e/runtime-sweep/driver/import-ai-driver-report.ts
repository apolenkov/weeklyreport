import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  assertReportTranscriptMapping,
  type ImportOptions,
  readTranscriptFiles,
  verifyImportedCandidates,
} from "./import-ai-driver-options.ts";
export type { ImportOptions } from "./import-ai-driver-options.ts";
import { readEnvironmentObserverConfig } from "../preflight/environment-observer.ts";
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
  writeMergedDriverCellsToDirectory,
} from "./driver-results.ts";
import {
  cellsForReport,
  type ReportDocument,
  writePreparedReports,
} from "./import-ai-driver-environment.ts";
import { prepareStagedReports } from "./import-ai-driver-transaction.ts";

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
    throw new Error(`fresh import path already exists: ${output}`);
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

const importReport = async (
  document: ReportDocument,
  allCells: readonly CoverageCell[],
  options: ImportOptions,
  verificationValues: readonly unknown[] | undefined,
): Promise<readonly CoverageCell[]> => {
  const cells = cellsForReport(document, allCells);
  const validation: DriverValidationInput = {
    sourceSha: options.sourceSha,
    profile: options.profile,
    role: options.role,
    cells,
  };
  const report =
    document.report ?? parseAiDriverReport(document.text, validation);
  const reportVerificationValues = (verificationValues ?? []).filter((value) =>
    document.candidateIds.includes(
      candidateVerificationSchema.parse(value).candidateId,
    ),
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
    reportText: document.preparedText ?? document.text,
    reportArchivePath: document.preparedArchivePath ?? document.path,
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
  assertReportTranscriptMapping(options);
  const transcripts = await readTranscriptFiles(options.transcriptPaths);
  const observerConfig = readEnvironmentObserverConfig(
    path.resolve(import.meta.dirname, "../../.."),
  );
  const outputPath = path.resolve(options.outputPath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const stagingRoot = await mkdtemp(
    path.join(path.dirname(outputPath), ".runtime-driver-"),
  );
  try {
    const preparedReports = await prepareStagedReports({
      reports,
      allCells,
      options,
      transcripts,
      observerConfig,
      stagingRoot,
      outputPath,
    });
    const candidateIds = preparedReports.flatMap(
      ({ candidateIds }) => candidateIds,
    );
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
    if (verificationValues)
      verifyImportedCandidates(
        preparedReports.flatMap(({ candidateIds }) => candidateIds),
        verificationValues,
      );
    const archivedReports = await writePreparedReports(
      preparedReports,
      stagingRoot,
      outputPath,
    );
    const merged = await importReports(
      archivedReports,
      allCells,
      options,
      verificationValues,
    );
    await writeMergedDriverCellsToDirectory(stagingRoot, merged);
    await rename(stagingRoot, outputPath);
    return merged;
  } catch (error: unknown) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}
