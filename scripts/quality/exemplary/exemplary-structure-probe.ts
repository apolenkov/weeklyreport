import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

import { ESLint } from "eslint";

import {
  STRUCTURAL_CYCLOMATIC_MAX,
  STRUCTURAL_FILE_MAX,
  STRUCTURAL_FUNCTION_MAX,
  STRUCTURAL_RULE_IDS,
  type StructuralRuleId,
} from "./exemplary-structure-contract.ts";
import { measureStructuralInventory } from "./exemplary-structure-inventory.ts";

export type StructuralProbeClassification =
  "REAL" | "VACUOUS" | "CONFIG" | "NOISE";

export interface StructuralProbeObservation {
  readonly acceptedReports: number;
  readonly overflowReports: number;
  readonly unintendedReports: number;
  readonly configurationErrors: readonly string[];
}

export const classifyStructuralProbe = (
  observation: StructuralProbeObservation,
): StructuralProbeClassification => {
  if (observation.configurationErrors.length > 0) return "CONFIG";
  if (
    observation.acceptedReports > 0 ||
    observation.unintendedReports > 0 ||
    observation.overflowReports > 1
  )
    return "NOISE";
  return observation.overflowReports === 1 ? "REAL" : "VACUOUS";
};

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const PROBE_SCOPE = "apps/web/src/__exemplary-structure-probes";
const PROBE_ROOT = `${REPO_ROOT}${PROBE_SCOPE}`;
const GIT_BIN = "/usr/bin/git";
const FUNCTION_WRAPPER_LINES = 3;
const ONE_STEP_OVERFLOW = 1;

const numberedLines = (count: number): string =>
  Array.from(
    { length: count },
    (_unused, index) => `export const line${index + 1} = ${index + 1};`,
  ).join("\n");

const functionLines = (countedLines: number): string => {
  const statementCount = countedLines - FUNCTION_WRAPPER_LINES;
  return `export function lineBudget(): number {
${Array.from(
  { length: statementCount },
  (_unused, index) => `  const value${index + 1} = ${index + 1};`,
).join("\n")}
  return value${statementCount};
}`;
};

const switchComplexity = (complexity: number): string => {
  const caseCount = complexity - 1;
  return `export function classify(value: number): number {
  switch (value) {
${Array.from(
  { length: caseCount },
  (_unused, index) => `    case ${index}: return ${index};`,
).join("\n")}
    default: return -1;
  }
}`;
};

const cognitiveNine = `export function decide(values: readonly boolean[]): number {
  if (values[0]) {
    if (values[1]) {
      if (values[2]) return 1;
    }
  }
  if (values[3]) return 2;
  if (values[4]) return 3;
  if (values[5]) return 4;
  return 0;
}`;

const cognitiveTen = `export function decide(values: readonly boolean[]): number {
  if (values[0]) {
    if (values[1]) {
      if (values[2]) {
        if (values[3]) return 1;
      }
    }
  }
  return 0;
}`;

const PROBE_SOURCES = {
  "file-230.ts": numberedLines(STRUCTURAL_FILE_MAX),
  "file-231.ts": numberedLines(STRUCTURAL_FILE_MAX + ONE_STEP_OVERFLOW),
  "function-57.ts": functionLines(STRUCTURAL_FUNCTION_MAX),
  "function-58.ts": functionLines(STRUCTURAL_FUNCTION_MAX + ONE_STEP_OVERFLOW),
  "complexity-10.ts": switchComplexity(STRUCTURAL_CYCLOMATIC_MAX),
  "complexity-11.ts": switchComplexity(
    STRUCTURAL_CYCLOMATIC_MAX + ONE_STEP_OVERFLOW,
  ),
  "cognitive-9.ts": cognitiveNine,
  "cognitive-10.ts": cognitiveTen,
} as const;

const BOUNDARIES: Readonly<
  Record<
    StructuralRuleId,
    { readonly accepted: string; readonly overflow: string }
  >
> = {
  "max-lines": { accepted: "file-230.ts", overflow: "file-231.ts" },
  "max-lines-per-function": {
    accepted: "function-57.ts",
    overflow: "function-58.ts",
  },
  complexity: { accepted: "complexity-10.ts", overflow: "complexity-11.ts" },
  "sonarjs/cognitive-complexity": {
    accepted: "cognitive-9.ts",
    overflow: "cognitive-10.ts",
  },
};

