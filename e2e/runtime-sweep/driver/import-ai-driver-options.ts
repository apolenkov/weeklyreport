import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  roleSchema,
  seedProfileSchema,
  sourceShaSchema,
} from "../source/contracts.ts";
import {
  CandidateVerificationError,
  candidateVerificationSchema,
} from "../support/candidate-verification.ts";

export interface ImportOptions {
  readonly reportPaths: readonly string[];
  readonly cellsPath: string;
  readonly outputPath: string;
  readonly transcriptPaths: readonly string[];
  readonly verificationPath?: string;
  readonly sourceSha: string;
  readonly profile: z.infer<typeof seedProfileSchema>;
  readonly role: z.infer<typeof roleSchema>;
}

export const assertReportTranscriptMapping = (
  options: Pick<ImportOptions, "reportPaths" | "transcriptPaths">,
): void => {
  if (options.transcriptPaths.length === 0)
    throw new Error("at least one --transcript is required");
  if (options.reportPaths.length !== options.transcriptPaths.length)
    throw new Error("one --transcript is required for each --report");
};

export type TranscriptInput = Readonly<{
  readonly path: string;
  readonly bytes: Uint8Array;
}>;

export const readTranscriptFiles = async (
  transcriptPaths: readonly string[],
): Promise<readonly TranscriptInput[]> =>
  Promise.all(
    transcriptPaths.map(async (transcriptPath) => {
      try {
        return {
          path: transcriptPath,
          bytes: await readFile(transcriptPath),
        } satisfies TranscriptInput;
      } catch (error: unknown) {
        throw new Error(
          `transcript is unreadable: ${transcriptPath}${
            error instanceof Error ? ` (${error.message})` : ""
          }`,
        );
      }
    }),
  );

export const verifyImportedCandidates = (
  expectedIds: readonly string[],
  values: readonly unknown[],
): void => {
  const records = values.map((value) =>
    candidateVerificationSchema.parse(value),
  );
  const duplicateExpectedIds = expectedIds.filter(
    (candidateId, index) => expectedIds.indexOf(candidateId) !== index,
  );
  const importedIds = records.map(({ candidateId }) => candidateId);
  const expected = new Set(expectedIds);
  const imported = new Set(importedIds);
  const duplicateIds = importedIds.filter(
    (candidateId, index) => importedIds.indexOf(candidateId) !== index,
  );
  const missing = expectedIds.filter((id) => !imported.has(id));
  const extra = importedIds.filter((id) => !expected.has(id));
  if (
    duplicateExpectedIds.length > 0 ||
    duplicateIds.length > 0 ||
    missing.length > 0 ||
    extra.length > 0
  )
    throw new CandidateVerificationError([
      ...[...new Set(duplicateExpectedIds)].map(
        (id) => `duplicate candidate across reports ${id}`,
      ),
      ...[...new Set(duplicateIds)].map(
        (id) => `duplicate imported verification ${id}`,
      ),
      ...missing.map((id) => `missing imported verification ${id}`),
      ...extra.map((id) => `unused imported verification ${id}`),
    ]);
};

interface PartialImportOptions {
  readonly reports: readonly string[];
  readonly cellsPath?: string;
  readonly outputPath?: string;
  readonly transcripts: readonly string[];
  readonly verificationPath?: string;
  readonly sourceSha?: string;
  readonly profile?: z.infer<typeof seedProfileSchema>;
  readonly role?: z.infer<typeof roleSchema>;
}

const requiredValue = (value: string | undefined, name: string): string => {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
};

const rejectDuplicateOption = (
  current: string | undefined,
  option: string,
): void => {
  if (current) throw new Error(`${option} may be supplied only once`);
};

const parseToken = (
  argument: string | undefined,
  value: string | undefined,
  state: PartialImportOptions,
): PartialImportOptions => {
  if (!argument) throw new Error("missing argument");
  switch (argument) {
    case "--report":
      return {
        ...state,
        reports: [...state.reports, requiredValue(value, "--report value")],
      };
    case "--cells":
      rejectDuplicateOption(state.cellsPath, argument);
      return { ...state, cellsPath: requiredValue(value, "--cells value") };
    case "--output":
      rejectDuplicateOption(state.outputPath, argument);
      return { ...state, outputPath: requiredValue(value, "--output value") };
    case "--transcript":
      return {
        ...state,
        transcripts: [
          ...state.transcripts,
          requiredValue(value, "--transcript value"),
        ],
      };
    case "--verification":
      rejectDuplicateOption(state.verificationPath, argument);
      return {
        ...state,
        verificationPath: requiredValue(value, "--verification value"),
      };
    case "--source-sha":
      rejectDuplicateOption(state.sourceSha, argument);
      return {
        ...state,
        sourceSha: requiredValue(value, "--source-sha value"),
      };
    case "--profile":
      rejectDuplicateOption(state.profile, argument);
      return { ...state, profile: seedProfileSchema.parse(value) };
    case "--role":
      rejectDuplicateOption(state.role, argument);
      return { ...state, role: roleSchema.parse(value) };
    default:
      throw new Error(`Unknown argument ${argument}`);
  }
};

const parseTokens = (
  args: readonly string[],
  index: number,
  state: PartialImportOptions,
): PartialImportOptions =>
  index >= args.length
    ? state
    : parseTokens(
        args,
        index + 2,
        parseToken(args[index], args[index + 1], state),
      );

export function parseImportOptions(args: readonly string[]): ImportOptions {
  const state = parseTokens(args, 0, { reports: [], transcripts: [] });
  if (state.reports.length === 0)
    throw new Error("at least one --report is required");
  assertReportTranscriptMapping({
    reportPaths: state.reports,
    transcriptPaths: state.transcripts,
  });
  const cellsPath = requiredValue(state.cellsPath, "--cells");
  const outputPath = requiredValue(state.outputPath, "--output");
  const sourceSha = requiredValue(state.sourceSha, "--source-sha");
  sourceShaSchema.parse(sourceSha);
  if (!state.profile) throw new Error("--profile is required");
  if (!state.role) throw new Error("--role is required");
  return {
    reportPaths: state.reports.map((reportPath) => path.resolve(reportPath)),
    cellsPath: path.resolve(cellsPath),
    outputPath: path.resolve(outputPath),
    transcriptPaths: state.transcripts.map((transcriptPath) =>
      path.resolve(transcriptPath),
    ),
    ...(state.verificationPath
      ? { verificationPath: path.resolve(state.verificationPath) }
      : {}),
    sourceSha,
    profile: state.profile,
    role: state.role,
  };
}
