import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EnvironmentFeedback } from "../preflight/observability/environment-feedback.ts";
import { assertEnvironmentFeedbackLive } from "../preflight/observability/environment-feedback.ts";
import {
  observeEnvironmentFeedback,
  readEnvironmentObserverConfig,
} from "../preflight/observability/environment-observer.ts";
import type { CoverageCell } from "../source/contracts.ts";
import { appendEnvironmentCandidates } from "../support/candidate-verification.ts";
import {
  DriverResultValidationError,
  type DriverValidationInput,
  parseAiDriverReport,
  validateDriverReport,
} from "./driver-results.ts";
import type { AiDriverReport } from "./driver-results-contract.ts";
import { parseTranscript, sha256Bytes } from "./driver-results-transcript.ts";
import type {
  ImportOptions,
  TranscriptInput,
} from "./import-ai-driver-options.ts";

const REPORT_INDEX_WIDTH = 4;

export interface ReportDocument {
  readonly path: string;
  readonly text: string;
  readonly assignedCellIds: readonly string[];
  readonly candidateIds: readonly string[];
  readonly report?: AiDriverReport;
  readonly preparedText?: string;
  readonly preparedArchivePath?: string;
}

export interface ApiLogSnapshot {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly text: string;
  readonly digest: string;
}

export interface EnvironmentSnapshotBindings {
  readonly transcriptEvidenceRef: string;
  readonly apiLogText?: string;
  readonly apiLogEvidenceRef?: string;
}

const snapshotDirectory = (stagingRoot: string): string =>
  path.join(stagingRoot, "inputs");

const transcriptSnapshotPath = (
  stagingRoot: string,
  outputPath: string,
  index: number,
): Readonly<{ readonly staging: string; readonly final: string }> => {
  const relative = path.join(
    "inputs",
    "transcripts",
    `transcript-${String(index).padStart(REPORT_INDEX_WIDTH, "0")}.jsonl`,
  );
  return {
    staging: path.join(stagingRoot, relative),
    final: path.join(path.resolve(outputPath), relative),
  };
};

const apiLogSnapshotPath = (
  stagingRoot: string,
  outputPath: string,
): Readonly<{ readonly staging: string; readonly final: string }> => {
  const relative = path.join("inputs", "api-log", "app.log");
  return {
    staging: path.join(stagingRoot, relative),
    final: path.join(path.resolve(outputPath), relative),
  };
};

const evidenceRef = (kind: string, filePath: string, digest: string): string =>
  `${kind}:${filePath}#sha256=${digest}`;

export const cellsForReport = (
  document: ReportDocument,
  allCells: readonly CoverageCell[],
): readonly CoverageCell[] => {
  const ids = new Set(document.assignedCellIds);
  const cells = allCells.filter(({ cellId }) => ids.has(cellId));
  if (cells.length !== document.assignedCellIds.length)
    throw new DriverResultValidationError([
      `report ${document.path} references a cell missing from --cells`,
    ]);
  return cells;
};

const hitCells = (
  hit: EnvironmentFeedback["hits"][number],
  cells: readonly CoverageCell[],
): readonly CoverageCell[] =>
  hit.cellId
    ? cells.filter(({ cellId }) => cellId === hit.cellId)
    : cells.filter(
        ({ catalogRoute, resolvedRoute }) =>
          catalogRoute === hit.route || resolvedRoute === hit.route,
      );

const assertEnvironmentHitsBound = (
  feedback: EnvironmentFeedback,
  cells: readonly CoverageCell[],
): void => {
  const unbound = feedback.hits.flatMap((hit) => {
    const matches = hitCells(hit, cells);
    return matches.length === 1
      ? []
      : [`environment hit ${hit.eventId} does not bind to exactly one cell`];
  });
  if (unbound.length > 0) throw new DriverResultValidationError(unbound);
};

