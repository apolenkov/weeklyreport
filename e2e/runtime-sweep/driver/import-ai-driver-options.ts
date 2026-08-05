import path from "node:path";

import { z } from "zod";

import {
  roleSchema,
  seedProfileSchema,
  sourceShaSchema,
} from "../source/contracts.ts";

export interface ImportOptions {
  readonly reportPaths: readonly string[];
  readonly cellsPath: string;
  readonly outputPath: string;
  readonly verificationPath?: string;
  readonly sourceSha: string;
  readonly profile: z.infer<typeof seedProfileSchema>;
  readonly role: z.infer<typeof roleSchema>;
}

interface PartialImportOptions {
  readonly reports: readonly string[];
  readonly cellsPath?: string;
  readonly outputPath?: string;
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
  const state = parseTokens(args, 0, { reports: [] });
  if (state.reports.length === 0)
    throw new Error("at least one --report is required");
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
    ...(state.verificationPath
      ? { verificationPath: path.resolve(state.verificationPath) }
      : {}),
    sourceSha,
    profile: state.profile,
    role: state.role,
  };
}