const scopeStatus = (): string =>
  execFileSync(
    GIT_BIN,
    ["status", "--porcelain=v1", "--untracked-files=all", "--", PROBE_SCOPE],
    { cwd: REPO_ROOT, encoding: "utf8" },
  ).trim();

const configFailureControls = async (): Promise<readonly string[]> => {
  const errors: string[] = [];
  try {
    const missingRule = new ESLint({
      cwd: REPO_ROOT,
      overrideConfig: {
        rules: { "structural-probe/missing-rule": "error" },
      },
    });
    await missingRule.lintText("export const value = 1;", {
      filePath: `${PROBE_SCOPE}/missing-rule.ts`,
    });
  } catch (error: unknown) {
    errors.push(`missing-rule:${String(error)}`);
  }
  try {
    const missingConfig = new ESLint({
      cwd: REPO_ROOT,
      overrideConfigFile:
        "scripts/quality/exemplary/__missing-structural-probe-config__.ts",
    });
    await missingConfig.lintText("export const value = 1;", {
      filePath: `${PROBE_SCOPE}/missing-config.ts`,
    });
  } catch (error: unknown) {
    errors.push(`missing-config:${String(error)}`);
  }
  return errors;
};

export const runStructuralBoundaryProbes = async () => {
  if (existsSync(PROBE_ROOT) || scopeStatus() !== "")
    throw new Error(`Structural probe scope is not clean: ${PROBE_SCOPE}`);

  mkdirSync(PROBE_ROOT);
  try {
    for (const [name, source] of Object.entries(PROBE_SOURCES))
      writeFileSync(`${PROBE_ROOT}/${name}`, `${source}\n`, "utf8");

    const inventory = await measureStructuralInventory({
      denominator: "product",
      scopes: [PROBE_SCOPE],
    });
    const nativeConfigErrors =
      inventory.classification === "CONFIG"
        ? ["native structural config is not strict for the planted scope"]
        : [];
    const rules = Object.fromEntries(
      STRUCTURAL_RULE_IDS.map((ruleId) => {
        const boundary = BOUNDARIES[ruleId];
        const accepted = `${PROBE_SCOPE}/${boundary.accepted}`;
        const overflow = `${PROBE_SCOPE}/${boundary.overflow}`;
        const acceptedReports = inventory.candidate.byRule[
          ruleId
        ].files.includes(accepted)
          ? 1
          : 0;
        const overflowReports = inventory.candidate.byRule[
          ruleId
        ].files.includes(overflow)
          ? 1
          : 0;
        const unintendedReports = STRUCTURAL_RULE_IDS.filter(
          (otherRuleId) => otherRuleId !== ruleId,
        ).reduce(
          (count, otherRuleId) =>
            count +
            inventory.candidate.byRule[otherRuleId].files.filter(
              (file) => file === accepted || file === overflow,
            ).length,
          0,
        );
        const observation = {
          acceptedReports,
          overflowReports,
          unintendedReports,
          configurationErrors: nativeConfigErrors,
        };
        return [
          ruleId,
          {
            accepted,
            overflow,
            observation,
            classification: classifyStructuralProbe(observation),
          },
        ];
      }),
    );
    const configurationErrors = await configFailureControls();
    return {
      source: inventory.source,
      denominator: inventory.denominator,
      rules,
      controls: {
        vacuous: classifyStructuralProbe({
          acceptedReports: 0,
          overflowReports: 0,
          unintendedReports: 0,
          configurationErrors: [],
        }),
        config: classifyStructuralProbe({
          acceptedReports: 0,
          overflowReports: 0,
          unintendedReports: 0,
          configurationErrors,
        }),
        noise: classifyStructuralProbe({
          acceptedReports: 1,
          overflowReports: 1,
          unintendedReports: 0,
          configurationErrors: [],
        }),
        configurationErrorCount: configurationErrors.length,
      },
    };
  } finally {
    rmSync(PROBE_ROOT, { recursive: true });
    if (scopeStatus() !== "")
      throw new Error(`Structural probe cleanup failed: ${PROBE_SCOPE}`);
  }
};