export const prepareReport = async (
  document: ReportDocument,
  allCells: readonly CoverageCell[],
  options: ImportOptions,
  transcriptInput: TranscriptInput,
  bindings: EnvironmentSnapshotBindings,
  observerConfig: ReturnType<typeof readEnvironmentObserverConfig>,
): Promise<ReportDocument> => {
  const cells = cellsForReport(document, allCells);
  const validation: DriverValidationInput = {
    sourceSha: options.sourceSha,
    profile: options.profile,
    role: options.role,
    cells,
  };
  const parsed = parseAiDriverReport(document.text, validation);
  const transcript = parseTranscript({
    ...transcriptInput,
    attemptId: parsed.attemptId,
    timeline: parsed.timeline,
  });
  if (transcript.digest !== parsed.transcriptEvidence.digest)
    throw new DriverResultValidationError([
      `transcript digest does not match report ${document.path}`,
    ]);
  const feedback = await observeEnvironmentFeedback({
    report: parsed,
    transcriptRecords: transcript.records,
    transcriptEvidenceRef: bindings.transcriptEvidenceRef,
    ...observerConfig,
    apiLogText: bindings.apiLogText ?? "",
    ...(bindings.apiLogEvidenceRef
      ? { apiLogEvidenceRef: bindings.apiLogEvidenceRef }
      : {}),
  });
  assertEnvironmentFeedbackLive(feedback);
  assertEnvironmentHitsBound(feedback, cells);
  const reportWithTranscript = {
    ...parsed,
    transcriptEvidence: {
      ...parsed.transcriptEvidence,
      evidenceRefs: [bindings.transcriptEvidenceRef],
    },
  };
  const report = appendEnvironmentCandidates(
    reportWithTranscript,
    feedback,
    cells,
  );
  validateDriverReport(report, validation);
  const candidateIds = report.candidates.map(({ candidateId }) => candidateId);
  const duplicateIds = candidateIds.filter(
    (candidateId, index) => candidateIds.indexOf(candidateId) !== index,
  );
  if (duplicateIds.length > 0)
    throw new DriverResultValidationError(
      [...new Set(duplicateIds)].map((id) => `duplicate candidate ${id}`),
    );
  return { ...document, report, candidateIds };
};

export const readApiLogSnapshot = async (
  apiLogPath: string | undefined,
): Promise<ApiLogSnapshot | undefined> => {
  if (!apiLogPath) return undefined;
  try {
    const bytes = await readFile(apiLogPath);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { path: apiLogPath, bytes, text, digest: sha256Bytes(bytes) };
  } catch {
    return undefined;
  }
};

export const writeInputSnapshots = async (
  transcripts: readonly TranscriptInput[],
  apiLog: ApiLogSnapshot | undefined,
  stagingRoot: string,
  outputPath: string,
): Promise<
  Readonly<{
    readonly transcriptBindings: readonly Readonly<{
      readonly input: TranscriptInput;
      readonly archivePath: string;
      readonly evidenceRef: string;
    }>[];
    readonly apiLogText?: string;
    readonly apiLogEvidenceRef?: string;
  }>
> => {
  await mkdir(snapshotDirectory(stagingRoot), { recursive: true });
  const transcriptBindings = await Promise.all(
    transcripts.map(async (input, index) => {
      const paths = transcriptSnapshotPath(stagingRoot, outputPath, index);
      await mkdir(path.dirname(paths.staging), { recursive: true });
      await writeFile(paths.staging, input.bytes, { flag: "wx", mode: 0o600 });
      const digest = sha256Bytes(input.bytes);
      return {
        input,
        archivePath: paths.final,
        evidenceRef: evidenceRef("transcript", paths.final, digest),
      };
    }),
  );
  if (!apiLog) return { transcriptBindings };
  const paths = apiLogSnapshotPath(stagingRoot, outputPath);
  await mkdir(path.dirname(paths.staging), { recursive: true });
  await writeFile(paths.staging, apiLog.bytes, { flag: "wx", mode: 0o600 });
  return {
    transcriptBindings,
    apiLogText: apiLog.text,
    apiLogEvidenceRef: evidenceRef("api-log", paths.final, apiLog.digest),
  };
};

export const writePreparedReports = async (
  reports: readonly ReportDocument[],
  stagingRoot: string,
  outputPath: string,
): Promise<readonly ReportDocument[]> => {
  const stagingDirectory = path.join(stagingRoot, "reports");
  await mkdir(stagingDirectory, { recursive: true });
  try {
    return await Promise.all(
      reports.map(async (document, index) => {
        if (!document.report)
          throw new Error(`report ${document.path} was not prepared`);
        const text = `${JSON.stringify(document.report, null, 2)}\n`;
        const relative = path.join(
          "reports",
          `report-${String(index).padStart(REPORT_INDEX_WIDTH, "0")}.json`,
        );
        await writeFile(path.join(stagingRoot, relative), text, {
          encoding: "utf8",
          flag: "wx",
        });
        return {
          ...document,
          preparedText: text,
          preparedArchivePath: path.join(path.resolve(outputPath), relative),
        };
      }),
    );
  } catch (error: unknown) {
    await rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
};
